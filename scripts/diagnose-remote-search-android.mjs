import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  await page.evaluate(() => {
    const bridge = globalThis.DSHMRemote, original = bridge.onmessage;
    globalThis.searchDiagnostic = { errors: [], restore: () => { bridge.onmessage = original; } };
    bridge.onmessage = event => {
      const value = JSON.parse(event.data).event;
      if (value?.type === 'error' || value?.value?.ok === false) globalThis.searchDiagnostic.errors.push({ type: value.type, code: value.code ?? value.value.error?.code, message: value.value?.error?.message });
      return original.call(bridge, event);
    };
  });
  try {
    await page.getByRole('button', { name: '重新搜索', exact: true }).click();
    await page.waitForFunction(() => globalThis.searchDiagnostic.errors.length > 0, { timeout: 40000 });
    console.log(JSON.stringify(await page.evaluate(() => globalThis.searchDiagnostic.errors)));
  } finally { await page.evaluate(() => { globalThis.searchDiagnostic.restore(); delete globalThis.searchDiagnostic; }); }
} finally { await device.close(); }
