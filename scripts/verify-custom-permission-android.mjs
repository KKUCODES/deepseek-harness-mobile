import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] }, base = 'artifacts/custom-permission-';
const sessionId = JSON.parse(await readFile('artifacts/cross-background-notification-restart-android.json', 'utf8')).result.source;
let page, dialog, changed = false;
async function hostRead() {
  const id = randomUUID(); await writeFile(base + 'control.json', JSON.stringify({ id, sessionId }));
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const result = await readFile(base + 'result.json', 'utf8').then(JSON.parse).catch(() => null);
    if (result?.id === id) { assert.equal(result.error, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host observation timed out');
}
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.evaluate(node => node.textContent);
  report.before = await hostRead();
  assert.equal(report.before.current, 'read-only');
  assert.deepEqual({ sandbox: report.before.spec.sandbox, approval: report.before.spec.approval }, { sandbox: 'read-only', approval: 'ask' });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '会话权限', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '会话权限', exact: true });
  const custom = dialog.getByRole('button', { name: 'DSHM 自定义只读验证', exact: true });
  await custom.waitFor(); assert.equal(await custom.isEnabled(), true);
  changed = true; await custom.click();
  await dialog.getByText('当前权限：DSHM 自定义只读验证', { exact: true }).waitFor();
  report.custom = await hostRead();
  assert.equal(report.custom.current, 'dshm-verification-read-only');
  assert.equal(report.custom.spec.sandbox, 'read-only'); assert.equal(report.custom.spec.approval, 'ask');
  assert.equal(await custom.getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'artifacts/custom-permission-android.png' });
  await dialog.getByRole('button', { name: '仅可查看', exact: true }).click();
  await dialog.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  report.restored = await hostRead(); assert.equal(report.restored.current, 'read-only'); changed = false;
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await editor.evaluate(node => node.textContent), draft);
  report.draftPreserved = true; assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (changed) {
    try {
      await dialog.getByRole('button', { name: '仅可查看', exact: true }).click();
      await dialog.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      report.restored = await hostRead(); assert.equal(report.restored.current, 'read-only');
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } catch (error) { report.cleanupFailure = error.message; }
  }
  await unlink(base + 'control.json').catch(error => { if (error.code !== 'ENOENT') throw error; });
  await writeFile(base + 'android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
