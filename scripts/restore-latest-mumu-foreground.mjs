import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

// 仅恢复已有 App/绑定的实际页面；不安装、清数据、配对或发送消息。
assert.equal(process.env.DSHM_ANDROID_SERIAL, '127.0.0.1:16384');
assert.equal(process.argv.length, 2);
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts/latest-mobile-runtime/mumu-foreground-20261008');
const { mkdir } = await import('node:fs/promises');
await mkdir(output, { recursive: true });
let live;
const report = { at: new Date().toISOString(), passed: false, appInstalled: false, keyRead: false,
  pairingReplaced: false, messageSent: false };
try {
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
  const { state, main, page, device, session } = live;
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  const marker = 'DSHM_ELECTRON_e4656e6c69994a10';
  const reply = main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker });
  await reply.waitFor(); await reply.scrollIntoViewIfNeeded();
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  const snapshot = await live.readSession({ allRecords: true });
  assert.equal(snapshot.row.running, false);
  assert.equal(snapshot.projections.values.permissions.currentValue, 'workspace-write');
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json')));
  const login = await fetch(loginURL, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const status = await fetch(new URL('/api/dsh-mobile', loginURL), { headers: { cookie }, signal: AbortSignal.timeout(10000) });
  assert.equal(status.status, 200);
  const active = (await status.json()).devices.filter(d => d.status === 'active');
  assert.equal(active.length, 1); assert.equal(active[0].management, false);
  assert.equal(active[0].fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(await page.locator('iframe').count(), 0);
  const foreground = (await device.shell('dumpsys activity activities')).toString();
  assert.match(foreground, /topResumedActivity=.*dev\.dshmobile\.validation\.latesttest\/dev\.dshmobile\.validation\.RemoteActivity/);
  await writeFile(resolve(output, 'foreground.png'), await device.screenshot(), { flag: 'wx' });
  Object.assign(report, { passed: true, serial: device.serial(), hostPid: state.hostPid,
    appPid: Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim()),
    sessionId: session.sessionId, title: session.title, realReplyVisible: marker, originalManagement: false,
    historyRecords: snapshot.records.length,
    historySha256: createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex'), foregroundRemote: true });
} catch (error) { report.failure = { name: error.name, message: error.message }; process.exitCode = 1; }
finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (live) await live.device.close();
  console.log(JSON.stringify(report));
}
process.exit(process.exitCode ?? 0);
