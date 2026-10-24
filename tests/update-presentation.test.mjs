import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePresentation } from '../src/update-presentation.mjs';
import { registerUpdatePreparation, prepareUpdate } from '../src/update-preparation.mjs';
const apk = { versionCode: 14, version: 'next', bytes: 100 };
const resource = { revision: 2, bytes: 50 };
const base = { phase: 'current', currentVersionCode: 13, resources: { phase: 'current', currentRevision: 0, restartSupported: true } };
test('one update is selected: APK priority, active download stability and next-process activation', () => {
  assert.equal(updatePresentation({ ...base, phase: 'available', release: apk, resources: { ...base.resources, phase: 'available', release: resource } }).kind, 'apk');
  const downloading = updatePresentation({ ...base, phase: 'available', release: apk, resources: { ...base.resources, phase: 'downloading', release: resource, received: 20 } });
  assert.equal(downloading.kind, 'resources'); assert.equal(downloading.action, null); assert.equal(downloading.canCancel, true);
  const pending = updatePresentation({ ...base, phase: 'available', release: apk, resources: { ...base.resources, pendingRevision: 2, phase: 'staged' } });
  assert.equal(pending.kind, 'resources'); assert.equal(pending.action, 'resources.restart');
  assert.equal(updatePresentation({ ...base, phase: 'ready', release: apk }).action, 'install');
});
test('pending flags survive process recreation and old native hosts never receive unsupported restart calls', () => {
  assert.equal(updatePresentation({ ...base, resources: { phase: 'idle', pendingRevision: 2, restartSupported: true } }).action, 'resources.restart');
  assert.equal(updatePresentation({ ...base, resources: { phase: 'staged', pendingRevision: 2 } }).action, null);
  assert.equal(updatePresentation({ ...base, resources: undefined }).action, 'check');
  assert.equal(updatePresentation({ ...base, phase: 'unavailable' }).action, null);
});
test('error, cancellation, partial checks and restart preparation retain distinct actions', () => {
  assert.equal(updatePresentation({ ...base, phase: 'error', error: 'update_network' }).action, 'check');
  assert.equal(updatePresentation({ ...base, resources: { ...base.resources, phase: 'cancelled', release: resource } }).action, 'resources.download');
  assert.equal(updatePresentation({ ...base, resources: { ...base.resources, phase: 'checking' } }).action, null);
  assert.equal(updatePresentation({ ...base, resources: { ...base.resources, phase: 'idle' } }).phase, 'idle');
  for (const phase of ['preparing', 'restarting']) assert.equal(updatePresentation({ ...base, resources: { ...base.resources, phase, pendingRevision: 2 } }).action, null);
  const rolledBack = updatePresentation({ ...base, resources: { ...base.resources, notice: 'web_rolled_back' } });
  assert.equal(rolledBack.error, 'web_rolled_back');
});
test('preparation awaits persistence and propagates refusal before native can restart', async () => {
  const order = [];
  const off = registerUpdatePreparation(async () => { await Promise.resolve(); order.push('saved'); });
  await prepareUpdate(); assert.deepEqual(order, ['saved']); off();
  const reject = registerUpdatePreparation(() => { throw Error('disk_full'); });
  await assert.rejects(prepareUpdate, /disk_full/); reject(); await prepareUpdate();
});
