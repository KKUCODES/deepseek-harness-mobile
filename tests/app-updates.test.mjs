import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AppUpdates, updateError, updateFailures } from '../src/app-updates.mjs';
import { translate } from '../src/ui/translations.mjs';

const snapshot = (revision, phase = 'idle', fields = {}) => ({ revision, phase, release: null, received: 0, currentVersion: '0.1.0-preview.7', ...fields });
function fixture() {
  const sent = [], bridge = { postMessage: text => sent.push(JSON.parse(text)) };
  const service = new AppUpdates(bridge);
  const respond = (request, data, error) => bridge.onmessage({ data: JSON.stringify({ id: request.id, data, error }) });
  const event = state => bridge.onmessage({ data: JSON.stringify({ event: state }) });
  return { sent, service, bridge, respond, event };
}
test('settings and startup share one watcher without taking over the chat bridges', async () => {
  const f = fixture(); let changes = 0;
  const off = f.service.subscribe(() => changes++), offSecond = f.service.subscribe(() => changes++);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].op, 'updates.watch'); assert.deepEqual(f.sent[0].data, {});
  f.respond(f.sent[0], snapshot(1, 'checking')); await Promise.resolve();
  f.event(snapshot(2, 'available', { release: { version: '0.1.0-preview.8', requiredPluginVersion: '0.1.87-latest.0' } }));
  assert.equal(f.service.getSnapshot().release.requiredPluginVersion, '0.1.87-latest.0');
  assert.equal(changes, 4); off(); offSecond();
  f.service.subscribe(() => {}); assert.equal(f.sent.length, 1);
});
test('late replies cannot roll back progress or restore a cancelled download', async () => {
  const f = fixture(); const action = f.service.action('download');
  f.event(snapshot(10, 'downloading', { received: 100 })); f.event(snapshot(11, 'cancelled'));
  f.respond(f.sent[0], snapshot(9, 'downloading', { received: 10 })); await action;
  assert.equal(f.service.getSnapshot().phase, 'cancelled');
  f.event(snapshot(12, 'ready')); assert.equal(f.service.getSnapshot().phase, 'ready');
});
test('native failure is visible and retry can receive fresh state', async () => {
  const f = fixture(); const failed = f.service.action('install');
  f.respond(f.sent[0], undefined, 'update_bridge_failed'); await failed;
  assert.equal(f.service.getSnapshot().phase, 'error'); assert.match(updateError(f.service.getSnapshot().error), /重试/);
  const retry = f.service.action('check'); f.respond(f.sent[1], snapshot(1, 'current')); await retry;
  assert.equal(f.service.getSnapshot().phase, 'current');
});
test('invalid notifications do not replace state; browser-only views do not start requests', async () => {
  const f = fixture(); f.event(snapshot(2, 'current'));
  f.bridge.onmessage({ data: 'invalid JSON' }); f.event({ phase: 'ready' }); f.event(snapshot(3, 'unknown'));
  assert.equal(f.service.getSnapshot().phase, 'current');
  const unavailable = new AppUpdates(null); unavailable.subscribe(() => {}); await unavailable.action('download');
  assert.equal(unavailable.getSnapshot().phase, 'unavailable');
});
test('unknown operations cannot add URLs or file paths to native update requests', async () => {
  const f = fixture(); await f.service.action('https://example.com/app.apk');
  assert.equal(f.sent.length, 0); assert.equal(f.service.getSnapshot().error, 'update_bridge_failed');
});

test('release validation reports the actual cause through the native state', () => {
  const f = fixture();
  const cases = [
    ['update_package_mismatch', /包名不一致/],
    ['update_release_version_invalid', /版本号/],
    ['update_release_unsigned', /未签名/],
    ['update_apk_missing', /缺少.*APK/],
    ['update_metadata_digest_mismatch', /版本信息文件.*校验/],
    ['update_invalid_url', /地址/],
    ['update_version_not_newer', /不高于/],
  ];
  for (const [index, [error, expected]] of cases.entries()) {
    f.event(snapshot(index + 1, 'error', { error }));
    const message = updateError(f.service.getSnapshot().error);
    assert.match(message, expected);
    assert.doesNotMatch(message, /信息不完整/);
    assert.notEqual(translate('en', message), message, `English translation for ${error}`);
  }
  assert.doesNotMatch(updateError('unknown_failure'), /网络/);
});

test('every native update failure has a specific localized message', async () => {
  const names = ['AppUpdateRelease', 'AppUpdates', 'AppUpdateHttp', 'AppUpdateVerifier', 'AppUpdateBridge'];
  for (const name of names) {
    const source = await readFile(new URL(`../android/app/src/main/java/dev/dshmobile/validation/${name}.kt`, import.meta.url), 'utf8');
    for (const [, code] of source.matchAll(/"(update_[a-z_]+)"/g)) {
      assert.ok(Object.hasOwn(updateFailures, code), `${name}: missing message for ${code}`);
      assert.notEqual(translate('en', updateFailures[code]), updateFailures[code], `English translation for ${code}`);
    }
  }
});

test('release-note links use external navigation without adding URL inputs to downloads', async () => {
  const f = fixture();
  const navigation = f.service.openLink('https://github.com/KKUCODES/deepseek-harness-mobile/releases');
  assert.equal(f.sent[0].op, 'updates.openLink');
  assert.deepEqual(f.sent[0].data, { url: 'https://github.com/KKUCODES/deepseek-harness-mobile/releases' });
  f.respond(f.sent[0], snapshot(1, 'available')); await navigation;
  for (const url of ['javascript:alert(1)', 'file:///data/a.apk', 'https://user:password@example.com']) await f.service.openLink(url);
  await f.service.action('download', { url: 'https://example.com/a.apk' });
  assert.equal(f.sent.length, 1);
});
