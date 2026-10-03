import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const resident = process.argv.includes('--resident-composer');
const direct = process.argv.includes('--direct');
const scope = process.argv.includes('--scope') || direct;
const prefix = direct ? 'direct-factory' : scope ? 'factory-scope' : resident ? 'conversation-composer-split' : 'conversation-factory';
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', item => { if (item.type() === 'error') report.errors.push(item.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const input = scope => scope.getByRole('textbox', { name: '消息', exact: true });
  const heading = scope => scope.locator('.remote-heading strong');
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  if (cleanup) {
    const previous = JSON.parse(await readFile(`artifacts/${prefix}-live-android.json`, 'utf8'));
    if (direct) await aside.waitFor({ state: 'detached' });
    else { await aside.waitFor(); assert.equal(await heading(aside).innerText(), seed.chat); }
    await page.getByTestId('live-factory-views').waitFor({ state: 'detached' });
    await page.getByTestId('live-factory-controls').waitFor({ state: 'detached' });
    if (!direct) assert.equal(await input(aside).innerText(), previous.parentDraft);
    report.unloadedAtSameParent = !direct; report.directHostUnloaded = direct;
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input(main).waitFor();
    assert.equal(await input(main).innerText(), previous.originalDraft); report.originalRestored = true;
  } else {
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (await heading(main).innerText() === seed.chat) await main.getByRole('button', { name: '返回', exact: true }).click();
    if (await heading(main).innerText() === 'Remote') {
      const closeWindow = main.getByRole('button', { name: '关闭窗口', exact: true });
      if (await closeWindow.isVisible()) await closeWindow.click();
      if (await main.getByRole('heading', { name: '已归档', exact: true }).count()) await menu('查看最近聊天');
      await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    }
    await heading(main).getByText(seed.original, { exact: true }).waitFor(); await input(main).waitFor();
    report.originalDraft = await input(main).innerText();
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
    await input(main).waitFor();
    if (direct) await main.getByTestId('live-direct-factory-open').click();
    else {
      await menu('子会话');
      await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
        .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    }
    await input(aside).waitFor();
    const controls = panel.getByTestId('live-factory-controls'); await controls.waitFor();
    assert.equal(await controls.getAttribute('data-container'), 'true');
    assert.equal(await controls.getAttribute('data-phase'), 'active');
    assert.equal(await controls.getAttribute('data-locale'), 'function');
    report.defaultViews = true; report.localControls = true;
    report.childDraft = await input(aside).innerText();
    if (scope) {
      assert.equal(await controls.getAttribute('data-block'), '');
      const block = aside.getByTestId('live-factory-block');
      report.blockChild = await block.getAttribute('data-session');
      await block.click();
      await page.waitForFunction(id => document.querySelector('[data-testid="live-factory-controls"]')?.dataset.block === `测试暂停:${id}`, report.blockChild);
      assert.equal(await input(aside).getAttribute('contenteditable'), 'false');
    }
    const custom = panel.getByTestId('live-factory-views');
    await controls.click(); await custom.waitFor();
    report.childId = await custom.getAttribute('data-session');
    assert.equal(await custom.getAttribute('data-open'), 'open');
    assert.equal(await input(aside).innerText(), report.childDraft);
    await controls.click(); await custom.waitFor({ state: 'detached' });
    await aside.getByRole('button', { name: '返回父会话', exact: true }).click();
    await heading(aside).getByText(seed.chat, { exact: true }).waitFor(); await input(aside).waitFor();
    report.parentDraft = await input(aside).innerText();
    if (scope) {
      await page.waitForFunction(() => document.querySelector('[data-testid="live-factory-controls"]')?.dataset.block === '');
      const block = aside.getByTestId('live-factory-block');
      report.blockParent = await block.getAttribute('data-session');
      assert.notEqual(report.blockParent, report.blockChild);
      await block.click();
      await page.waitForFunction(id => document.querySelector('[data-testid="live-factory-controls"]')?.dataset.block === `测试暂停:${id}`, report.blockParent);
      assert.equal(await input(aside).getAttribute('contenteditable'), 'false');
      await block.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="live-factory-controls"]')?.dataset.block === '');
      report.composerBlockRebound = true;
    }
    await controls.click(); await custom.waitFor();
    assert.equal(await heading(aside).innerText(), seed.chat);
    report.parentId = await custom.getAttribute('data-session');
    assert.notEqual(report.parentId, report.childId);
    assert.equal(await custom.getAttribute('data-open'), 'open');
    assert.equal(await input(aside).innerText(), report.parentDraft);
    report.viewsSwitchKeepsParentAndDraft = true;
    if (resident) {
      const editor = await input(aside).elementHandle();
      const scroller = aside.getByRole('region', { name: '聊天内容', exact: true });
      await scroller.evaluate(async node => {
        node.scrollTop = 40;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await scroller.evaluate(node => node.scrollTop), 40);
      await custom.getByRole('button', { name: '仅显示插件内容', exact: true }).click();
      await custom.getByText('插件独立内容', { exact: true }).waitFor();
      await input(aside).waitFor();
      assert.equal(await input(aside).evaluate((node, previous) => node === previous, editor), true);
      assert.equal(await input(aside).innerText(), report.parentDraft);
      const bounds = await input(aside).boundingBox();
      assert.ok(bounds && bounds.y + bounds.height <= await page.evaluate(() => innerHeight));
      await page.screenshot({ path: `artifacts/${prefix}-custom-only-android.png` });
      await custom.getByRole('button', { name: '恢复聊天内容', exact: true }).click();
      await heading(aside).getByText(seed.chat, { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-testid="remote-sidebar-conversation"] .conversation')?.scrollTop === 40);
      assert.equal(await input(aside).evaluate((node, previous) => node === previous, editor), true);
      await editor.dispose(); report.residentComposer = true; report.readingPositionRestored = true;
    }
    const composer = await input(aside).evaluate(node => {
      const parents = [];
      for (let current = node; current && parents.length < 18; current = current.parentElement) {
        const rect = current.getBoundingClientRect(), css = getComputedStyle(current);
        parents.push({ tag: current.tagName, className: current.className, plugin: current.dataset.pluginFrame,
          height: rect.height, bottom: rect.bottom, heightRule: current.style.height, display: css.display, overflow: css.overflow });
      }
      return { bottom: node.getBoundingClientRect().bottom, viewport: innerHeight, parents };
    });
    report.composer = composer; assert.ok(composer.bottom <= composer.viewport);
    const geometry = await custom.evaluate(node => ({ width: node.getBoundingClientRect().width,
      viewport: innerWidth, scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert.ok(geometry.width <= geometry.viewport + 0.01); assert.equal(geometry.scroll, geometry.client);
    report.geometry = geometry;
    // 保持当前父会话，下一步真实卸载测试包后再核对，不能先关闭面板掩盖位置丢失。
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  await page.screenshot({ path: `artifacts/${prefix}-${cleanup ? 'cleanup' : 'live'}-android.png` });
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: `artifacts/${prefix}-failure-android.png` }).catch(() => {});
} finally {
  await writeFile(`artifacts/${prefix}-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
