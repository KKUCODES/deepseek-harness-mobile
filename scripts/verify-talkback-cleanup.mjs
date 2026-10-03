import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读复查临时读屏测试的清理结果，不改变设备设置或会话。
const report = { at: new Date().toISOString(), errors: [] };
const speechProbe = process.argv.includes('--speech-probe');
const chatProbe = process.argv.includes('--chat-probe');
const baselinePath = chatProbe ? 'artifacts/talkback-chat-baseline.json' : speechProbe ? 'artifacts/talkback-speech-baseline.json' : 'artifacts/talkback-settings-baseline.json';
const reportPath = chatProbe ? 'artifacts/talkback-chat-cleanup-android.json' : speechProbe ? 'artifacts/talkback-speech-cleanup-android.json' : 'artifacts/talkback-cleanup-android.json';
let device;
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
  assert.ok(device);
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  report.settings = {};
  for (const [key, value] of Object.entries(baseline)) {
    assert.match(key, /^[a-z_]+$/);
    report.settings[key] = (await device.shell(`settings get secure ${key}`)).toString().trim();
    assert.equal(report.settings[key], value);
  }
  report.packagesRemoved = !(await device.shell('pm list packages com.google.android.marvin.talkback')).toString().trim()
    && !(await device.shell('pm list packages com.google.android.tts')).toString().trim();
  assert.equal(report.packagesRemoved, true);
  report.inputMethod = (await device.shell('settings get secure default_input_method')).toString().trim();
  assert.equal(report.inputMethod, 'com.sohu.inputmethod.sogou.chuizi/com.sohu.inputmethod.sogou.SogouIME');
  const page = await (await androidAppWebView(device)).page();
  const remote = page.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(remote);
  report.title = await remote.getByTestId('remote-workspace').locator('.remote-heading strong').innerText();
  assert.equal(report.title, 'DSHM Remote 联调提示');
  report.draftEmpty = !(await remote.getByRole('textbox', { name: /^(消息|Message)$/ }).innerText()).trim();
  assert.equal(report.draftEmpty, true);
  report.alerts = await remote.getByRole('alert').allTextContents();
  assert.deepEqual(report.alerts, []);
  report.modelLabel = await remote.locator('[aria-label^="选择模型，当前 "]').getAttribute('aria-label');
  assert.equal(report.modelLabel, '选择模型，当前 DeepSeek-V4-Pro');
  report.dialogsClosed = await remote.getByRole('dialog').count() === 0;
  assert.equal(report.dialogsClosed, true);
} catch (error) {
  report.errors.push(error.stack); process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
