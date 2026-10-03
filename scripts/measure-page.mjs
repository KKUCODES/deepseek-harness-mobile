import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { createValidationServer } from './serve.mjs';

const product = process.argv.includes('--product');
const groups = product ? ['product'] : ['off', 'on'];

await mkdir('.tools/performance', { recursive: true });
await mkdir('artifacts/performance', { recursive: true });
const profile = await mkdtemp(resolve('.tools/performance/edge-'));
const server = createValidationServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, args: ['--remote-debugging-port=0'] });
  const port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
  const control = await browser.newCDPSession(browser.pages()[0]);
  const results = [];
  for (const plugins of groups) for (let index = 1; index <= 3; index++) {
    const url = `http://127.0.0.1:${server.address().port}/${product ? 'mobile.html' : `?optional-plugins=${plugins}`}`;
    // 只清理本脚本专用浏览器 profile 的临时 loopback origin，不接触用户 App/浏览器历史。
    await control.send('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'all' });
    const result = await lighthouse(url, { port, output: 'json', onlyCategories: ['performance'],
      formFactor: 'mobile', throttlingMethod: 'provided',
      screenEmulation: { mobile: true, width: 412, height: 915, deviceScaleFactor: 1.75, disabled: false } });
    assert.ok(result && !result.lhr.runtimeError, JSON.stringify(result?.lhr.runtimeError));
    const audits = result.lhr.audits;
    const metrics = Object.fromEntries(Object.entries({ fcpMs: 'first-contentful-paint', lcpMs: 'largest-contentful-paint',
      tbtMs: 'total-blocking-time', cls: 'cumulative-layout-shift' }).map(([key, id]) => [key, audits[id].numericValue]));
    assert.ok(Object.values(metrics).every(Number.isFinite));
    await writeFile(`artifacts/performance/lighthouse-${plugins}-${index}.json`, result.report);
    const item = { plugins, run: index, ...metrics, warnings: result.lhr.runWarnings,
      browserUserAgent: result.lhr.environment.hostUserAgent, lighthouseVersion: result.lhr.lighthouseVersion };
    results.push(item);
    console.log(JSON.stringify(item));
  }
  const summary = groups.map(plugins => {
    const runs = results.filter(item => item.plugins === plugins);
    const metrics = {};
    for (const key of ['fcpMs', 'lcpMs', 'tbtMs', 'cls']) {
      const values = runs.map(item => item[key]).sort((a, b) => a - b);
      metrics[key] = { median: values[1], worst: values[2] };
    }
    return { plugins, metrics, withinReference: metrics.fcpMs.worst <= 1800 && metrics.lcpMs.worst <= 2500 && metrics.tbtMs.worst <= 200 && metrics.cls.worst <= 0.1 };
  });
  await writeFile(`artifacts/performance/${product ? 'product-summary' : 'summary'}.json`, JSON.stringify({ testedAt: new Date().toISOString(),
    method: `Lighthouse navigation on isolated Edge mobile viewport, ${product ? 'actual mobile.html product UI' : 'diagnostic UI'}, loopback assets, provided CPU/network (no throttling). NOT phone hardware, model latency or field p75.`,
    reference: { fcpMs: 1800, lcpMs: 2500, tbtMs: 200, cls: 0.1 }, results, summary }, null, 2));
  console.log(JSON.stringify({ summary }));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
