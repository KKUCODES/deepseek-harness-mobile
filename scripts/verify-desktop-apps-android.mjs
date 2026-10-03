import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), errors: [], resources: [], opened: false };
const checkIcons = process.argv.includes('--icons');
async function decodedIcons(container, count) {
  const images = container.locator('img[src^="data:image/png;base64,"]');
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const values = await images.evaluateAll(nodes => nodes.map(node => ({ appId: node.dataset.desktopAppIcon ?? null,
      width: node.naturalWidth, height: node.naturalHeight, loaded: node.complete })));
    if (values.length === count && values.every(value => value.loaded && value.width === 32 && value.height === 32)) return values;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`Expected ${count} decoded Windows application icons`);
}
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const starting = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < starting) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 25000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const title = main.locator('.remote-heading strong');
  if (await title.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await title.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.evaluate(node => node.textContent);
  const existing = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  if (await existing.isVisible()) await existing.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage, ids = new Set(), frames = [], operations = [];
    const post = raw => { const item = JSON.parse(raw); if (['remote.desktopApps', 'remote.desktopAppIcon', 'remote.prepareDesktopApp', 'remote.openDesktopApp'].includes(item.data?.frame?.operation?.method)) { ids.add(item.data.frame.id); operations.push(item.data.frame.operation); } return send.call(bridge, raw); };
    const respond = event => { const item = JSON.parse(event.data); if (ids.has(item.event?.id)) frames.push(item.event); return receive.call(bridge, event); };
    bridge.postMessage = post; bridge.onmessage = respond;
    window.desktopAppsProbe = { frames, operations, restore() { if (bridge.postMessage === post) bridge.postMessage = send; if (bridge.onmessage === respond) bridge.onmessage = receive; } };
  });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '在电脑应用中打开', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).waitFor();
  report.applications = await dialog.locator('button.option').allTextContents();
  assert.ok(report.applications.includes('VS Code')); assert.ok(report.applications.includes('Cursor'));
  if (checkIcons) report.listIcons = await decodedIcons(dialog, report.applications.length);
  await page.screenshot({ path: 'artifacts/desktop-apps-list-android.png' });
  await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).click();
  const confirm = dialog.getByRole('button', { name: '确认在电脑打开', exact: true }); await confirm.waitFor();
  report.workspacePath = await dialog.locator('.remote-file-path').innerText();
  report.confirmation = await dialog.innerText();
  await page.screenshot({ path: 'artifacts/desktop-apps-confirm-android.png' });
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).waitFor(); report.cancelled = true;
  if (process.argv.includes('--open')) {
    await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).click(); await confirm.click();
    await dialog.getByText('已向电脑发送打开请求。', { exact: true }).waitFor(); report.opened = true;
    await page.screenshot({ path: 'artifacts/desktop-apps-open-android.png' });
  }
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (process.argv.includes('--header')) {
    const action = main.locator('[data-remote-desktop-app-action]');
    if (checkIcons) report.headerIcon = await decodedIcons(action, 1);
    await action.getByRole('button', { name: '选择打开方式', exact: true }).click();
    if (checkIcons) {
      report.headerMenuIcons = await decodedIcons(page.getByRole('menu'), report.applications.length);
      await page.screenshot({ path: 'artifacts/desktop-app-icons-header-menu-android.png' });
    }
    await page.getByRole('menuitem', { name: 'VS Code', exact: true }).click();
    await confirm.waitFor();
    assert.ok((await dialog.innerText()).includes('VS Code'));
    assert.equal(await dialog.locator('.remote-file-path').innerText(), report.workspacePath);
    await page.screenshot({ path: 'artifacts/desktop-apps-header-confirm-android.png' });
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await action.getByRole('button', { name: '在 VS Code 中打开工作目录', exact: true }).waitFor();
    report.originalHeader = { sharedConfirmation: true, selectedApplicationRemembered: true, cancelled: true };
  }
  if (process.argv.includes('--aside')) {
    const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
    const menu = async name => {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name, exact: true }).click();
    };
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu('查看已归档聊天');
    await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await menu('子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
    const asideInput = aside.getByRole('textbox', { name: '消息', exact: true });
    const asideDraft = await asideInput.innerText();
    await aside.locator('[data-remote-desktop-app-action]').getByRole('button', { name: '选择打开方式', exact: true }).click();
    if (checkIcons) {
      report.asideMenuIcons = await decodedIcons(page.getByRole('menu'), report.applications.length);
      await page.screenshot({ path: 'artifacts/desktop-app-icons-aside-menu-android.png' });
    }
    await page.getByRole('menuitem', { name: 'VS Code', exact: true }).click();
    await confirm.waitFor();
    report.aside = { confirmation: await dialog.innerText(), workspacePath: await dialog.locator('.remote-file-path').innerText() };
    const preparations = await page.evaluate(() => window.desktopAppsProbe.operations.filter(item => item.method === 'remote.prepareDesktopApp'));
    assert.notEqual(preparations.at(-1).sessionId, preparations[0].sessionId);
    report.aside.distinctSession = true;
    await page.screenshot({ path: 'artifacts/desktop-apps-aside-confirm-android.png' });
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await asideInput.innerText(), asideDraft);
    await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await title.innerText(), seed.chat);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu('查看最近聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.original, { exact: true }) }).click();
    report.aside.draftPreserved = true; report.aside.returnedToOriginal = true;
  }
  assert.equal(await input.evaluate(node => node.textContent), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/desktop-apps-failure-android.png' }).catch(() => {});
} finally {
  if (page) { const probe = await page.evaluate(() => { const probe = window.desktopAppsProbe; probe?.restore(); return { frames: probe?.frames, operations: probe?.operations }; }).catch(() => ({})); Object.assign(report, probe); }
  // 图标二进制不写入测试日志；只保留格式和字节数，实际解码由页面核验。
  for (const frame of report.frames ?? []) {
    if (frame.value?.contentType && typeof frame.value.data === 'string') {
      const bytes = Buffer.from(frame.value.data, 'base64');
      frame.value = { appId: frame.value.appId, contentType: frame.value.contentType,
        bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
  }
  await writeFile('artifacts/desktop-apps-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
