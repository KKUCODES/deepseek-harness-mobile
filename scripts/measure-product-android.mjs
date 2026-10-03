import { _android } from 'playwright';
import { writeFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { androidAppWebView } from './android-app-webview.mjs';
const device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
let page;
const wasRemote = (await device.shell('dumpsys activity activities')).toString()
  .split('\n').some(line => line.includes('topResumedActivity=') && line.includes('dev.dshmobile.validation/.RemoteActivity'));
try {
  await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(page);
  assert.match(page.url(), /mobile.html$/);
  await page.context().addInitScript(() => {
    const result = { lcp: null, cls: 0, longTaskOver50ms: 0 }; window.productMetrics = result;
    for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) if (PerformanceObserver.supportedEntryTypes.includes(type)) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (type === 'largest-contentful-paint') result.lcp = entry.startTime;
        if (type === 'layout-shift' && !entry.hadRecentInput) result.cls += entry.value;
        if (type === 'longtask') result.longTaskOver50ms += Math.max(0, entry.duration - 50);
      }
    }).observe({ type, buffered: true });
  });
  const runs = [];
  for (let i = 0; i < 3; i++) {
    await page.reload(); await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    await page.waitForTimeout(2000);
    const values = await page.evaluate(() => ({ ...window.productMetrics, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime }));
    assert.ok(values.fcp > 0 && values.lcp > 0); runs.push(values);
  }
  const report = { at: new Date().toISOString(), environment: 'MuMu Android WebView, actual mobile.html, 3 reloads with local history and plugins. Not physical-device cold startup or Lighthouse TBT.', apkBytes: (await stat('android/app/build/outputs/apk/debug/app-debug.apk')).size, runs };
  await writeFile('artifacts/ordinary-product-performance.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  if (wasRemote && page) {
    await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await page.getByRole('button', { name: 'Remote', exact: true }).click();
  }
  await device.close();
}
