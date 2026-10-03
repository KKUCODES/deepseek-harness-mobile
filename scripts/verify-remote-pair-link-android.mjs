import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 固定无效 key；新安装的隔离包验证未绑定入口，不清除或替换用户的真实身份。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const main = 'dev.dshmobile.validation', isolated = main + '.pairingtest';
const key = 'A'.repeat(43), canonical = `http://127.0.0.1:8787/pair#key=${key}`;
const deepLink = `dshm://pair?server=${encodeURIComponent('http://127.0.0.1:8787')}#key=${key}`;
const report = { at: new Date().toISOString(), errors: [], isolatedPackage: isolated };
const view = async (pkg, url) => device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${url}' -p ${pkg}`);
const share = async url => device.shell(`am start -W -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT '${url}' -p ${isolated}`);
async function notice(text) {
  await device.shell('uiautomator dump /data/local/tmp/dshm-pair-link-test.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-pair-link-test.xml')).toString();
  assert.ok(xml.includes(`text="${text}"`));
  await device.shell('input keyevent 4');
}
let fixture;
try {
  const ordinary = await (await androidAppWebView(device)).page();
  const context = ordinary.context();
  let remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  if (!remote) {
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  }
  await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  remote.setDefaultTimeout(15000);
  const heading = remote.getByTestId('remote-workspace').locator('.remote-heading');
  const editor = remote.getByRole('textbox', { name: '消息', exact: true });
  const draft = async () => await editor.count() ? editor.inputValue() : null;
  const before = { title: await heading.innerText(), draft: await draft() };
  await view(main, deepLink); await notice('已连接电脑');
  assert.equal(await heading.innerText(), before.title);
  assert.equal(await draft(), before.draft);
  report.existingBindingUnchanged = true;

  await device.shell(`am force-stop ${isolated}`);
  await share(canonical);
  const first = await (await androidAppWebView(device, isolated)).page();
  fixture = first.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  if (!fixture) fixture = await first.context().waitForEvent('page', { predicate: page => page.url().startsWith('https://remote.dshm.invalid/') });
  fixture.setDefaultTimeout(15000);
  fixture.on('pageerror', error => report.errors.push(error.message));
  const input = fixture.getByRole('textbox', { name: '一次性配对链接', exact: true });
  await input.waitFor();
  assert.equal(await input.inputValue(), canonical);
  assert.equal(await fixture.getByRole('button', { name: '继续配对', exact: true }).isEnabled(), true);
  await fixture.getByText('HTTP 连接未加密，建议使用 HTTPS。', { exact: true }).waitFor();
  assert.equal(await fixture.getByRole('alert').count(), 0);
  report.sharedLinkPrefilledWithoutClaim = true;
  const secure = `https://example.com/pair#key=${key}`;
  report.warmLaunch = (await share(secure)).toString();
  await fixture.waitForFunction(expected => document.querySelector('input[aria-label="一次性配对链接"]')?.value === expected, secure);
  assert.equal(first.context().pages().filter(page => page.url().startsWith('https://remote.dshm.invalid/')).length, 1);
  assert.equal(await fixture.getByText('HTTP 连接未加密，建议使用 HTTPS。', { exact: true }).count(), 0);
  report.warmLinkSamePage = true;
  await fixture.reload(); await input.waitFor();
  assert.equal(await input.inputValue(), '');
  report.handoffConsumedOnce = true;
  await view(isolated, `dshm://pair?server=file%3A%2F%2Fexample.com#key=${key}`); await notice('配对链接无效');
  assert.equal(await input.inputValue(), '');
  report.invalidSchemeRejected = true;
  await view(isolated, deepLink);
  await fixture.waitForFunction(expected => document.querySelector('input[aria-label="一次性配对链接"]')?.value === expected, canonical);
  await input.fill(deepLink);
  await fixture.getByText('HTTP 连接未加密，建议使用 HTTPS。', { exact: true }).waitFor();
  await fixture.getByText('服务器：http://127.0.0.1:8787', { exact: true }).waitFor();
  await fixture.getByRole('button', { name: '继续配对', exact: true }).click();
  await fixture.getByRole('alert').filter({ hasText: '链接已过期或已被领取，请在电脑上生成新链接。' }).waitFor({ timeout: 30000 });
  assert.equal(await input.inputValue(), '');
  assert.equal(await fixture.getByRole('heading', { name: '等待电脑批准', exact: true }).count(), 0);
  report.realGatewayInvalidKeyRejected = true;
  report.pastedAppLinkHttpWarning = true;
  await fixture.screenshot({ path: 'artifacts/remote-pair-link-invalid-android.png' });
  const ordinaryOpened = first.context().waitForEvent('page');
  await fixture.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  const ordinaryAfter = await ordinaryOpened;
  await ordinaryAfter.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  report.coldEntryBackToOrdinary = true;
  assert.deepEqual(report.errors, []);
  await writeFile('artifacts/remote-pair-link-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  report.fixturePages = await Promise.all((fixture?.context().pages() ?? []).map(async page => ({ url: page.url(), input: await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).inputValue({ timeout: 1000 }).catch(() => null) })));
  await writeFile('artifacts/remote-pair-link-android-failure.json', JSON.stringify({ ...report, failure: error.message }, null, 2));
  throw error;
} finally {
  await device.shell(`am force-stop ${isolated}`);
  await view(main, deepLink); await notice('已连接电脑');
  await device.close();
}
