import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 测量屏幕上的实际文字与祖先变换；隐藏标签、图标、辅助读屏文本不作阅读字号。 */
export async function builtinPanelMetrics(surface) {
  return surface.evaluate(root => {
    const text = [...root.querySelectorAll('*')].filter(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      return element.childNodes.length && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())
        && !element.closest('[hidden],svg,script,style,[aria-hidden="true"],[data-pdf-text]') && style.visibility !== 'hidden' && box.width > 2 && box.height > 2;
    }).map(element => {
      let scale = 1;
      for (let item = element; item; item = item.parentElement) {
        const transform = getComputedStyle(item).transform;
        if (transform !== 'none') scale *= new DOMMatrix(transform).a;
      }
      return { text: element.textContent.slice(0, 65), font: parseFloat(getComputedStyle(element).fontSize) * scale, scale };
    });
    const scrollers = [...root.querySelectorAll('*')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY) && !element.closest('[hidden]');
    }).map(element => ({ height: element.clientHeight, content: element.scrollHeight, width: element.clientWidth, scrollWidth: element.scrollWidth }));
    return { text, scrollers, width: root.getBoundingClientRect().width, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, height: root.getBoundingClientRect().height, viewportHeight: innerHeight };
  });
}

export async function checkBuiltinPanelLayout(page, output) {
  await mkdir(output, { recursive: true });
  await page.waitForFunction(() => !!window.fixture?.builtinPanels);
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('two'); await window.fixture.builtinPanels(); });
  const report = [], audit = process.argv.includes('--measure-only');
  for (const view of ['guide', 'plan', 'task', 'schedules', 'plugins', 'markdown', 'review']) {
    await page.evaluate(async view => {
      window.fixture.builtinReadState('ready');
      if (view === 'guide') window.fixture.builtinGuide();
      else if (view === 'plan') window.fixture.builtinPlan('# 项目检查计划\n\n' + ('请检查文件、执行结果及待处理问题。\n\n').repeat(100) + '\n```text\n' + 'long-line-'.repeat(150) + '\n```');
      else if (view === 'task') window.fixture.builtinTask();
      else if (view === 'schedules' || view === 'plugins') window.fixture.builtinGlobal(view);
      else if (view === 'markdown') { window.fixture.builtinGlobal(null); await window.fixture.fileLayout('readme.md', '# 日常项目笔记\n\n' + '正文内容与阅读检查。\n\n'.repeat(100) + '\n```text\n代码预览\n```'); }
      else window.fixture.builtinReview();
    }, view);
    const surface = page.locator(view === 'schedules' || view === 'plugins' ? '.remote-global-panel' : '.remote-plugin-panel:not(.remote-global-panel)').filter({ visible: true });
    await surface.waitFor();
    if (view === 'review') {
      await page.waitForTimeout(200);
      const failures = await page.evaluate(() => window.builtinPanelErrors ?? []);
      assert.deepEqual(failures, []);
      await surface.getByText('TURN AFTER', { exact: true }).waitFor();
    }
    for (const width of [320, 375, 420, 760]) for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 667 });
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      await page.waitForTimeout(120);
      const metrics = await builtinPanelMetrics(surface);
      report.push({ view, width, dark, ...metrics });
      await writeFile(join(output, audit ? 'before.json' : 'after.json'), JSON.stringify(report, null, 2));
      if (!audit) {
        assert.ok(metrics.text.length > 0, `${view}: no visible text`);
        assert.ok(metrics.text.every(item => item.scale === 1), `${view}: ${JSON.stringify(metrics.text.filter(item => item.scale !== 1))}`);
        assert.ok(metrics.text.every(item => item.font >= 12.9), `${view}: ${JSON.stringify(metrics.text.filter(item => item.font < 12.9))}`);
        assert.ok(metrics.pageWidth <= width, `${view}: page overflow`);
        if (view !== 'guide') assert.ok(metrics.scrollers.some(item => item.height >= 250 && item.height < 667), `${view}: missing bounded content viewport ${JSON.stringify(metrics.scrollers)}`);
        if (['plan', 'schedules', 'markdown'].includes(view)) {
          const scroll = await surface.evaluate(root => {
            const body = [...root.querySelectorAll('*')].find(item => !item.closest('[hidden]') && item.clientHeight > 200 && item.scrollHeight > item.clientHeight + 100 && getComputedStyle(item).overflowY === 'auto');
            body.scrollTop = 100; const moved = body.scrollTop; body.scrollTop = 0; return moved;
          });
          assert.equal(scroll, 100, `${view}: content must scroll locally`);
        }
      }
      if (width === 375) await surface.screenshot({ path: join(output, `${view}-${dark ? 'dark' : 'light'}.png`) });
    }
    await surface.locator('header').first().getByRole('button', { name: '返回聊天', exact: true }).click();
  }
  if (!audit) {
    for (const state of ['empty', 'error', 'loading']) {
      await page.evaluate(state => { window.fixture.builtinReadState(state); window.fixture.builtinGlobal('schedules'); }, state);
      const surface = page.locator('.remote-global-panel');
      await surface.getByRole(state === 'error' ? 'alert' : 'status').first().waitFor();
      const metrics = await builtinPanelMetrics(surface);
      assert.ok(metrics.text.every(item => item.font >= 13 && item.scale === 1));
      assert.equal(await surface.locator('[data-slot-error]').count(), 0);
      await writeFile(join(output, `schedules-${state}.png`), await surface.screenshot());
      await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.evaluate(() => { window.fixture.builtinReadState('ready'); return window.fixture.builtinMainReplacement(); });
    const replacement = page.getByTestId('main-replacement');
    await page.waitForTimeout(200);
    assert.ok(await replacement.evaluate(item => item.getBoundingClientRect().width < 720));
    await replacement.click({ position: { x: 30, y: 30 } });
    assert.equal(await replacement.getAttribute('data-clicked'), 'yes');
    await page.evaluate(() => window.fixture.builtinReplacementFit(false));
    assert.equal(await replacement.evaluate(item => item.getBoundingClientRect().width), 720);
    assert.ok(await replacement.locator('xpath=../..').evaluate(item => { item.scrollLeft = 50; return item.scrollLeft > 0; }));
    await page.evaluate(() => { window.fixture.builtinReplacementFit(undefined); window.fixture.builtinReplacementOff(); });
    await page.locator('.remote-global-panel [data-plugin-panel]').waitFor();
    assert.deepEqual(await page.evaluate(() => window.builtinPanelErrors ?? []), []);
    await page.locator('.remote-global-panel').getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.evaluate(() => window.fixture.builtinTypographyProbe());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="native-nested"]')).fontSize === '13px');
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('native-nested').evaluate(item => getComputedStyle(item).fontSize), '13px');
    assert.equal(await page.getByTestId('native-heading').evaluate(item => getComputedStyle(item).fontSize), '22px');
    assert.equal(await page.getByTestId('third-party-small').evaluate(item => getComputedStyle(item).fontSize), '10px');
    await page.evaluate(() => window.fixture.builtinTypographyChange());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="native-nested"]')).fontSize === '20px');
    await page.evaluate(() => window.fixture.builtinTypographyOff());
  }
  await writeFile(join(output, audit ? 'before.json' : 'after.json'), JSON.stringify(report, null, 2));
  return report.map(({ view, width, dark, text, scrollers }) => ({ view, width, dark, minFont: Math.min(...text.map(item => item.font)), minScale: Math.min(...text.map(item => item.scale)), scrollers }));
}
