import { _android } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device, 'Target Android device is not connected');
device.setDefaultTimeout(15000);
let page;
try {
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
  page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.context().addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes;
    const measurements = { supported, lcpMs: null, cls: 0, longTasks: [] };
    let session = { start: 0, last: 0, value: 0 };
    if (supported.includes('largest-contentful-paint')) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) measurements.lcpMs = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    if (supported.includes('layout-shift')) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        if (entry.startTime - session.last > 1000 || entry.startTime - session.start > 5000) {
          session = { start: entry.startTime, last: entry.startTime, value: entry.value };
        } else { session.value += entry.value; session.last = entry.startTime; }
        measurements.cls = Math.max(measurements.cls, session.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
    if (supported.includes('longtask')) new PerformanceObserver(list => {
      measurements.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
    }).observe({ type: 'longtask', buffered: true });
    window.dshmPageMeasurements = measurements;
  });
  const runs = [];
  for (const plugins of ['off', 'on']) for (let run = 1; run <= 3; run++) {
    await page.goto(`https://appassets.androidplatform.net/assets/web/index.html?optional-plugins=${plugins}`);
    await page.getByTestId('ready').waitFor();
    await page.getByRole('textbox', { name: '普通聊天消息', exact: true }).waitFor();
    const readyMs = await page.evaluate(() => performance.now());
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => ({ ...window.dshmPageMeasurements,
      fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      userAgent: navigator.userAgent, width: innerWidth, height: innerHeight,
      errors: window.dshmValidation.snapshot().errors,
    }));
    assert.deepEqual(result.errors, []);
    assert.ok(Number.isFinite(result.fcpMs) && Number.isFinite(result.lcpMs));
    runs.push({ plugins, run, readyObservedMs: readyMs, ...result });
  }
  await mkdir('artifacts/performance', { recursive: true });
  await writeFile('artifacts/performance/android-page.json', JSON.stringify({ testedAt: new Date().toISOString(), serial,
    environment: 'User MuMu Android 12; APK local assets; existing local settings/history; no throttling or model request. Reloads, NOT cold Activity launch or physical phone.',
    method: 'PerformanceObserver FCP/LCP/CLS over navigation + ready + 2s. Raw long tasks are diagnostic, NOT Lighthouse TBT. Ready is observed by external automation.', runs }, null, 2));
  console.log(JSON.stringify(runs.map(({ plugins, run, fcpMs, lcpMs, cls }) => ({ plugins, run, fcpMs, lcpMs, cls }))));
} finally {
  if (page) await page.goto('https://appassets.androidplatform.net/assets/web/index.html').catch(() => {});
  await device.close();
}
