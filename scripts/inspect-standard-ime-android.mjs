import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const pkg = 'dev.dshmobile.validation.pairingtest';
const ordinaryMode = process.argv.includes('--ordinary');
const output = `artifacts/standard-ime${ordinaryMode ? '-ordinary' : ''}-android`;
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5556');
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), errors: [] };
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  let page = ordinary;
  if (!ordinaryMode) {
    const opened = ordinary.context().waitForEvent('page');
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opened;
  }
  page.on('pageerror', () => report.errors.push('page-error'));
  const input = page.getByRole('textbox', { name: ordinaryMode ? '消息' : '一次性配对链接', exact: true });
  await input.waitFor();
  const measure = () => page.evaluate(() => ({ height: innerHeight, visualHeight: visualViewport.height, width: innerWidth,
    inputBottom: document.querySelector('textarea,[contenteditable="true"],input')?.getBoundingClientRect().bottom }));
  report.before = await measure();
  await input.click();
  const deadline = Date.now() + 8000;
  do {
    report.after = await measure();
    if (report.after.visualHeight < report.before.visualHeight - 100) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  report.ime = (await device.shell('settings get secure default_input_method')).toString().trim();
  const dump = (await device.shell('dumpsys input_method')).toString();
  report.inputShown = /mInputShown=true/.test(dump);
  await device.screenshot({ path: `${output}.png` });
  assert.ok(report.after.visualHeight < report.before.visualHeight - 100, '真实软键盘必须缩小可视区域');
  assert.ok(report.after.inputBottom <= report.after.visualHeight, '配对输入框必须仍可见');
  report.visibleKeyboard = true;
  await device.shell('input keyevent 4');
  const restoreDeadline = Date.now() + 5000;
  do {
    report.restored = await measure();
    if (Math.abs(report.restored.visualHeight - report.before.visualHeight) < 2) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < restoreDeadline);
  assert.ok(Math.abs(report.restored.visualHeight - report.before.visualHeight) < 2, '收起键盘后恢复可用高度');
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await device.shell(`am force-stop ${pkg}`);
  await writeFile(`${output}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
