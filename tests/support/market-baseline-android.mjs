import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { _android } from 'playwright';

/** 只清理本轮创建的 baselinetest UID；原正式 App、Key 和聊天不读写。 */
export async function verifyMarketBaselineAndroid({ origin, pairLink, title, marker, version, approve, revoke, verifyReply, output }) {
  const root = resolve(import.meta.dirname, '../..');
  const packageName = 'dev.dshmobile.validation.baselinetest';
  const serial = process.env.DSHM_ANDROID_SERIAL;
  assert.equal(serial, '127.0.0.1:16480');
  assert.ok(process.env.DSHM_ADB_PATH);
  const execute = promisify(execFile);
  const adb = async (...args) => (await execute(process.env.DSHM_ADB_PATH, ['-s', serial, ...args], { windowsHide: true })).stdout.trim();
  const metadata = JSON.parse(await readFile(join(root, 'artifacts/market-baseline/android/outputs/apk/debug/output-metadata.json'), 'utf8'));
  assert.equal(metadata.applicationId, packageName);
  const apk = join(root, 'artifacts/market-baseline/android/outputs/apk/debug/app-debug.apk');
  const apkSha256 = createHash('sha256').update(await readFile(apk)).digest('hex');
  const discovered = await _android.devices({ omitDriverInstall: true });
  const device = discovered.find(item => item.serial() === serial);
  await Promise.all(discovered.filter(item => item !== device).map(item => item.close()));
  assert.ok(device);
  const evidence = join(root, 'artifacts/market-baseline', output.split(/[\\/]/).at(-1));
  await mkdir(evidence, { recursive: true });
  const report = { version, serial, packageName, apkSha256, passed: false, stages: [], pageErrors: [] };
  let fingerprint;
  try {
    await adb('reverse', `tcp:${new URL(origin).port}`, `tcp:${new URL(origin).port}`);
    assert.equal(await adb('shell', 'pm', 'clear', packageName), 'Success');
    const key = new URLSearchParams(new URL(pairLink).hash.slice(1)).get('key');
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    const link = `dshm://pair?server=${encodeURIComponent(origin)}#key=${key}`;
    await adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-c', 'android.intent.category.BROWSABLE', '-d', link, '-p', packageName);
    const pid = Number(await adb('shell', 'pidof', packageName));
    assert.ok(pid > 0);
    const view = device.webViews().find(item => item.pid() === pid)
      ?? await device.waitForEvent('webview', { predicate: item => item.pid() === pid, timeout: 30000 });
    const first = await view.page();
    const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
      ?? await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    assert.equal(await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).inputValue(), pairLink);
    await page.getByLabel('设备名称', { exact: true }).fill('DSHM 双版本 Android 验收');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    await approve(fingerprint);
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    const main = page.getByTestId('remote-workspace');
    await main.waitFor({ timeout: 60000 });
    assert.equal(await page.locator('iframe').count(), 0);
    await main.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByText(marker, { exact: true }).waitFor();
    report.stages.push('native-pairing-own-remote-ui-and-real-history');
    const reply = 'DSHM_ANDROID_BASELINE_' + version.replaceAll('.', '_');
    await main.locator('[data-composer-input]').fill(`只回复 ${reply}，不要调用工具。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: reply }).waitFor({ timeout: 180000 });
    await verifyReply(reply);
    await writeFile(join(evidence, 'remote.png'), await device.screenshot());
    report.stages.push('native-send-real-model-reply-and-official-history-match');
    assert.deepEqual(report.pageErrors, []);
    report.passed = true;
  } finally {
    if (fingerprint) await revoke(fingerprint);
    await adb('shell', 'am', 'force-stop', packageName);
    await adb('reverse', '--remove', `tcp:${new URL(origin).port}`);
    await device.close();
    report.cleaned = true;
    await writeFile(join(evidence, 'android.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
