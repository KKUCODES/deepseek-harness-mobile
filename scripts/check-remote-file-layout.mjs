import assert from 'node:assert/strict';

export async function documentLayoutMetrics(panel) {
  return panel.locator('[data-textpreview-plain], [data-code-preview]').filter({ visible: true }).evaluate(plain => {
    const preview = plain.closest('[data-textpreview-url]');
    const body = preview.querySelector('[data-textpreview-body]');
    const path = preview.querySelector('[data-textpreview-path]');
    const line = plain.querySelector('[data-textpreview-line]') ?? plain.querySelector('pre');
    const measure = element => {
      let scale = 1;
      const frames = [];
      for (let item = element; item; item = item.parentElement) {
        const style = getComputedStyle(item);
        if (style.transform !== 'none') scale *= new DOMMatrix(style.transform).a;
        if (item.dataset.pluginFrame) frames.push({ id: item.dataset.pluginFrame, fit: item.dataset.autoFit, width: item.clientWidth, scrollWidth: item.scrollWidth });
      }
      return { font: parseFloat(getComputedStyle(element).fontSize), renderedFont: parseFloat(getComputedStyle(element).fontSize) * scale, scale, frames };
    };
    return { text: measure(line), path: measure(path), body: { width: body.clientWidth, scrollWidth: body.scrollWidth, height: body.clientHeight, scrollHeight: body.scrollHeight },
      previewWidth: preview.getBoundingClientRect().width, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
  });
}

export async function checkRemoteFileLayout(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('two'); });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const cases = [];
  const paths = ['short.txt', 'Q:\\Tanxian\\LToys\\dsh-mobile\\plugin\\artifacts\\official-dsh-alpha2\\home\\official-remote-test-project\\2ea87817\\approval-reject.txt'];
  for (const [index, path] of paths.entries()) {
    await page.evaluate(({ path, text }) => window.fixture.fileLayout(path, text), { path, text: 'DSHM_OFFICIAL_BEFORE\n' + (index ? 'Long line '.repeat(60) : 'short line') + '\n' + '验收正文\n'.repeat(100) });
    await panel.locator('[data-textpreview-plain]').filter({ visible: true, hasText: 'DSHM_OFFICIAL_BEFORE' }).waitFor();
    await page.waitForTimeout(250);
    for (const width of [320, 375, 420, 760]) {
      await page.setViewportSize({ width, height: 667 });
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
        await page.waitForTimeout(100);
        const metrics = await documentLayoutMetrics(panel);
        cases.push({ file: path, width, dark, ...metrics });
        if (!process.argv.includes('--measure-only')) {
          assert.ok(metrics.text.renderedFont >= 14, JSON.stringify(metrics));
          assert.ok(metrics.path.renderedFont >= 13, JSON.stringify(metrics));
          assert.ok(metrics.pageWidth <= metrics.viewport, JSON.stringify(metrics));
          assert.ok(metrics.body.height > 100, JSON.stringify(metrics));
        }
        if (width === 375 && index === 1) await page.screenshot({ path: `${output}${dark ? '-dark' : ''}.png`, fullPage: true });
      }
    }
    if (!process.argv.includes('--measure-only')) {
      const active = panel.locator('.remote-document-tab:not([hidden])');
      const toggle = active.locator('[data-textpreview-tool="wrap"]');
      if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
      if (index) {
        const scroll = await active.locator('[data-textpreview-body]').evaluate(element => { element.scrollLeft = 80; element.scrollTop = 100; return { left: element.scrollLeft, top: element.scrollTop }; });
        assert.ok(scroll.left > 0 && scroll.top > 0, 'Long file scrolls inside the body');
        assert.ok((await documentLayoutMetrics(panel)).text.renderedFont >= 14);
      }
      await toggle.click();
    }
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  }
  await page.evaluate(() => window.fixture.fileLayout('src/preview.py', 'print("DSHM source preview")\n# ' + 'long source '.repeat(80)));
  await panel.locator('[data-code-preview]').getByText(/DSHM source preview/).waitFor();
  const code = await documentLayoutMetrics(panel);
  if (!process.argv.includes('--measure-only')) {
    assert.ok(code.text.renderedFont >= 14, JSON.stringify(code));
    assert.ok(code.body.height > 100, JSON.stringify(code));
  }
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (!process.argv.includes('--measure-only')) {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.evaluate(async () => { window.fixture.startTransfers(); await window.fixture.attachmentRenderers(true); window.fixture.attachmentPreview('first'); });
    const renderer = panel.getByTestId('attachment-renderer').filter({ visible: true });
    await renderer.filter({ hasText: 'ORIGINAL first' }).waitFor();
    await page.waitForTimeout(200);
    assert.equal(await renderer.evaluate(element => element.offsetWidth), 720);
    const bounds = await renderer.evaluate(element => ({ width: element.getBoundingClientRect().width, viewport: innerWidth }));
    assert.ok(bounds.width <= bounds.viewport + 0.5, JSON.stringify(bounds));
    await page.evaluate(() => window.fixture.fileLayoutFit(false));
    assert.ok(await renderer.evaluate(element => Math.abs(element.getBoundingClientRect().width - 720) < 0.1));
    assert.ok(await renderer.locator('xpath=../..').evaluate(element => { element.scrollLeft = 50; return element.scrollLeft > 0; }));
    await page.evaluate(() => { window.fixture.fileLayoutFit(undefined); window.fixture.removeAttachmentRenderers(); });
    await panel.locator('[data-textpreview-plain]').filter({ visible: true, hasText: 'ORIGINAL first' }).waitFor();
    assert.ok((await documentLayoutMetrics(panel)).text.renderedFont >= 14);
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  }
  return { cases, code, thirdPartyScalingAndOptOut: !process.argv.includes('--measure-only') };
}
