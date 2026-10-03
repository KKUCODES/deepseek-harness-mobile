import assert from 'node:assert/strict';
import { readFile, writeFile, stat, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { installReadingProbe, waitReading, removeReadingProbe } from './remote-reading-probe.mjs';

// 只操作已归档的专用三层会话：读取、临时草稿及恢复，不发送模型请求。
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
const rebuild = process.argv.includes('--rebuild');
const switchSession = process.argv.includes('--switch');
const dropdown = process.argv.includes('--dropdown');
const reading = process.argv.includes('--reading');
assert.ok(!reading || !rebuild, '阅读回执旁听只适用于不重建原生客户端的本次验收');
const artifact = process.env.DSHM_REPORT_PREFIX || (switchSession ? 'sidebar-switch' : rebuild ? 'sidebar-recovery' : 'sidebar-chat');
assert.match(artifact, /^[a-z0-9-]+$/);
const bundle = 'F:/Program Files/deepseek-harness/packages/api/remotes/lib/client.js';
const digest = async () => createHash('sha256').update(await readFile(bundle)).digest('hex');
const originalBundle = rebuild ? { stat: await stat(bundle), hash: await digest() } : null;
let changed = false;
let page;
const rebuildCore = async restore => {
  assert.equal(await digest(), originalBundle.hash);
  await page.evaluate(() => { window.__dshmSidebarOldTransport = window.__DSH_TRANSPORT__; });
  await utimes(bundle, originalBundle.stat.atimeMs / 1000, restore ? originalBundle.stat.mtimeMs / 1000 : Date.now() / 1000);
  changed = !restore;
  await page.waitForFunction(() => window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__ !== window.__dshmSidebarOldTransport, null, { timeout: 30000 });
};
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const deadline = Date.now() + 20000;
  while (!page && Date.now() < deadline) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  // Android附加的既有context没有hasTouch标记，使用WebView原生触摸事件而非桌面hover。
  const touchSession = dropdown ? await context.newCDPSession(page) : null;
  const tap = async locator => {
    await locator.waitFor(); await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox(); assert.ok(box);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const originalChat = () => main.getByRole('button').filter({ has: page.getByText(seed.original, { exact: true }) });
  if (reading) await installReadingProbe(page);
  const primary = main.getByRole('textbox', { name: '消息', exact: true });
  const heading = main.locator('.remote-heading strong');
  const modeDialog = main.getByRole('dialog', { name: 'Agent 模式', exact: true });
  if (await modeDialog.count()) await modeDialog.press('Escape');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const input = aside.getByRole('textbox', { name: '消息', exact: true });
  const menu = async (scope, name) => {
    await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await scope.getByRole('button', { name, exact: true }).click();
  };
  const openAside = async (scope, name) => {
    if (dropdown) {
      await tap(scope.locator('.remote-heading button[aria-haspopup="tree"]').last());
      await tap(page.getByRole('tree', { name: '子代理会话', exact: true })
        .getByRole('button', { name: `在侧边栏打开 ${name}`, exact: true }));
      return;
    }
    await menu(scope, '子会话');
    await scope.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: new RegExp(name) })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  };
  const closeTab = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  };
  if (await heading.innerText() === seed.chat) {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await heading.getByText('Remote', { exact: true }).waitFor();
    if (await main.getByRole('heading', { name: '已归档', exact: true }).count()) await menu(main, '查看最近聊天');
  }
  if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) await originalChat().click();
  assert.equal(await heading.innerText(), seed.original);
  const originalDraft = await primary.innerText();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await heading.getByText('Remote', { exact: true }).waitFor();
  await menu(main, '查看已归档聊天');
  await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  const parentDraft = await primary.innerText();
  const parentReading = reading ? await waitReading(page, 'non-null') : null;
  if (dropdown) {
    await tap(main.locator('.remote-heading button[aria-haspopup="tree"]'));
    const tree = page.getByRole('tree', { name: '子代理会话', exact: true });
    await tap(tree.getByRole('button', { name: '展开 DSHM 恢复子会话 的下级子代理', exact: true }));
    await tree.getByRole('treeitem', { name: /^DSHM 恢复孙会话 / }).waitFor();
    await page.screenshot({ path: `artifacts/${artifact}-menu-android.png` });
    await tap(tree.getByRole('treeitem', { name: /^DSHM 恢复孙会话 / }));
    await main.getByRole('region', { name: '聊天内容', exact: true }).getByText(seed.marker, { exact: true }).waitFor();
    assert.equal(await primary.count(), 0);
    await tap(main.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: seed.chat, exact: true }));
    await primary.waitFor();
    assert.equal(await primary.innerText(), parentDraft);
    report.originalDropdownMainNavigation = true;
  }
  await openAside(main, 'DSHM 恢复子会话');
  await aside.getByRole('region', { name: '聊天内容', exact: true }).getByText('CHILD_NESTED_DONE', { exact: true }).waitFor();
  assert.equal(await heading.innerText(), seed.chat);
  assert.equal(await primary.count(), 0);
  const storedChildDraft = await input.innerText();
  if (reading) {
    const childReading = await waitReading(page, 'non-null');
    assert.notEqual(childReading, parentReading);
    await aside.getByRole('button', { name: /^Agent 模式，当前/ }).click();
    const sheet = aside.getByRole('dialog', { name: 'Agent 模式', exact: true });
    await sheet.waitFor(); await waitReading(page, null);
    await page.evaluate(() => window.dshmHandleBack());
    await sheet.waitFor({ state: 'detached' });
    assert.equal(await aside.isVisible(), true);
    await waitReading(page, childReading);
    await page.screenshot({ path: `artifacts/${artifact}-reading-restored-android.png` });
    report.nativeReadingAcknowledged = true;
    report.nativeSheetBackKeepsSidebar = true;
  }
  // 前一次验收失败可能留下本脚本的无发送测试文本，只清理这个精确值。
  const childDraft = storedChildDraft === 'DSHM_SIDEBAR_DRAFT_ONLY' ? '' : storedChildDraft;
  await input.fill('DSHM_SIDEBAR_DRAFT_ONLY');
  report.geometry = await aside.evaluate(node => {
    const box = node.getBoundingClientRect(), panel = node.closest('.remote-plugin-panel-content').getBoundingClientRect();
    return { width: box.width, height: box.height, panelHeight: panel.height, cssHeight: node.clientHeight,
      headerTop: node.querySelector('header').getBoundingClientRect().top, panelTop: panel.top };
  });
  assert.ok(Math.abs(report.geometry.height - report.geometry.cssHeight) < 1);
  assert.ok(report.geometry.height <= report.geometry.panelHeight + 1 && report.geometry.headerTop >= report.geometry.panelTop - 1);
  await page.screenshot({ path: 'artifacts/sidebar-chat-child-android.png' });
  await openAside(aside, 'DSHM 恢复孙会话');
  await aside.getByRole('region', { name: '聊天内容', exact: true }).getByText(seed.marker, { exact: true }).waitFor();
  assert.equal(await input.count(), 0); report.readOnlyGrandchild = true;
  assert.equal(await heading.innerText(), seed.chat); report.primarySelectionPreserved = true;
  await page.screenshot({ path: 'artifacts/sidebar-chat-readonly-android.png' });
  if (rebuild) {
    await rebuildCore(false);
    await aside.getByRole('region', { name: '聊天内容', exact: true }).getByText(seed.marker, { exact: true }).waitFor();
    assert.equal(await input.count(), 0);
    assert.equal(await heading.innerText(), seed.chat);
    await panel.getByRole('navigation', { name: '已打开的面板', exact: true }).getByRole('button', { name: 'DSHM 恢复子会话', exact: true }).waitFor();
    report.coreRestoredNestedTabs = true;
  }
  await closeTab();
  await aside.getByRole('button', { name: '切换子代理：DSHM 恢复子会话', exact: true }).waitFor();
  assert.equal(await input.innerText(), 'DSHM_SIDEBAR_DRAFT_ONLY'); report.childDraftRetained = true;
  await input.fill(childDraft);
  await aside.getByRole('button', { name: '返回父会话', exact: true }).click();
  await aside.locator('.remote-heading strong').getByText(seed.chat, { exact: true }).waitFor();
  assert.equal(await input.innerText(), parentDraft);
  await input.fill('DSHM_SIDEBAR_PARENT_DRAFT_ONLY');
  if (rebuild) {
    await rebuildCore(true);
    await aside.locator('.remote-heading strong').getByText(seed.chat, { exact: true }).waitFor();
    assert.equal(await input.innerText(), 'DSHM_SIDEBAR_PARENT_DRAFT_ONLY');
    report.coreRestoredNavigatedSelection = true;
    await page.screenshot({ path: `artifacts/${artifact}-parent-android.png` });
  }
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await primary.waitFor();
  assert.equal(await primary.innerText(), 'DSHM_SIDEBAR_PARENT_DRAFT_ONLY');
  if (switchSession) {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await heading.getByText('Remote', { exact: true }).waitFor();
    await page.getByTestId('remote-sidebar-conversation').waitFor({ state: 'detached' });
    await menu(main, '查看最近聊天');
    await originalChat().click();
    assert.equal(await primary.innerText(), originalDraft);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await heading.getByText('Remote', { exact: true }).waitFor();
    await menu(main, '查看已归档聊天');
    await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await primary.waitFor();
    await menu(main, '插件面板');
    await panel.getByRole('navigation', { name: '已打开的面板', exact: true }).getByRole('button', { name: 'DSHM 恢复子会话', exact: true }).click();
    await aside.locator('.remote-heading strong').getByText(seed.chat, { exact: true }).waitFor();
    assert.equal(await input.innerText(), 'DSHM_SIDEBAR_PARENT_DRAFT_ONLY');
    report.switchedSessionRestored = true;
    await page.screenshot({ path: 'artifacts/sidebar-switch-restored-android.png' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await primary.waitFor();
  }
  await primary.fill(parentDraft); report.sameSessionInputReturn = true;
  await menu(main, '插件面板');
  // “插件面板”先打开指南，切回实际子会话标签再关闭，释放引用与视图。
  await panel.getByRole('navigation', { name: '已打开的面板', exact: true }).getByRole('button', { name: 'DSHM 恢复子会话', exact: true }).click();
  await closeTab();
  await page.getByTestId('remote-sidebar-conversation').waitFor({ state: 'detached' }); report.tabsReleased = true;
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await primary.waitFor();
  const restoredParent = await primary.innerText();
  assert.equal(parentDraft.trim() ? restoredParent : restoredParent.trim(), parentDraft.trim() ? parentDraft : '');
  for (let attempt = 0; attempt < 12; attempt++) {
    await openAside(main, 'DSHM 恢复子会话');
    await aside.getByRole('region', { name: '聊天内容', exact: true }).getByText('CHILD_NESTED_DONE', { exact: true }).waitFor();
    await closeTab();
    await page.getByTestId('remote-sidebar-conversation').waitFor({ state: 'detached' });
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await primary.waitFor();
  }
  report.repeatedOpenClose = 12;
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await heading.getByText('Remote', { exact: true }).waitFor();
  await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).waitFor(); report.stillArchived = true;
  await menu(main, '查看最近聊天');
  await originalChat().click();
  assert.equal(await primary.innerText(), originalDraft); report.originalRestored = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-5000); await page.screenshot({ path: 'artifacts/sidebar-chat-failure-android.png' }).catch(() => {}); }
  throw error;
} finally {
  if (changed && await digest() === originalBundle.hash) await utimes(bundle, originalBundle.stat.atimeMs / 1000, originalBundle.stat.mtimeMs / 1000);
  if (rebuild) {
    report.bundleBytesUnchanged = await digest() === originalBundle.hash;
    report.bundleTimestampRestored = Math.abs((await stat(bundle)).mtimeMs - originalBundle.stat.mtimeMs) < 1;
    await page?.evaluate(() => { delete window.__dshmSidebarOldTransport; }).catch(() => {});
  }
  if (reading && page) report.readingAcknowledgements = await removeReadingProbe(page).catch(() => []);
  await writeFile(`artifacts/${artifact}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
