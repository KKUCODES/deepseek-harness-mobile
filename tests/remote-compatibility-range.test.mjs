import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { acceptsRemoteDshVersion, isProfileDshVersion, assertRemoteCapabilities } from '../src/remote-dsh-version.mjs';
import { assertRemoteModuleSystem } from '../src/remote-module-capabilities.mjs';

test('native notification compatibility shares the semver regression corpus', async () => {
  const rows = JSON.parse(await readFile(new URL('../android/app/src/androidTest/assets/remote-compatibility.json', import.meta.url), 'utf8'));
  for (const { sdk, host, expected } of rows) assert.equal(acceptsRemoteDshVersion(sdk, host), expected, `${sdk}/${host}`);
});

test('same contract range keeps old hosts and accepts rc.2 without enumerating releases', () => {
  for (const host of ['0.2.0-rc.2', '0.2.1-alpha.2', '0.2.1-rc.2', '0.2.1', '0.2.2-rc.1']) {
    assert.equal(isProfileDshVersion(host), true);
    assert.equal(acceptsRemoteDshVersion('0.2.1-alpha.2', host), true);
    assert.equal(acceptsRemoteDshVersion('0.2.1-rc.2', host), true);
  }
  for (const host of ['0.2.0-rc.1', '0.3.0-alpha.1', '0.3.0', 'unknown', '0.2.1rc2', undefined])
    assert.equal(acceptsRemoteDshVersion('0.2.1-rc.2', host), false);
  for (const value of [undefined, null, '', 'unknown']) assert.equal(acceptsRemoteDshVersion(value, value), false);
});

test('incompatible module systems fail before importing business plugins', () => {
  const ready = { import() {}, entries: { start() {} }, manifest: { plugins: [] } };
  assert.doesNotThrow(() => assertRemoteModuleSystem(ready));
  for (const invalid of [null, {}, { ...ready, entries: {} }, { ...ready, manifest: {} }])
    assert.throws(() => assertRemoteModuleSystem(invalid), /unsupported_dsh_capabilities/);
});

test('range membership alone does not grant missing transport or session capabilities', () => {
  const ready = { transport: 2, dshVersion: '0.2.1-rc.2', channels: ['rpc', 'stream', 'graph', 'bundle'],
    endpoints: { calls: ['session/list', 'session/page'], streams: ['$events', 'session/follow', 'workspace/follow'] } };
  assert.doesNotThrow(() => assertRemoteCapabilities(ready));
  for (const invalid of [{ ...ready, channels: ['rpc'] }, { ...ready, endpoints: {} }, { ...ready, transport: 3 }])
    assert.throws(() => assertRemoteCapabilities(invalid), /unsupported_remote_(?:capabilities|version)/);
});
