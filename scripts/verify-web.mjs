import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, _android } from 'playwright';
import { createValidationServer } from './serve.mjs';
import { checkInput } from './check-input.mjs';
import { checkStream } from './check-stream.mjs';
import { checkTheme } from './check-theme.mjs';
import { checkOrdinary } from './check-ordinary.mjs';
import { checkOrdinaryInput } from './check-ordinary-input.mjs';

const androidSerial = process.env.DSHM_ANDROID_SERIAL;
const server = androidSerial ? undefined : createValidationServer();
if (server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
}
let browser;
let device;
const errors = [];
try {
  let page;
  if (androidSerial) {
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === androidSerial);
    if (!device) throw new Error('Android device not connected');
    device.setDefaultTimeout(15000);
    await device.shell('am force-stop dev.dshmobile.validation');
    await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
    page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  } else {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
  }
  page.on('pageerror', error => errors.push(error.message));
  await page.getByTestId('ready').waitFor();
  const ordinary = await checkOrdinary(page, !!androidSerial);
  ordinary.inputPlugin = await checkOrdinaryInput(page);
  if (await page.getByRole('button', { name: 'English', exact: true }).count()) {
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('menuitem', { name: '中文', exact: true }).click();
  }
  await page.getByRole('button', { name: '深色', exact: true }).click();
  const fontSize = await page.evaluate(() => window.dshmValidation.snapshot().settings.value.fontSize);
  for (let count = 0; count < Math.abs(15 - fontSize); count++) {
    await page.getByRole('button', { name: fontSize < 15 ? '增大字号' : '减小字号', exact: true }).click();
  }
  await page.waitForFunction(() => window.dshmValidation.snapshot().settings.value.fontSize === 15);
  await page.reload();
  await page.getByTestId('ready').waitFor();
  assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().settings.value), { preference: 'dark', fontSize: 15 });
  await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
  assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--dsh-content-font-size')), '15px');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await page.getByRole('menuitem', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).waitFor();
  await page.reload();
  await page.getByTestId('ready').waitFor();
  await page.getByRole('button', { name: 'English', exact: true }).waitFor();
  assert.equal(await page.locator('[data-live-client]').innerText(), 'Live plugin enabled');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('menuitem', { name: '中文', exact: true }).click();
  await page.getByRole('button', { name: '中文', exact: true }).waitFor();
  await page.locator('[data-live-config] input').fill('真实上游配置表单');
  await page.locator('[data-live-config] button').click();
  assert.equal(await page.evaluate(() => window.dshmValidation.snapshot().counters.liveSaves), '1');

  const timings = [];
  // 走用户实际按钮和 Modules.entries.sync，不直接删 DOM 或手工清理插件副作用。
  for (let index = 0; index < 20; index++) {
    await page.evaluate(() => window.dispatchEvent(new Event('dsh-fixture-ping')));
    const hits = await page.evaluate(() => window.dshmValidation.snapshot().counters.liveHits);
    assert.equal(Number(hits), index + 1);
    const start = performance.now();
    await page.getByTestId('fixture-toggle').click();
    await page.getByRole('button', { name: '重新加载样例插件', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-live-client]'));
    const absent = await page.evaluate(() => window.dshmValidation.snapshot());
    assert.equal(absent.fixtureStyles, 0);
    assert.equal(Number(absent.counters.liveDisposals), index + 1);
    assert.equal(await page.locator('[data-live-config]').count(), 0);
    await page.evaluate(() => window.dispatchEvent(new Event('dsh-fixture-ping')));
    assert.equal(await page.evaluate(() => window.dshmValidation.snapshot().counters.liveHits), hits);
    await page.getByTestId('fixture-toggle').click();
    await page.locator('[data-live-client]').waitFor();
    const restored = await page.evaluate(() => window.dshmValidation.snapshot());
    assert.equal(restored.fixtureStyles, 1);
    assert.equal(Number(restored.counters.liveMounts), index + 2);
    assert.deepEqual(restored.failures, []);
    timings.push(performance.now() - start);
  }
  const input = await checkInput(page);
  const stream = await checkStream(page);
  const theme = await checkTheme(page);
  const snapshot = await page.evaluate(() => window.dshmValidation.snapshot());
  assert.deepEqual([...errors, ...snapshot.errors], []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mkdir('artifacts', { recursive: true });
  const prefix = androidSerial ? 'android' : 'browser';
  await page.screenshot({ path: `artifacts/${prefix}-plugins.png`, fullPage: true });
  let restartVerified = false;
  if (device) {
    await device.shell('am force-stop dev.dshmobile.validation');
    await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
    page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
    await page.getByTestId('ready').waitFor();
    assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().settings.value), { preference: 'dark', fontSize: 15 });
    await page.getByRole('button', { name: '中文', exact: true }).waitFor();
    await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
    assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().errors), []);
    restartVerified = true;
    await device.screenshot({ path: 'artifacts/android-device.png' });
  }
  const runtime = await page.evaluate(() => ({ userAgent: navigator.userAgent, width: innerWidth, height: innerHeight }));
  const result = { environment: device ? 'Android WebView; device/emulator must be identified separately, NOT target-phone performance' : 'Windows desktop Edge headless; NOT Android performance',
    browser: browser?.version(), androidSerial, androidModel: device?.model(), runtime, restartVerified, input, stream, theme, ordinary,
    testedAt: new Date().toISOString(), cycles: timings.length, lifecycleRoundTripMs: timings, snapshot,
    verified: ['theme and font persistence after reload', 'locale switch persists and updates original plugin text', 'upstream config submit', '20 actual unload/reload cycles', 'style, listener and slot cleanup', 'no horizontal overflow'] };
  await writeFile(`artifacts/${prefix}-verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: result.verified, cycles: result.cycles, runtime, restartVerified, input, stream, theme, ordinary }));
} finally {
  await device?.close();
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
