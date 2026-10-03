import { chromium, _android } from 'playwright';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createValidationServer } from './serve.mjs';
import { checkProductLocal } from './check-product-local.mjs';
const serial = process.env.DSHM_ANDROID_SERIAL;
let server; let browser; let device;
const report = { at: new Date().toISOString(), environment: serial ? 'MuMu Android default APK' : 'Edge 375x667 actual product page (no native requests)' };
try {
  let page;
  if (serial) {
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial); assert.ok(device);
    device.setDefaultTimeout(15000); page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
    assert.match(page.url(), /mobile.html$/);
  } else {
    server = createValidationServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/mobile.html`);
  }
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByTestId('ordinary-product').waitFor();
  report.result = await checkProductLocal(page); assert.deepEqual(errors, []);
  report.passed = true;
  await page.screenshot({ path: `artifacts/ordinary-product-local-${serial ? 'android' : 'web'}.png` });
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally { await writeFile(`artifacts/ordinary-product-local-${serial ? 'android' : 'web'}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser?.close(); await device?.close(); server?.close(); }
