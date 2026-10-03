import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立App实际下载既有测试附件；只暂缓原生写入回执，不替换文件或鉴权响应。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const pkg = 'dev.dshmobile.validation.pairingtest';
const name = 'dshm-shared-upload-20260924.txt';
const expected = await readFile(`artifacts/${name}`);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), package: pkg, errors: [] };
let page;
try {
  const context = (await (await androidAppWebView(device, pkg)).page()).context();
  page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', e => report.errors.push(e.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const card = page.getByTestId('live-worker-card').first();
  await card.getByRole('button', { name: '启动测试线程', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="live-worker-card"]')?.dataset.tick) >= 2);
  const workers = () => page.workers().filter(w => w.url().includes('/@dsh-mobile/worker-lifecycle-verification/'));
  assert.equal(workers().length, 1);
  await card.getByRole('button', { name: '读取插件资源', exact: true }).click();
  await card.getByTestId('worker-resource-result').filter({ hasText: '"ownMarker":true' }).waitFor();
  report.workerRead = JSON.parse(await card.getByTestId('worker-resource-result').innerText());
  assert.equal(report.workerRead.status, 200); assert.equal(report.workerRead.noBridge, true);
  const file = page.getByRole('button', { name: `查看附件 ${name}`, exact: true }).first();
  for (let i = 0; i < 12 && !await file.count(); i++) {
    const count = await page.locator('.conversation article').count();
    await page.getByRole('button', { name: '加载更早的消息', exact: true }).click();
    await page.waitForFunction(n => document.querySelectorAll('.conversation article').length > n, count);
  }
  await file.click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const plain = panel.locator('.remote-document-tab:not([hidden]) [data-textpreview-plain]');
  await plain.waitFor(); assert.equal(await plain.textContent(), expected.toString());
  const files = async directory => (await device.shell(`run-as ${pkg} find cache/${directory} -type f -print0`)).toString().split('\0').filter(Boolean).sort();
  const beforeShares = await files('remote-shares');
  assert.deepEqual(await files('remote-downloads'), []);
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage.bind(bridge), deliver = bridge.onmessage;
    const probe = window.__fileRevocationProbe = { calls: [], held: false, closed: 0 };
    let heldId, eventHeld;
    bridge.postMessage = raw => {
      const request = JSON.parse(raw);
      if (request.op.startsWith('file.')) probe.calls.push(request.op);
      if (!heldId && request.op === 'file.chunk') heldId = request.id;
      return send(raw);
    };
    bridge.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id === heldId && message.data?.bytes > 0) {
        eventHeld = event; probe.held = true; probe.written = message.data.bytes; return;
      }
      if (message.event?.type === 'closed') probe.closed++;
      return deliver(event);
    };
    window.__releaseFileRevocation = () => { if (eventHeld) { const event = eventHeld; eventHeld = null; deliver(event); } };
    window.__restoreFileRevocation = () => { bridge.postMessage = send; bridge.onmessage = deliver; window.__releaseFileRevocation(); };
  });
  await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await page.waitForFunction(() => window.__fileRevocationProbe.held);
  report.before = await page.evaluate(() => window.__fileRevocationProbe);
  assert.equal(report.before.written, expected.length);
  assert.ok((await files('remote-downloads')).some(path => path.endsWith('.part')));
  assert.equal(workers().length, 1);
  await page.screenshot({ path: 'artifacts/file-revocation-held-android.png' });
  console.log('FILE_WRITTEN_REVOKE_ISOLATED_DEVICE');
  await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor({ timeout: 60000 });
  await page.evaluate(() => window.__releaseFileRevocation());
  assert.equal(await main.count(), 0); assert.equal(await panel.count(), 0);
  await page.waitForFunction(() => window.__fileRevocationProbe.calls.includes('file.abort'));
  const until = Date.now() + 10000;
  while ((workers().length || (await files('remote-downloads')).length) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(workers().length, 0); assert.deepEqual(await files('remote-downloads'), []);
  assert.deepEqual(await files('remote-shares'), beforeShares);
  const after = await page.evaluate(() => window.__fileRevocationProbe);
  assert.ok(after.closed > 0);
  assert.equal(after.calls.some(op => ['file.finish', 'file.save', 'file.share'].includes(op)), false);
  report.after = { ...after, temporaryFileRemoved: true, workerDisposed: true, workspaceRemoved: true, notDelivered: true };
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
  assert.equal(await main.count(), 0); report.reconnectRejected = true;
  await page.screenshot({ path: 'artifacts/file-revocation-denied-android.png' });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/file-revocation-failure-android.png' }).catch(() => {});
} finally {
  await page?.evaluate(() => window.__restoreFileRevocation?.()).catch(() => {});
  await writeFile('artifacts/file-revocation-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
