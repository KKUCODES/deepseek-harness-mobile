import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

const pkg = 'dev.dshmobile.validation.pairingtest';
const chinese = process.argv.includes('--chinese');
const artifact = `artifacts/standard-remote-ime${chinese ? '-chinese' : ''}`;
const name = `DSHM Android键盘验收 ${randomUUID().slice(0, 8)}`;
const api = await localDesktopManagement();
const previous = new Set((await api()).devices.map(device => device.id));
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5556');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), name, errors: [] };
let deviceId, page;
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  page = await opened; page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  const pairing = await api({ action: 'pair' });
  await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).fill(pairing.link);
  await page.getByRole('textbox', { name: '设备名称', exact: true }).fill(name);
  await page.getByRole('button', { name: '继续配对', exact: true }).click();
  await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
  const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
  const candidates = (await api()).devices.filter(row => !previous.has(row.id) && row.name === name && row.fingerprint === fingerprint);
  assert.equal(candidates.length, 1); deviceId = candidates[0].id;
  assert.equal(candidates[0].status, 'pending');
  await api({ action: 'approve', deviceId });
  const approved = (await api()).devices.find(row => row.id === deviceId);
  assert.equal(approved.status, 'active'); assert.equal(approved.management, false);
  report.temporaryChatAuthorization = true;
  await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  await main.locator('.connection-dot.online').waitFor({ timeout: 60000 });
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const editor = main.getByRole('textbox', { name: '消息', exact: true }); await editor.waitFor();
  const original = await editor.innerHTML();
  await main.getByRole('article', { name: '模型回复' }).first().waitFor();
  const measure = () => page.evaluate(() => {
    const main = document.querySelector('[data-testid="remote-workspace"]');
    return { height: innerHeight, visualHeight: visualViewport.height,
      editorBottom: main.querySelector('[contenteditable="true"]')?.getBoundingClientRect().bottom,
      composerBottom: main.querySelector('.composer-area')?.getBoundingClientRect().bottom };
  });
  report.before = await measure();
  await editor.click();
  const deadline = Date.now() + 10000;
  do {
    report.after = await measure();
    if (report.after.visualHeight < report.before.visualHeight - 100) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  await device.screenshot({ path: `${artifact}.png` });
  assert.ok(report.after.visualHeight < report.before.visualHeight - 100, '真实键盘必须缩小聊天可视区域');
  assert.ok(report.after.editorBottom <= report.after.visualHeight);
  assert.ok(report.after.composerBottom <= report.after.visualHeight + 1, '发送工具栏必须在键盘上方');
  if (chinese) {
    assert.equal(await editor.textContent(), '', '中文输入只使用临时设备的空草稿');
    await editor.evaluate(element => {
      window.imeEvidence = [];
      for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input']) {
        element.addEventListener(type, event => window.imeEvidence.push({ type, data: event.data, composing: event.isComposing }));
      }
    });
    console.log('等待真实拼音键盘输入并选择「你好」候选词；不会发送消息。');
    await page.waitForFunction(() => {
      const editor = document.querySelector('[data-testid="remote-workspace"] [contenteditable="true"]');
      return editor?.textContent === '你好' && window.imeEvidence.some(event => event.type === 'compositionend');
    }, null, { timeout: 180000 });
    report.compositionEvents = await page.evaluate(() => window.imeEvidence);
    report.chineseCandidateCommitted = true;
    await device.screenshot({ path: `${artifact}.png` });
    await editor.press('ControlOrMeta+A');
    await editor.press('Backspace');
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [contenteditable="true"]')?.textContent === '');
  }
  await device.shell('input keyevent 4');
  await page.waitForFunction(height => Math.abs(visualViewport.height - height) < 2, report.before.visualHeight);
  report.draftPreserved = await editor.innerHTML() === original; assert.ok(report.draftPreserved);
  report.keyboardAvoidance = true;
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message.replace(/[A-Za-z0-9_-]{43,}/g, '[redacted]'); process.exitCode = 1;
} finally {
  try {
    const pending = (await api()).devices.filter(row => !previous.has(row.id) && row.name === name);
    for (const row of pending) {
      await api({ action: 'revoke', deviceId: row.id });
      assert.equal((await api()).devices.find(item => item.id === row.id)?.status, 'revoked');
    }
    report.testAuthorizationRevoked = pending.length > 0;
    if (page && deviceId) {
      await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0);
      report.revokedWorkspaceRemoved = true;
    }
  } catch { report.cleanupFailure = '测试授权清理需复查'; process.exitCode = 1; }
  await device.shell(`am force-stop ${pkg}`);
  await writeFile(`${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
