import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], samples: {} };
let phone, remote, original;
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
async function settings() {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 20000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) await pause();
  do {
    phone = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
    if (!phone) await pause();
  } while (!phone && Date.now() < deadline);
  assert.ok(phone); phone.setDefaultTimeout(20000);
  const sidebar = phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ });
  await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar|退出设置|Close settings|返回设置首页|Back to settings)$/ }).waitFor();
  if (await sidebar.count()) {
    await sidebar.click();
    await phone.getByRole('button', { name: /^(设置|Settings)$/ }).click();
  }
  const appearance = phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ });
  if (await appearance.count()) await appearance.click();
  await phone.locator('.settings-font output').waitFor();
  return phone;
}
async function language(value) {
  await settings();
  await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
  await phone.getByRole('dialog').getByRole('button', { name: value === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
  await phone.getByRole('dialog').waitFor({ state: 'detached' });
  await phone.waitForFunction(value => document.documentElement.lang === value, value === 'en' ? 'en' : 'zh-CN');
  await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
  await phone.getByRole('button', { name: /^(电脑连接|Computer connection)$/ }).click();
  const deadline = Date.now() + 20000;
  do {
    remote = phone.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) await pause();
  } while (!remote && Date.now() < deadline);
  assert.ok(remote); remote.setDefaultTimeout(25000);
  await remote.getByTestId('remote-workspace').waitFor();
  await remote.waitForFunction(value => document.documentElement.lang === value, value === 'en' ? 'en' : 'zh-CN');
  return remote;
}
try {
  await settings(); original = await phone.evaluate(() => document.documentElement.lang);
  let origin;
  for (const locale of ['en', 'zh']) {
    await language(locale);
    if (!origin) { origin = await remote.evaluate(() => performance.timeOrigin); remote.on('pageerror', error => report.errors.push(error.message)); }
    assert.equal(await remote.evaluate(() => performance.timeOrigin), origin);
    const heading = remote.getByRole('heading', { name: /^(项目|Projects)$/, exact: true });
    if (!await heading.count()) await remote.locator('.remote-app:not([hidden])').getByRole('button', { name: /^(返回|Back)$/, exact: true }).click();
    await heading.waitFor();
    await remote.locator('.remote-session-row').first().waitFor();
    report.samples[locale] = await remote.locator('.remote-session-row').evaluateAll(rows => rows.slice(0, 5).map(row => ({ title: row.querySelector('.remote-session-summary > span').textContent, date: row.querySelector('small').textContent, timestamp: row.querySelector('time')?.dateTime })));
    await remote.screenshot({ path: `artifacts/remote-list-locale-${locale}-android.png` });
  }
  const pairs = report.samples.en.map(row => [row, report.samples.zh.find(other => other.title === row.title && other.timestamp === row.timestamp)]).filter(([en, zh]) => zh && en.date !== 'In progress' && zh.date !== '进行中');
  assert.ok(pairs.length);
  assert.equal(pairs.length, report.samples.en.filter(row => row.date !== 'In progress').length);
  assert.ok(pairs.some(([en, zh]) => en.date !== zh.date), '日期应随 App 语言即时切换，而不是沿用 WebView 默认语言');
  for (const [en, zh] of pairs) {
    assert.ok(en.timestamp); assert.equal(en.timestamp, zh.timestamp);
    for (const [locale, row] of [['en', en], ['zh-CN', zh]]) {
      const expected = await remote.evaluate(({ locale, timestamp }) => new Date(timestamp).toLocaleDateString(locale), { locale, timestamp: row.timestamp });
      assert.equal(row.date, expected);
    }
  }
  report.samePage = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (original) {
    try {
      await language(original === 'en' ? 'en' : 'zh'); report.languageRestored = true;
      await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
      await phone.getByRole('button', { name: /^(退出设置|Close settings)$/ }).click();
      await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).waitFor();
      report.ordinaryHomeRestored = true;
    }
    catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
  }
  await writeFile('artifacts/remote-list-locale-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
