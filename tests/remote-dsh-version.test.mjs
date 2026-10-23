import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsRemoteDshVersion, isProfileDshVersion } from '../src/remote-dsh-version.mjs';

test('alpha.2 SDK accepts the reviewed market baseline and its original host', () => {
  for (const host of ['0.2.0-rc.2', '0.2.1-alpha.2', '0.2.1-rc.2', '0.2.1']) {
    assert.equal(acceptsRemoteDshVersion('0.2.1-alpha.2', host), true);
    assert.equal(isProfileDshVersion(host), true);
  }
  for (const host of ['0.2.0-rc.1', '0.3.0-alpha.1', 'unknown', undefined])
    assert.equal(acceptsRemoteDshVersion('0.2.1-alpha.2', host), false);
});

test('legacy builds do not silently inherit the new compatibility range', () => {
  for (const sdk of ['0.1.6-alpha.2', '0.2.1-alpha.1']) {
    assert.equal(acceptsRemoteDshVersion(sdk, sdk), true);
    assert.equal(acceptsRemoteDshVersion(sdk, '0.2.0-rc.2'), false);
    assert.equal(acceptsRemoteDshVersion(sdk, '0.2.1-alpha.2'), false);
  }
});
