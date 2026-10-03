import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只打开专用聊天中已有的损坏附件；不发送消息、改写文件或修改电脑配置。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const prefix = process.env.DSHM_VALIDATION_PREFIX ?? 'office-error-language';
assert.match(prefix, /^[a-z0-9-]+$/);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], samples: {} };
let phone, remote, original, draft;
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
async function settings() {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 20000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) await pause();
  do {
    phone = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
    if (!phone) await pause();
  } while (!phone && Date.now() < deadline);
  assert.ok(phone);
  await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar|退出设置|Close settings|返回设置首页|Back to settings)$/ }).waitFor();
  const sidebar = phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ });
  if (await sidebar.count()) {
    await sidebar.click(); await phone.getByRole('button', { name: /^(设置|Settings)$/ }).click();
  }
  const appearance = phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ });
  if (await appearance.count()) await appearance.click();
  await phone.locator('.settings-font output').waitFor();
}
async function language(locale) {
  await settings();
  await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
  await phone.getByRole('dialog').getByRole('button', { name: locale === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
  await phone.getByRole('dialog').waitFor({ state: 'detached' });
  await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
  await phone.getByRole('button', { name: /^(电脑连接|Computer connection)$/ }).click();
  const deadline = Date.now() + 20000;
  do {
    remote = phone.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) await pause();
  } while (!remote && Date.now() < deadline);
  assert.ok(remote); remote.setDefaultTimeout(25000);
  await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  await remote.waitForFunction(value => document.documentElement.lang === value, locale === 'en' ? 'en' : 'zh-CN');
}
try {
  await settings(); original = await phone.evaluate(() => document.documentElement.lang);
  await language('en');
  remote.on('pageerror', error => report.errors.push(error.message));
  const panel = remote.getByRole('region', { name: /^(插件面板|Plugin panels)$/ });
  if (await panel.isVisible()) await panel.getByRole('button', { name: /^(返回聊天|Back to chat)$/ }).click();
  const close = remote.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  if (!await remote.getByRole('region', { name: 'Conversation', exact: true }).count()) {
    await remote.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
  }
  assert.equal(await remote.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = remote.getByRole('textbox', { name: /^(消息|Message)$/, exact: true });
  await remote.getByRole('article', { name: 'Assistant response', exact: true }).first().waitFor({ timeout: 60000 });
  draft = await editor.innerText();
  const attachment = remote.getByRole('button', { name: /^View attachment dshm-office-attachment-1790193112958\.corrupt\.docx$/ }).first();
  for (let count = 0; !await attachment.count() && count < 25; count++) {
    const older = remote.getByRole('button', { name: 'Load earlier messages', exact: true });
    if (!await older.count()) break;
    await older.click();
    await remote.waitForFunction(() => ![...document.querySelectorAll('button')].some(b => b.textContent === 'Load earlier messages' && b.disabled));
  }
  await attachment.click();
  const failure = panel.locator('.remote-document-tab:not([hidden]) [data-textpreview-failed]');
  await failure.waitFor({ timeout: 90000 });
  const origin = await remote.evaluate(() => performance.timeOrigin);
  const held = await failure.elementHandle();
  for (const locale of ['en', 'zh', 'en']) {
    await language(locale);
    const expected = locale === 'en'
      ? 'Could not preview the document. Check the computer connection, file contents and permissions, then try again.'
      : '无法预览此文档，请检查电脑连接、文件内容和访问权限后重试。';
    report.samples[locale] = await failure.innerText();
    await remote.screenshot({ path: `artifacts/${prefix}-${locale}-android.png` });
    assert.ok(report.samples[locale].includes(expected), report.samples[locale]);
    assert.equal(await held.evaluate(element => element.isConnected), true);
    assert.equal(await remote.evaluate(() => performance.timeOrigin), origin);
    assert.equal(await panel.locator('canvas').count(), 0);
  }
  report.samePageAndFailure = true;
  await panel.getByRole('button', { name: /^(返回聊天|Back to chat)$/ }).click();
  await remote.getByRole('button', { name: 'View attachment dshm-office-attachment-1790193112958.docx', exact: true }).first().click();
  const current = panel.locator('.remote-document-tab:not([hidden])');
  await current.locator('[data-pdf-text]').getByText(/Office preview/).first().waitFor({ timeout: 90000 });
  const canvas = await current.locator('canvas').first().elementHandle();
  assert.ok(await canvas.evaluate(element => element.width > 0 && element.height > 0));
  await language('zh');
  assert.equal(await canvas.evaluate(element => element.isConnected), true);
  report.successfulPreviewPreserved = true;
  await panel.getByRole('button', { name: /^(返回聊天|Back to chat)$/ }).click();
  assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (original) {
    try {
      await language(original === 'en' ? 'en' : 'zh');
      const back = remote.getByRole('region', { name: /^(插件面板|Plugin panels)$/ }).getByRole('button', { name: /^(返回聊天|Back to chat)$/ });
      if (await back.isVisible()) await back.click();
      report.languageRestored = true;
      await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
      await phone.getByRole('button', { name: /^(退出设置|Close settings)$/ }).click();
      report.ordinaryHomeRestored = true;
    } catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
  }
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
