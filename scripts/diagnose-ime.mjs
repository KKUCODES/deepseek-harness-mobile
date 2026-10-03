import { _android } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// 只检查本验证包与当前 IME 的窗口几何，不收集输入内容、其他 App 的窗口或完整系统日志。
const serial = process.env.DSHM_ANDROID_SERIAL;
if (!serial) throw new Error('Set DSHM_ANDROID_SERIAL to the intended connected test device');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
if (!device) throw new Error('Requested device not connected');
device.setDefaultTimeout(15000);
const shell = async command => (await device.shell(command)).toString('utf8');
const geometry = block => {
  if (!block) return null;
  const frame = /mFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(block);
  return { displayId: Number(/mDisplayId=(\d+)/.exec(block)?.[1]),
    frame: frame ? frame.slice(1).map(Number) : null,
    height: frame ? Number(frame[4]) - Number(frame[2]) : null,
    visible: /isVisible=true/.test(block) };
};
async function inspect() {
  const windows = (await shell('dumpsys window windows')).split(/(?=  Window #\d+ )/);
  const ime = geometry(windows.find(block => /^  Window #\d+ Window\{[^\n]* InputMethod\}/.test(block)));
  const app = geometry(windows.find(block => /^  Window #\d+ Window\{[^\n]* dev\.dshmobile\.validation\//.test(block)));
  const service = await shell('dumpsys input_method');
  return { ime, app, requested: /mShowRequested=true/.test(service), inputShown: /mInputShown=true/.test(service),
    inputViewShown: /mIsInputViewShown=true/.test(service),
    editor: /mServedView=android\.webkit\.WebView/.test(service) ? 'WebView' : /mServedView=android\.widget\.EditText/.test(service) ? 'EditText' : 'unknown' };
}
async function observe() {
  let result;
  const deadline = Date.now() + 3000;
  do {
    result = await inspect();
    if (result.ime?.visible && result.ime.height > 0) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  return result;
}
try {
  await mkdir('artifacts', { recursive: true });
  await shell('am start -f 0x24000000 -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByTestId('ready').waitFor();
  await page.getByRole('textbox', { name: '输入增强验证草稿', exact: true }).click();
  const web = { ...await observe(), viewport: await page.evaluate(() => ({ height: innerHeight, visual: visualViewport.height })) };
  await device.screenshot({ path: 'artifacts/ime-webview.png' });
  // 原生对照从新进程直接启动，排除此前 WebView/插件留下的进程内状态。
  await shell('am force-stop dev.dshmobile.validation');
  const launch = await shell('am start -n dev.dshmobile.validation/.NativeInputProbeActivity');
  if (/Error|Exception/.test(launch)) throw new Error('Install the debug APK containing NativeInputProbeActivity');
  const native = await observe();
  await device.screenshot({ path: 'artifacts/ime-native.png' });
  const result = { testedAt: new Date().toISOString(), serial,
    inputMethod: (await shell('settings get secure default_input_method')).trim(),
    showWithHardwareKeyboard: (await shell('settings get secure show_ime_with_hard_keyboard')).trim(),
    web, native, keyboardGeometryPassed: Boolean(web.ime?.visible && native.ime?.visible && web.ime.height > 0 && native.ime.height > 0),
    limitation: 'Geometry diagnostic only; not a Chinese composition, keyboard interaction or performance acceptance test' };
  await writeFile('artifacts/ime-diagnosis.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.keyboardGeometryPassed) process.exitCode = 2;
} finally {
  // 结束原生对照再返回验证页，避免诊断 Activity 留在返回栈；持久数据不清除。
  await shell('am force-stop dev.dshmobile.validation');
  await shell('am start -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
  await device.close();
}
