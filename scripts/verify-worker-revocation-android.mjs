import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立App使用真实电脑插件、Worker和资源通道；代理仅暂缓原始响应帧。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const pkg = 'dev.dshmobile.validation.pairingtest';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), package: pkg, errors: [] };
const control = async path => {
  const response = await fetch(`http://127.0.0.1:18794/${path}`, {
    method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000),
  });
  assert.ok(response.ok); return response.json();
};
let page;
try {
  const context = (await (await androidAppWebView(device, pkg)).page()).context();
  page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const card = page.getByTestId('live-worker-card').first();
  await card.getByRole('button', { name: '启动测试线程', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="live-worker-card"]')?.dataset.tick) >= 2);
  const workers = () => page.workers().filter(w => w.url().includes('/@dsh-mobile/worker-lifecycle-verification/'));
  assert.equal(workers().length, 1);
  const before = await control('stats');
  assert.ok(before.devices > 0 && before.devices <= 2); assert.equal(before.heldBytes, 0);
  await control('pause');
  await card.getByRole('button', { name: '读取插件资源', exact: true }).click();
  const deadline = Date.now() + 10000;
  let held;
  do {
    held = await control('stats');
    if (held.heldResourceChunks > 0) break;
    assert.ok(Date.now() < deadline, '未观察到真实资源分片');
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (true);
  assert.equal(await card.getByTestId('worker-resource-result').innerText(), 'null');
  assert.equal(workers().length, 1);
  report.held = held;
  await page.screenshot({ path: 'artifacts/worker-revocation-held-android.png' });
  console.log('WORKER_RESOURCE_HELD_REVOKE_ISOLATED_DEVICE');
  await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor({ timeout: 60000 });
  assert.equal(await main.count(), 0);
  const until = Date.now() + 10000;
  while (workers().length && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(workers().length, 0);
  const revoked = await control('stats');
  assert.equal(revoked.heldBytes, 0); assert.ok(revoked.droppedBytes >= held.heldBytes);
  assert.ok(revoked.closedDevices > before.closedDevices);
  report.revoked = { ...revoked, workerDisposed: true, workspaceRemoved: true };
  await control('resume');
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
  assert.equal(await main.count(), 0); assert.equal(workers().length, 0);
  report.reconnectRejected = true;
  await page.screenshot({ path: 'artifacts/worker-revocation-denied-android.png' });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/worker-revocation-failure-android.png' }).catch(() => {});
} finally {
  await control('resume').catch(() => {});
  await writeFile('artifacts/worker-revocation-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
