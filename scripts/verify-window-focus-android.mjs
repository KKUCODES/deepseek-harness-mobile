import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const serial = 'emulator-5556', pkg = 'dev.dshmobile.validation';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === serial);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), samples: [], errors: [] };
async function sample(page, name, activity) {
  const dump = (await device.shell('dumpsys window')).toString();
  const focus = dump.split('\n').find(line => line.includes('mCurrentFocus='));
  assert.ok(focus?.includes(activity), 'App must actually own the focused window');
  const section = dump.split(/Window #\d+/).find(value => value.includes(activity) && value.includes('mHasSurface=true') && !value.includes('Starting '));
  assert.ok(section);
  const appearance = section.split('\n').filter(line => /appearance=|LIGHT_STATUS|LIGHT_NAVIGATION/.test(line)).map(line => line.trim()).join(' ');
  const dark = await page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'));
  report.samples.push({ name, appearance, dark });
  await writeFile(`artifacts/window-focus-${name}.png`, await device.screenshot());
}
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  await sample(ordinary, 'ordinary-cold', '.ValidationActivity');
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened;
  page.on('pageerror', () => report.errors.push('page-error'));
  const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
  await input.waitFor(); await sample(page, 'remote-cold', '.RemoteActivity');
  await input.fill('preserve draft'); await input.blur();
  const started = await page.evaluate(() => performance.timeOrigin);
  await device.shell(`pm grant ${pkg} android.permission.CAMERA`);
  await page.getByRole('button', { name: '扫描二维码', exact: true }).click();
  await device.shell('uiautomator dump /data/local/tmp/dshm-window-focus.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-window-focus.xml')).toString();
  assert.ok(xml.includes('zxing_barcode_scanner'), 'Real native camera must open');
  await device.shell('input keyevent 4');
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(n => n.textContent === '扫描二维码')?.disabled);
  await sample(page, 'remote-camera-return', '.RemoteActivity');
  assert.equal(await input.inputValue(), 'preserve draft');
  assert.equal(await page.evaluate(() => performance.timeOrigin), started);
  report.draftAndPagePreserved = true;
  for (const row of report.samples) {
    assert.equal(row.appearance.includes('LIGHT_STATUS_BARS'), !row.dark, row.name);
    assert.equal(row.appearance.includes('LIGHT_NAVIGATION_BARS'), !row.dark, row.name);
  }
  assert.deepEqual(report.errors, []);
} catch(error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`pm revoke ${pkg} android.permission.CAMERA`);
  await writeFile('artifacts/window-focus-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
