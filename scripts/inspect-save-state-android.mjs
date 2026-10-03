import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  const report = { panel: await page.getByRole('region', { name: '插件面板', exact: true }).innerText(),
    dialogs: await page.getByRole('dialog').allTextContents() };
  await device.shell('uiautomator dump /data/local/tmp/dshm-save-state.xml');
  report.native = (await device.shell('cat /data/local/tmp/dshm-save-state.xml')).toString();
  if (process.argv.includes('--dismiss-sharing')) {
    if (!report.native.includes('resource-id="android:id/chooser_header"')) throw new Error('Expected actual share chooser');
    await device.shell('input keyevent 4');
    await page.getByRole('region', { name: '插件面板', exact: true }).getByText('已保存到所选位置。', { exact: true }).waitFor();
    report.afterDismiss = await page.getByRole('region', { name: '插件面板', exact: true }).innerText();
  }
  report.downloads = (await device.shell('ls -lt /sdcard/Download')).toString();
  await device.screenshot({ path: 'artifacts/save-death-state.png' });
  await writeFile('artifacts/save-death-state.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ panel: report.panel, afterDismiss: report.afterDismiss,
    nativeTexts: [...report.native.matchAll(/ text="([^"]+)"/g)].map(item => item[1]) }));
} finally { await device.close(); }
