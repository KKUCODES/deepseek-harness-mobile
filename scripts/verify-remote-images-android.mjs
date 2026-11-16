import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { _android } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { checkRemoteImages } from './check-remote-images.mjs';
import { checkRemoteBackNavigation } from './check-remote-back-navigation.mjs';
import { checkRemoteReasoning } from './check-remote-reasoning.mjs';
import { androidAppWebView } from './android-app-webview.mjs';

// 同一正式页面与回归入口，在独立调试UID的WebView运行；不改正式配对或聊天。
const alpha2 = process.argv.includes('--alpha2');
const rc3 = process.argv.includes('--rc3');
const sdk = rc3 ? '0.2.2-rc.3' : alpha2 ? '0.2.1-alpha.2' : '0.2.1-rc.2';
const reasoning = process.argv.includes('--reasoning'), aside = process.argv.includes('--aside-history');
const kind = reasoning ? `reasoning${aside ? '-aside' : ''}` : 'images';
const directory = rc3 ? 'artifacts/tests/remote-plugin-slots' : `artifacts/tests/preview15-history/${sdk}-candidate-${kind}`;
const applicationId = rc3 ? 'dev.dshmobile.validation.rc3test' : 'dev.dshmobile.validation.rc21test';
const serial = process.env.DSHM_ANDROID_SERIAL ?? 'emulator-5554';
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true });
// 新进程隔离Cordis/平台全局，避免重复注入与上一次测试的异步初始化相互污染。
run('shell', 'am', 'force-stop', applicationId);
run('shell', 'am', 'start', '-n', `${applicationId}/dev.dshmobile.validation.ValidationActivity`);
await new Promise(resolve => setTimeout(resolve, 1000));
const device = (await _android.devices({ omitDriverInstall: true })).find(device => device.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { sdk, source: 'Actual RemoteWorkspace and Session in MuMu isolated WebView; synthetic protocol', errors: [] };
try {
  let page = await (await androidAppWebView(device, applicationId)).page();
  page.setDefaultTimeout(20000);
  if (!page.url().startsWith('https://remote.dshm.invalid/')) {
    await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opened;
    await page.waitForFunction(() => typeof window.dshmHandleBack === 'function');
  }
  console.log('native:attached');
  page.setDefaultTimeout(20000); await page.waitForTimeout(1000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.evaluate(() => { delete window.fixture; delete window.preview15; history.replaceState(null, '', location.pathname); });
  console.log('native:reset');
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div>');
  const origin = new URL(page.url()).origin;
  const css = (await readFile(`${directory}/test.css`, 'utf8')).replace(/url\(["']?(?:\.\/)?(JetBrainsMono[^)"']+)["']?\)/g,
    `url("${origin}/assets/web/$1")`);
  await page.addStyleTag({ content: css });
  if (rc3) for (const path of ['src/ui/mobile.css', 'src/ui/ordinary-product.css', 'docs/design/ordinary-preview/remote.css', 'src/ui/remote-product.css']) {
    await page.addStyleTag({ content: await readFile(path, 'utf8') });
  }
  console.log('native:styles');
  // Remote页禁止inline module；使用其明确允许的Function执行隔离打包产物，不放宽CSP。
  const bundled = await readFile(`${directory}/test.js`, 'utf8');
  const { code } = await transform(bundled, { define: { 'import.meta.url': JSON.stringify(page.url()), 'import.meta.env': '{"MODE":"production"}' } });
  await page.evaluate(code => Function(`return (async()=>{${code}\n})()`)(), code);
  console.log('native:script');
  await page.waitForFunction(() => !!window.preview15?.images);
  if (reasoning) report.reasoning = await checkRemoteReasoning(page, { aside });
  else if (process.argv.includes('--navigation')) report.navigation = await checkRemoteBackNavigation(page, { systemBack: () => run('shell', 'input', 'keyevent', '4') });
  else report.images = await checkRemoteImages(page, { alpha2, fallbackOnly: rc3, systemBack: () => run('shell', 'input', 'keyevent', '4') });
  report.actualRemoteActivity = true;
  if (!reasoning) report.actualRemoteActivityBack = true;
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `artifacts/${reasoning ? kind + '-fix' : 'image-fix'}-native-${sdk}.png` });
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await writeFile(`artifacts/${reasoning ? kind + '-fix' : 'image-fix'}-native-${sdk}${process.argv.includes('--navigation') ? '-navigation' : ''}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  // MuMu同时暴露TCP和emulator别名，成功断开后ADB监听可能仍未结算。
  await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 1000))]);
}
process.exit(0);
