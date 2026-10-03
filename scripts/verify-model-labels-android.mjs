import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const workspaceErrors = process.argv.includes('--workspace-errors');
const reportPrefix = workspaceErrors ? 'workspace-errors' : 'model-labels';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), labels: {}, errors: [] };
let phone, remote, originalLanguage, originalDraft, originalTitle;
async function appearance() {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const first = await (await androidAppWebView(device)).page();
  phone = first.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone);
  await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar|退出设置|Close settings|返回设置首页|Back to settings)$/ }).waitFor();
  if (await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).count()) {
    await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).click();
    await phone.getByRole('button', { name: /^(设置|Settings)$/ }).click();
  }
  if (await phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ }).count()) {
    await phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ }).click();
  }
  await phone.locator('.settings-font output').waitFor();
}
async function language(value) {
  await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
  await phone.getByRole('dialog').getByRole('button', { name: value === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
  await phone.getByRole('dialog').waitFor({ state: 'detached' });
}
async function returnRemote() {
  await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
  await phone.getByRole('button', { name: /^(电脑连接|Computer connection)$/ }).click();
  const deadline = Date.now() + 15000;
  do {
    remote = phone.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) await new Promise(resolve => setTimeout(resolve, 100));
  } while (!remote && Date.now() < deadline);
  assert.ok(remote);
  await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
}
try {
  await appearance();
  originalLanguage = await phone.evaluate(() => document.documentElement.lang === 'en' ? 'en' : 'zh');
  await returnRemote();
  const testChat = remote.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' });
  if (await testChat.isVisible()) await testChat.click();
  originalTitle = await remote.getByTestId('remote-workspace').locator('.remote-heading strong').innerText();
  assert.equal(originalTitle, 'DSHM Remote 联调提示');
  originalDraft = await remote.getByRole('textbox', { name: /^(消息|Message)$/ }).innerText();
  remote.on('pageerror', error => report.errors.push(error.message));
  await appearance();
  for (const value of ['en', 'zh']) {
    await language(value); await returnRemote();
    await remote.getByRole('textbox', { name: value === 'en' ? 'Message' : '消息', exact: true }).focus();
    if (workspaceErrors) {
      const expected = value === 'en'
        ? 'Could not open the chat for this notification. Check the computer connection and try again.'
        : '暂时无法打开提醒对应的聊天，请检查电脑连接后重试。';
      const alert = remote.getByRole('alert').filter({ hasText: expected });
      await alert.waitFor(); report.labels[value] = await alert.innerText();
    } else {
      const button = remote.getByRole('button', { name: value === 'en' ? /^Choose model, current: / : /^选择模型，当前 / });
      await button.waitFor();
      report.labels[value] = await button.getAttribute('aria-label');
    }
    await remote.screenshot({ path: `artifacts/${reportPrefix}-${value}-android.png` });
    assert.equal(await remote.getByRole('textbox', { name: /^(消息|Message)$/ }).innerText(), originalDraft);
    await appearance();
  }
  if (!workspaceErrors) assert.equal(report.labels.en.replace('Choose model, current: ', ''), report.labels.zh.replace('选择模型，当前 ', ''));
  assert.deepEqual(report.errors, []);
  if (workspaceErrors) report.notificationErrorTranslated = true;
  else report.modelNamePreserved = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (originalLanguage) {
    try {
      await appearance(); await language(originalLanguage); await returnRemote();
      if ((await device.shell('dumpsys input_method')).toString().includes('mInputShown=true')) await device.shell('input keyevent 4');
      report.restored = await remote.evaluate(() => document.documentElement.lang) === (originalLanguage === 'en' ? 'en' : 'zh-CN');
      if (originalTitle !== undefined && originalDraft !== undefined) report.restored &&= await remote.getByTestId('remote-workspace').locator('.remote-heading strong').innerText() === originalTitle
        && await remote.getByRole('textbox', { name: /^(消息|Message)$/ }).innerText() === originalDraft;
      assert.equal(report.restored, true);
    } catch (error) { report.cleanupFailure = error.message.split('\n')[0]; process.exitCode = 1; }
  }
  await writeFile(`artifacts/${reportPrefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
