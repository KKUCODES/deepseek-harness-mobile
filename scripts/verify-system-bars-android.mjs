import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5556');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), samples: [], errors: [] };
let page, original;
async function capture(mode, target) {
  await target.emulateMedia({ colorScheme: null });
  const windowDump = (await device.shell('dumpsys window')).toString();
  const focus = windowDump.split('\n').find(line => line.includes('mCurrentFocus='));
  assert.ok(focus?.includes('dev.dshmobile.validation/'), '系统弹窗遮挡时不能判定实际视觉通过');
  const section = windowDump.split(/Window #\d+/).find(value => value.includes('mHasSurface=true') && value.includes('dev.dshmobile.validation/') && !value.includes('Starting '));
  assert.ok(section, '实际App窗口必须存在');
  const appearance = section.split('\n').filter(line => /appearance=|LIGHT_STATUS|LIGHT_NAVIGATION/.test(line)).map(line => line.trim()).join(' ');
  const sample = { mode, path: new URL(target.url()).pathname, appearance,
    dark: await target.evaluate(() => document.body.hasAttribute('data-ds-dark-theme')) };
  report.samples.push(sample);
  assert.equal(sample.dark, mode === 'dark');
  assert.equal(appearance.includes('LIGHT_STATUS_BARS'), mode === 'light');
  assert.equal(appearance.includes('LIGHT_NAVIGATION_BARS'), mode === 'light');
  await device.screenshot({ path: `artifacts/system-bars-${mode}-${sample.path.includes('remote') ? 'remote' : 'ordinary'}.png` });
}
try {
  page = await (await androidAppWebView(device)).page();
  page.on('pageerror', () => report.errors.push('page-error'));
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^外观与语言/ }).click();
  original = (await page.getByRole('button', { name: /^主题/ }).innerText()).replace('主题', '').trim();
  for (const [mode, label] of [['light', '浅色'], ['dark', '深色']]) {
    await page.getByRole('button', { name: /^主题/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.waitForFunction(dark => document.body.hasAttribute('data-ds-dark-theme') === dark, mode === 'dark');
    await capture(mode, page);
    await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
    await page.getByRole('button', { name: '电脑连接', exact: true }).click();
    let remote;
    for (let attempt = 0; attempt < 100 && !remote; attempt++) {
      remote = page.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
      if (!remote) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(remote); await remote.getByRole('textbox', { name: '一次性配对链接', exact: true }).waitFor();
    await capture(mode, remote);
    await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
    await page.getByRole('button', { name: /^外观与语言/ }).click();
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (original && page) {
    try {
      await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
      await page.getByRole('button', { name: /^主题/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: original, exact: true }).click();
      report.preferenceRestored = true;
    } catch { report.cleanupFailure = '只读模拟器外观恢复失败'; process.exitCode = 1; }
  }
  await writeFile('artifacts/system-bars-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
