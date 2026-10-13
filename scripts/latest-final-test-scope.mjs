import assert from 'node:assert/strict';

/** 组合验收始终使用自己的 UID，不能清除持有用户 Key 的长期模型验收 App。 */
export function latestFinalScope(env = process.env) {
  const run = env.DSHM_LATEST_FINAL_RUN;
  if (!run) return null;
  assert.match(run, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(env.DSHM_LATEST_ANDROID_CHECK, '1', 'Final scope requires actual Android');
  assert.ok(['emulator-5554', '127.0.0.1:16384'].includes(env.DSHM_ANDROID_SERIAL), 'Select the inspected MuMu connection');
  const mode = env.DSHM_LATEST_FINAL_MODE ?? 'npm';
  assert.ok(['npm', 'source', 'sdk', 'electron'].includes(mode), 'Choose the inspected npm, source, SDK or Electron entry');
  if (mode === 'source') assert.equal(env.DSHM_LATEST_SOURCE_CHECK, '1');
  else assert.notEqual(env.DSHM_LATEST_SOURCE_CHECK, '1');
  if (mode === 'sdk') assert.equal(env.DSHM_LATEST_SDK_CHECK, '1');
  else assert.notEqual(env.DSHM_LATEST_SDK_CHECK, '1');
  if (mode === 'electron') assert.equal(env.DSHM_LATEST_ELECTRON_CHECK, '1');
  else assert.notEqual(env.DSHM_LATEST_ELECTRON_CHECK, '1');
  // 完整载体复验可显式加入文件版本回归；仍用隔离 UID，不开放其他异常专项。
  const fileVersion = env.DSHM_LATEST_FINAL_FILE_VERSION_CHECK === '1';
  const fileVersionFlags = ['DSHM_LATEST_OFFICE_CHECK', 'DSHM_LATEST_OFFICE_LIFETIME_CHECK',
    'DSHM_LATEST_OFFICE_METADATA_CHECK'];
  if (fileVersion) {
    assert.ok(['sdk', 'electron'].includes(mode), 'File version combination requires an inspected complete carrier');
    for (const name of fileVersionFlags) assert.equal(env[name], '1', `File version combination requires ${name}`);
  }
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('DSHM_LATEST_') && !['DSHM_LATEST_ANDROID_CHECK', 'DSHM_LATEST_FINAL_RUN',
      'DSHM_LATEST_FINAL_MODE', ...(mode === 'source' ? ['DSHM_LATEST_SOURCE_CHECK'] : []),
      ...(mode === 'sdk' ? ['DSHM_LATEST_SDK_CHECK'] : []),
      ...(fileVersion ? ['DSHM_LATEST_FINAL_FILE_VERSION_CHECK', ...fileVersionFlags] : []),
      ...(mode === 'electron' ? ['DSHM_LATEST_ELECTRON_CHECK'] : [])].includes(name))
      assert.ok(value !== '1' && !name.endsWith('_RUN'), `Separate final scope from ${name}`);
  }
  return { run, mode, packageName: 'dev.dshmobile.validation.latestfinaltest',
    reportName: (mode === 'npm' ? 'latest-final-android-' : `latest-final-${mode}-android-`) + run };
}

/** 未显式选择独立专项时，拒绝历史默认 UID；该 App 现已保存真实 Key 和长期配对。 */
export function latestRemoteAndroidPackage(env = process.env) {
  const finalScope = latestFinalScope(env);
  assert.equal(env.DSHM_LATEST_ANDROID_CHECK, '1');
  assert.ok(['emulator-5554', '127.0.0.1:16384'].includes(env.DSHM_ANDROID_SERIAL));
  if (finalScope) return finalScope.packageName;
  assert.equal(env.DSHM_LATEST_OFFICE_LIFETIME_CHECK, '1', 'Select an independent test UID; preserve the credential-bearing App');
  return 'dev.dshmobile.validation.latestofficetest';
}
