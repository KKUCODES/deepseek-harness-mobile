import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..'), sdk = resolve(root, '../plugin/artifacts/ci/sdk/rc21');
const output = resolve(root, 'artifacts/rc21/loader-diagnosis'); await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(sdk, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
assert.equal(manifest.version, '0.2.1-rc.2');
const bundle = resolve(output, 'carrier.js');
const aliases = Object.fromEntries(['@deepseek-ai/cordis', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit'].map(name => [name, resolve(sdk, 'node_modules', name)]));
aliases['node:module'] = resolve(root, 'artifacts/rc21/source/apps/web/src/node-module-stub.ts');
await build({ entryPoints: [resolve(root, 'scripts/fixtures/rc21-startup.jsx')], outfile: bundle, bundle: true, format: 'iife',
  platform: 'browser', target: 'chrome100', alias: aliases, loader: { '.css': 'empty', '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl' },
  nodePaths: [resolve(sdk, 'node_modules'), resolve(root, 'node_modules')] });
const log = resolve(output, 'host.private.log'); await writeFile(log, '', { mode: 0o600 });
const env = { ...process.env, DSH_HOME: resolve(output, 'home'), DSH_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(env)) if (/^(NODE_OPTIONS|DSH_TELEMETRY_OTLP_URL|DEEPSEEK_API_KEY|OPENAI_API_KEY|DSH_MOBILE_)/.test(key)) delete env[key];
const host = spawn(process.execPath, [resolve(sdk, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), 'web', '--no-open', '--host', '127.0.0.1', '--port', '16976'],
  { cwd: sdk, env, windowsHide: true });
let buffered = '', login, browser;
host.stdout.on('data', chunk => { buffered = (buffered + chunk).slice(-65536); login ??= buffered.match(/http:\/\/127\.0\.0\.1:16976\/\?token=[^\s]+/)?.[0]; void appendFile(log, chunk); });
host.stderr.on('data', chunk => void appendFile(log, chunk));
const wait = ms => new Promise(done => setTimeout(done, ms));
const report = { version: manifest.version, noInference: true, entry: 'actual RemotePlugins.prepare with original Host graph/bundles', actualRelay: false };
try {
  for (const deadline = Date.now() + 90000; !login && Date.now() < deadline && host.exitCode === null;) await wait(100);
  assert.ok(login, `official_host_start_failed:${host.exitCode}`);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext(), desktop = await context.newPage();
  await desktop.goto(login, { waitUntil: 'domcontentloaded' });
  const graph = await desktop.evaluate(() => window.__DSH_BOOT__);
  assert.ok(graph?.entries.length); report.entries = graph.entries.length;
  await writeFile(resolve(output, 'graph.json'), JSON.stringify(graph, null, 2));
  await context.route('https://remote.dshm.invalid/plugins/**', async route => {
    const url = new URL(route.request().url());
    const response = await context.request.get('http://127.0.0.1:16976' + url.pathname + url.search);
    await route.fulfill({ response });
  });
  await context.route('https://remote.dshm.invalid/diagnostic', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  const page = await context.newPage(); await page.goto('https://remote.dshm.invalid/diagnostic');
  await page.addScriptTag({ path: bundle });
  const cdp = await context.newCDPSession(page); await cdp.send('Debugger.enable');
  const imported = page.evaluate(graph => window.runRc21Import(graph), graph);
  const result = await Promise.race([imported.then(value => ({ value }), error => ({ error: error.message })), wait(10000).then(() => ({ timeout: true }))]);
  Object.assign(report, result);
  if (result.timeout) {
    const paused = new Promise(done => cdp.once('Debugger.paused', event => done(event.callFrames.map(frame => ({ name: frame.functionName, url: frame.url, location: frame.location })))));
    await cdp.send('Debugger.pause'); report.frames = await Promise.race([paused, wait(3000).then(() => [])]);
    await cdp.send('Runtime.terminateExecution').catch(() => {}); await cdp.send('Debugger.resume').catch(() => {});
  }
  report.steps = await page.evaluate(() => window.rc21Steps).catch(() => []);
} catch (error) { report.failure = error.message; }
finally {
  await browser?.close();
  if (host.exitCode === null) execFileSync('taskkill.exe', ['/PID', String(host.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  const bytes = JSON.stringify(report, null, 2);
  await writeFile(resolve(output, 'report.json'), bytes);
  await writeFile(resolve(output, `report-${Date.now()}.json`), bytes);
  if (report.failure || report.error || report.timeout || report.value?.apply !== 'function') process.exitCode = 1;
  console.log(JSON.stringify(report));
}
