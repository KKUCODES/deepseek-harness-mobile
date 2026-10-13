import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestFinalScope, latestRemoteAndroidPackage } from '../scripts/latest-final-test-scope.mjs';

const env = { DSHM_LATEST_FINAL_RUN: '4756b548-9077-4586-bab6-67b55d177641',
  DSHM_LATEST_ANDROID_CHECK: '1', DSHM_ANDROID_SERIAL: 'emulator-5554' };
test('Final Android always chooses a UID distinct from the credential-bearing App', () => {
  assert.equal(latestFinalScope(env).packageName, 'dev.dshmobile.validation.latestfinaltest');
  assert.equal(latestFinalScope({}), null);
});
test('Missing Android, wrong serial and mixed scopes refuse before App operations', () => {
  for (const extra of [{ DSHM_LATEST_FINAL_RUN: '../latesttest' }, { DSHM_LATEST_ANDROID_CHECK: '0' },
    { DSHM_ANDROID_SERIAL: 'emulator-5556' }, { DSHM_LATEST_SOURCE_CHECK: '1' },
    { DSHM_LATEST_OFFICE_CHECK: '1' }, { DSHM_LATEST_DELIVERY_RUN: env.DSHM_LATEST_FINAL_RUN }])
    assert.throws(() => latestFinalScope({ ...env, ...extra }));
});
test('Historical generic Android invocation refuses the now credential-bearing UID', () => {
  const android = { DSHM_LATEST_ANDROID_CHECK: '1', DSHM_ANDROID_SERIAL: 'emulator-5554' };
  assert.throws(() => latestRemoteAndroidPackage(android), /Select an independent test UID/);
  assert.equal(latestRemoteAndroidPackage(env), 'dev.dshmobile.validation.latestfinaltest');
  assert.equal(latestRemoteAndroidPackage({ ...android, DSHM_LATEST_OFFICE_LIFETIME_CHECK: '1' }),
    'dev.dshmobile.validation.latestofficetest');
});
test('Source combination requires an explicit matching mode and separate report', () => {
  const source = { ...env, DSHM_LATEST_FINAL_MODE: 'source', DSHM_LATEST_SOURCE_CHECK: '1' };
  assert.equal(latestFinalScope(source).reportName, 'latest-final-source-android-' + env.DSHM_LATEST_FINAL_RUN);
  assert.equal(latestRemoteAndroidPackage(source), 'dev.dshmobile.validation.latestfinaltest');
  for (const extra of [{ DSHM_LATEST_SOURCE_CHECK: '0' }, { DSHM_LATEST_FINAL_MODE: 'sdk' },
    { DSHM_LATEST_FINAL_MODE: 'npm' }, { DSHM_LATEST_DELIVERY_RUN: env.DSHM_LATEST_FINAL_RUN }])
    assert.throws(() => latestFinalScope({ ...source, ...extra }));
});

test('Inspected MuMu loopback keeps the independent UID and rejects other local devices', () => {
  const loopback = { ...env, DSHM_ANDROID_SERIAL: '127.0.0.1:16384' };
  assert.equal(latestRemoteAndroidPackage(loopback), 'dev.dshmobile.validation.latestfinaltest');
  for (const serial of ['127.0.0.1:16385', 'emulator-5556', '192.168.1.2:5555'])
    assert.throws(() => latestFinalScope({ ...env, DSHM_ANDROID_SERIAL: serial }));
});

test('SDK requires its own explicit inspected carrier scope and cannot mix source or npm', () => {
  const sdk = { ...env, DSHM_LATEST_FINAL_MODE: 'sdk', DSHM_LATEST_SDK_CHECK: '1' };
  assert.equal(latestFinalScope(sdk).reportName, 'latest-final-sdk-android-' + env.DSHM_LATEST_FINAL_RUN);
  assert.equal(latestRemoteAndroidPackage(sdk), 'dev.dshmobile.validation.latestfinaltest');
  for (const extra of [{ DSHM_LATEST_SDK_CHECK: '0' }, { DSHM_LATEST_FINAL_MODE: 'npm' },
    { DSHM_LATEST_SOURCE_CHECK: '1' }, { DSHM_LATEST_DELIVERY_RUN: env.DSHM_LATEST_FINAL_RUN }])
    assert.throws(() => latestFinalScope({ ...sdk, ...extra }));
});

test('Electron requires its own original desktop entry and refuses other carrier flags', () => {
  const electron = { ...env, DSHM_LATEST_FINAL_MODE: 'electron', DSHM_LATEST_ELECTRON_CHECK: '1' };
  assert.equal(latestFinalScope(electron).reportName, 'latest-final-electron-android-' + env.DSHM_LATEST_FINAL_RUN);
  assert.equal(latestRemoteAndroidPackage(electron), 'dev.dshmobile.validation.latestfinaltest');
  for (const extra of [{ DSHM_LATEST_ELECTRON_CHECK: '0' }, { DSHM_LATEST_FINAL_MODE: 'npm' },
    { DSHM_LATEST_SOURCE_CHECK: '1' }, { DSHM_LATEST_SDK_CHECK: '1' },
    { DSHM_LATEST_OFFICE_LIFETIME_CHECK: '1' }])
    assert.throws(() => latestFinalScope({ ...electron, ...extra }));
});

test('Complete carrier file-version regression requires all explicit flags and keeps the isolated UID', () => {
  const combined = { ...env, DSHM_LATEST_FINAL_MODE: 'sdk', DSHM_LATEST_SDK_CHECK: '1',
    DSHM_LATEST_FINAL_FILE_VERSION_CHECK: '1', DSHM_LATEST_OFFICE_CHECK: '1',
    DSHM_LATEST_OFFICE_LIFETIME_CHECK: '1', DSHM_LATEST_OFFICE_METADATA_CHECK: '1' };
  assert.equal(latestRemoteAndroidPackage(combined), 'dev.dshmobile.validation.latestfinaltest');
  assert.equal(latestFinalScope({ ...combined, DSHM_LATEST_FINAL_MODE: 'electron',
    DSHM_LATEST_SDK_CHECK: '0', DSHM_LATEST_ELECTRON_CHECK: '1' }).mode, 'electron');
  for (const name of ['DSHM_LATEST_FINAL_FILE_VERSION_CHECK', 'DSHM_LATEST_OFFICE_CHECK',
    'DSHM_LATEST_OFFICE_LIFETIME_CHECK', 'DSHM_LATEST_OFFICE_METADATA_CHECK'])
    assert.throws(() => latestFinalScope({ ...combined, [name]: '0' }));
  for (const extra of [{ DSHM_LATEST_FINAL_MODE: 'npm', DSHM_LATEST_SDK_CHECK: '0' },
    { DSHM_LATEST_SOURCE_CHECK: '1' }, { DSHM_LATEST_OFFICE_ENGINE_CHECK: '1' },
    { DSHM_LATEST_FILE_TRANSFERS_CHECK: '1' }])
    assert.throws(() => latestFinalScope({ ...combined, ...extra }));
});
