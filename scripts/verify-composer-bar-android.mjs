import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const factoryOwner = process.argv.includes('--factory-owner');
const prefix = factoryOwner ? 'factory-children' : 'composer-bar';
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
  const heading = main.locator('.remote-heading strong');
  const existingPanel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await existingPanel.isVisible()) await existingPanel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (await heading.innerText() === seed.chat) await main.getByRole('button', { name: '返回', exact: true }).click();
  if (await heading.innerText() === 'Remote') {
    const closeWindow = main.getByRole('button', { name: '关闭窗口', exact: true });
    if (await closeWindow.isVisible()) await closeWindow.click();
    if (await main.getByRole('heading', { name: '已归档', exact: true }).count()) {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '查看最近聊天', exact: true }).click();
    }
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  await heading.getByText(seed.original, { exact: true }).waitFor();
  assert.equal(await heading.innerText(), seed.original);
  const input = scope => scope.getByRole('textbox', { name: cleanup ? '消息' : '插件草稿', exact: true });
  await input(main).waitFor();
  if (cleanup) {
    const previous = JSON.parse(await readFile(`artifacts/${prefix}-live-android.json`, 'utf8'));
    // 空 Lexical 段落的占位换行在 innerText 中是 \n，不是用户草稿。
    const restored = await input(main).evaluate(node => ({ text: node.innerText,
      empty: node.textContent === '' && node.children.length === 1
        && node.firstElementChild?.matches('p') && node.firstElementChild.children.length === 1
        && node.firstElementChild.firstElementChild?.matches('br[data-lexical-managed-linebreak]') }));
    assert.equal(restored.empty ? '' : restored.text, previous.draft);
    await page.getByTestId('live-composer-bar').waitFor({ state: 'detached' });
    await page.getByTestId('live-input-dock').waitFor({ state: 'detached' });
    report.unloadedAndRestored = true;
  } else {
    report.draft = await input(main).inputValue();
    const check = async scope => {
      const custom = input(scope), panel = scope.getByTestId('live-composer-bar'), dock = scope.getByTestId('live-input-dock');
      await custom.waitFor();
      const before = await custom.inputValue();
      const marker = `${before} DSHM_BAR_CHECK`;
      try {
        await custom.fill(marker);
        await dock.getByText(marker, { exact: true }).waitFor();
        assert.equal(await dock.getAttribute('data-consistent'), 'true');
        assert.equal(await dock.getAttribute('data-session'), await panel.getAttribute('data-session'));
        assert.equal(await dock.getAttribute('data-phase'), 'open');
        if (factoryOwner) {
          for (const component of [panel, dock]) assert.equal(await component.evaluate(node =>
            !!node.closest('[data-conversation-content]')), true, '输入扩展必须由当前会话工厂承载');
        }
        assert.equal(await scope.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
        const geometry = await panel.evaluate(node => ({ natural: node.offsetWidth, displayed: node.getBoundingClientRect().width,
          viewport: innerWidth, scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        assert.equal(geometry.natural, 600); assert.ok(geometry.displayed <= geometry.viewport + 0.01);
        assert.equal(geometry.scroll, geometry.client);
        return { sessionId: await panel.getAttribute('data-session'), geometry, draftRoundTrip: true };
      } finally {
        await custom.fill(before);
        await page.waitForFunction(({ id, text }) => [...document.querySelectorAll('[data-testid="live-input-dock"]')]
          .some(node => node.dataset.session === id && node.textContent === text), { id: await panel.getAttribute('data-session'), text: before });
      }
    };
    report.main = await check(main);
    const menu = async name => {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name, exact: true }).click();
    };
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
    await input(main).waitFor();
    await menu('子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
    report.sidebar = await check(aside);
    assert.notEqual(report.sidebar.sessionId, report.main.sessionId);
    await page.screenshot({ path: `artifacts/${prefix}-sidebar-android.png` });
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input(main).waitFor();
    assert.equal(await input(main).inputValue(), report.draft); report.originalRestored = true;
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
