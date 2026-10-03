import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只验证入口提示。固定无效材料不会领取配对；正常包必须已有绑定。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const pkg = 'dev.dshmobile.validation', report = { at: new Date().toISOString(), checks: [] };
let phone, original;
async function nativeNodes() {
  await device.shell('uiautomator dump /data/local/tmp/dshm-pairing-language.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-pairing-language.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === pkg);
}
async function closeNotice() {
  const nodes = await nativeNodes(), button = nodes.find(node => node['resource-id'] === 'android:id/button1');
  if (!button) return;
  const [x1, y1, x2, y2] = button.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
}
async function language(value) {
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
  await phone.getByRole('dialog').getByRole('button', { name: value === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
  await phone.getByRole('dialog').waitFor({ state: 'detached' });
  await phone.waitForFunction(value => document.documentElement.lang === value, value === 'en' ? 'en' : 'zh-CN');
}
try {
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const startupDeadline = Date.now() + 15000;
  while (!(await device.shell(`pidof ${pkg}`)).toString().trim()) {
    assert.ok(Date.now() < startupDeadline, 'App did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const first = await (await androidAppWebView(device)).page();
  phone = first.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone); phone.setDefaultTimeout(15000);
  await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).waitFor();
  original = await phone.evaluate(() => document.documentElement.lang);
  await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).click();
  await phone.getByRole('button', { name: /^(设置|Settings)$/ }).click();
  await phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ }).click();
  for (const lang of ['en', 'zh']) {
    await language(lang);
    for (const [kind, uri, title] of [
      ['invalid', 'dshm://pair', lang === 'en' ? 'Invalid pairing link' : '配对链接无效'],
      ['bound', `dshm://pair?server=http%3A%2F%2F127.0.0.1%3A8787#key=${'x'.repeat(43)}`, lang === 'en' ? 'Computer already paired' : '已连接电脑'],
    ]) {
      await device.shell(`am start -W -n ${pkg}/.PairingEntryActivity -a android.intent.action.VIEW -d '${uri}'`);
      const nodes = await nativeNodes();
      assert.ok(nodes.some(node => node.text === title), `${lang}/${kind} title`);
      assert.ok(nodes.some(node => node['resource-id'] === 'android:id/button1' && node.text === (lang === 'en' ? 'OK' : '知道了')));
      assert.ok(nodes.some(node => node.text.includes(kind === 'invalid'
        ? lang === 'en' ? 'Use the complete pairing link' : '请使用电脑'
        : lang === 'en' ? 'The current pairing stays unchanged' : '当前绑定保持不变')));
      await device.screenshot({ path: `artifacts/pairing-language-${lang}-${kind}.png` });
      report.checks.push({ language: lang, kind, title });
      await closeNotice();
    }
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  try {
    await closeNotice();
    if (phone && original) {
      await language(original.startsWith('en') ? 'en' : 'zh');
      await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
      await phone.getByRole('button', { name: /^(退出设置|Close settings)$/ }).click();
      report.languageRestored = true;
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  await writeFile('artifacts/pairing-language-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
