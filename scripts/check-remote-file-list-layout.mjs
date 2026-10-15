import assert from 'node:assert/strict';

export async function fileListMetrics(panel) {
  return panel.locator('[data-files-state="tree"]').evaluate(tree => {
    const row = tree.querySelector('[data-files-entry="file"] button span:last-child');
    const path = tree.querySelector('[data-files-path]:not([data-files-entry])');
    const font = element => {
      let scale = 1;
      for (let item = element; item; item = item.parentElement) {
        const transform = getComputedStyle(item).transform;
        if (transform !== 'none') scale *= new DOMMatrix(transform).a;
      }
      return { size: parseFloat(getComputedStyle(element).fontSize) * scale, scale };
    };
    const body = tree.querySelector('[data-files-body]');
    return { row: font(row), path: font(path), height: body.clientHeight, scrollHeight: body.scrollHeight,
      pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
  });
}

export async function checkRemoteFileListLayout(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('two'); await window.fixture.fileList(); });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const tree = panel.locator('[data-files-state="tree"]');
  await tree.getByRole('button', { name: 'approval-000.txt', exact: true }).waitFor();
  assert.equal(await tree.locator('[data-files-row="failed"]').count(), 0);
  const cases = [];
  for (const width of [320, 375, 420, 760]) {
    await page.setViewportSize({ width, height: 667 });
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      await page.waitForTimeout(100);
      const metrics = await fileListMetrics(panel); cases.push({ width, dark, ...metrics });
      if (!process.argv.includes('--measure-only')) {
        assert.ok(metrics.row.size >= 14 && metrics.path.size >= 13, JSON.stringify(metrics));
        assert.ok(metrics.height > 200 && metrics.scrollHeight > metrics.height, JSON.stringify(metrics));
        assert.ok(metrics.pageWidth <= metrics.viewport, JSON.stringify(metrics));
      }
      if (width === 375) await page.screenshot({ path: `${output}${dark ? '-dark' : ''}.png` });
    }
  }
  if (process.argv.includes('--measure-only')) return { cases };
  await tree.getByRole('button', { name: 'folder', exact: true }).click();
  await tree.getByRole('button', { name: 'nested.txt', exact: true }).waitFor();
  await tree.getByRole('button', { name: 'approval-000.txt', exact: true }).click();
  await panel.locator('[data-textpreview-plain]').filter({ visible: true, hasText: 'DSHM_FILE_LIST_CONTENT' }).waitFor();
  await panel.locator('nav').getByRole('button', { name: '文件', exact: true }).click();
  assert.equal(await tree.getByRole('button', { name: 'folder', exact: true }).getAttribute('aria-expanded'), 'true');
  const scroll = await tree.locator('[data-files-body]').evaluate(element => { element.scrollTop = 200; return element.scrollTop; });
  assert.ok(scroll > 0);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.evaluate(() => window.fixture.fileListReopen());
  assert.equal(await tree.locator('[data-files-body]').evaluate(element => element.scrollTop), scroll);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => window.fixture.fileListReplacement());
  const replacement = panel.getByTestId('files-replacement'); await replacement.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="files-replacement"]')?.getBoundingClientRect().width <= innerWidth);
  assert.equal(await replacement.evaluate(element => element.offsetWidth), 720);
  await replacement.click(); assert.equal(await replacement.getAttribute('data-clicked'), 'yes');
  await page.evaluate(() => window.fixture.fileListReplacementFit(false));
  assert.ok(await replacement.evaluate(element => Math.abs(element.getBoundingClientRect().width - 720) < 0.1));
  assert.ok(await replacement.locator('xpath=../..').evaluate(element => { element.scrollLeft = 50; return element.scrollLeft > 0; }));
  await page.evaluate(() => { window.fixture.fileListReplacementFit(undefined); window.fixture.fileListReplacementOff(); });
  await tree.getByRole('button', { name: 'folder', exact: true }).waitFor();
  assert.ok((await fileListMetrics(panel)).row.size >= 14);
  return { cases, openFile: true, expansionPreserved: true, localScrollPreserved: true, thirdPartySameSlotScalesAndOptOut: true };
}
