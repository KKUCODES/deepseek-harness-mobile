// 仅清理已归档的脚本中断测试；使用原安装器，不把测试清理记为产品自动回滚。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { access, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLatestLiveState } from '../../backend/scripts/latest-live-resume.mjs';

const flags = process.argv.slice(2);
assert.ok(flags.length <= 4 && new Set(flags).size === flags.length);
assert.ok(flags.every(flag => ['--verify', '--timeout', '--failed-probe', '--cold-phone'].includes(flag) || /^--attempt-[2-9]$/.test(flag)));
const coldPhone = flags.includes('--cold-phone');
const verifyOnly = flags.includes('--verify'), timingOut = flags.includes('--timeout'), failedProbe = flags.includes('--failed-probe');
const attempt = flags.find(flag => /^--attempt-/.test(flag));
assert.ok(!failedProbe || timingOut && !verifyOnly && !attempt);
assert.ok(!coldPhone || !timingOut && !failedProbe);
assert.ok(!attempt || timingOut || coldPhone);
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const { state } = await readLatestLiveState(runtime);
assert.ok(['source', 'release'].includes(state.executionMode));
process.kill(state.hostPid, 0); process.kill(state.supervisorPid, 0);
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + (timingOut ? 'script-timeout' : 'script-restart')
  + (coldPhone ? '-cold-phone' : '')
  + (attempt?.replace('--', '-') ?? '');
const reportPath = resolve(runtime, prefix + (verifyOnly ? '-cleanup-verified' : '-cleanup') + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const seed = JSON.parse(await readFile(resolve(runtime, prefix + '-seed.json'), 'utf8'));
const original = JSON.parse(await readFile(resolve(runtime, prefix + '.json'), 'utf8'));
assert.equal(seed.home, state.home); assert.equal(original.home, state.home);
if (timingOut) {
  assert.equal(state.installTimeoutDiagnostic, true);
  assert.equal(original.previousHostPid, state.hostPid); assert.equal(seed.hostPid, state.hostPid);
  if (failedProbe) {
    assert.equal(original.passed, false); assert.equal(original.stage, 'script-running');
    assert.equal(original.failure?.name, 'Error');
    assert.ok(original.failure.message.includes('locator.evaluate: Error: original_script_failure_state_missing'));
    for (const field of ['originalProfileRestored', 'testApprovalRemoved', 'primaryRestored']) assert.equal(original[field], true);
  } else for (const field of ['passed', 'originalTimeoutClassified', 'scriptTimeoutVisible', 'scriptExitedBeforeConfirmation',
    'failedReceipt', 'originalProfileRestored', 'originalHistoryPreserved', 'originalProjectionPreserved', 'primaryRestored']) assert.equal(original[field], true);
} else assert.equal(original.unknownOutcomeVisible, true);
if (coldPhone) {
  assert.equal(original.passed, true); assert.equal(original.coldAppRestart, true);
  assert.equal(original.processesGoneBeforeRecovery, true); assert.equal(original.noRetry, true);
}
assert.equal(original.managementRestored, true);
assert.ok(seed.processes.every(pid => {
  try { process.kill(pid, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; }
}));
const profile = resolve(state.home, 'profiles/web');
const files = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async name => {
  try { return [name, createHash('sha256').update(await readFile(resolve(profile, name))).digest('hex')]; }
  catch (error) { if (error.code === 'ENOENT') return [name, null]; throw error; }
})));
const before = await hashes();
assert.equal(before['package.json'], seed.before['package.json']);
assert.equal(before['pnpm-workspace.yaml'], seed.before['pnpm-workspace.yaml']);
const require = createRequire(resolve(runtime, 'package.json'));
const { parse, parseDocument } = require('yaml');
const manifest = JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8'));
assert.ok(Object.keys(manifest.dependencies ?? {}).length === 0);
assert.ok(Object.keys(manifest.devDependencies ?? {}).length === 0);
assert.ok(Object.keys(manifest.optionalDependencies ?? {}).length === 0);
const lock = parse(await readFile(resolve(profile, 'pnpm-lock.yaml'), 'utf8'));
const name = '@dsh-mobile/script-cancel-verification';
assert.deepEqual(Object.keys(lock.importers), ['.']);
if (verifyOnly || timingOut) assert.deepEqual(before, seed.before);
else {
  assert.deepEqual(Object.keys(lock.importers['.'].dependencies ?? {}), [name]);
  assert.equal(lock.importers['.'].dependencies[name].specifier, 'file:' + seed.spec);
  for (const section of ['packages', 'snapshots'])
    assert.deepEqual(Object.keys(lock[section]), [name + '@' + lock.importers['.'].dependencies[name].version]);
}
const source = state.executionMode === 'source';
if (source) await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
const operationPath = source ? resolve(state.sourceRoot, 'packages/boot/plugin-manager/lib/types/operations.js')
  : require.resolve('@deepseek-ai/dsh-plugin-manager/operations');
const { runPluginCommand } = await import(pathToFileURL(operationPath));
const report = { at: new Date().toISOString(), home: state.home, executionMode: state.executionMode,
  scope: 'owned-script-interruption-test-cleanup-with-original-installer', hostPid: state.hostPid,
  operationId: seed.operationId, before, passed: false, productAutoRollback: false };
if (failedProbe) report.recoveryOfFailedProbe = true;
let ownedDeny;
try {
  if (!verifyOnly) {
  // pnpm会为已移除的未决定脚本保留诊断；显式拒绝本测试来源，绝不重新执行脚本。
  const policyPath = resolve(profile, 'pnpm-workspace.yaml');
  const text = await readFile(policyPath, 'utf8');
  const policy = parseDocument(text);
  const selector = timingOut ? name + '@file:' + relative(profile, seed.spec).replaceAll('\\', '/')
    : name + '@' + lock.importers['.'].dependencies[name].version;
  assert.equal(policy.getIn(['allowBuilds', selector]), undefined);
  policy.setIn(['allowBuilds', selector], false);
  const changed = String(policy);
  assert.equal(await readFile(policyPath, 'utf8'), text);
  await writeFile(policyPath, changed);
  ownedDeny = { policyPath, text, changed };
  const result = await runPluginCommand({ profile: 'web', dir: profile, home: state.home, cwd: state.workspacePath,
    installAnchor: source ? resolve(state.sourceRoot, 'apps/cli/package.json') : require.resolve('@deepseek-ai/dsh/package.json') },
  ['install', '--offline', '--ignore-scripts'], { command: 'F:/Program Files/nodejs/node_global/pnpm.cmd',
    execution: 'service', outputBytes: 65536, idleTimeoutMs: 30000 });
  report.exitCode = result.exitCode; report.logPath = result.logPath;
  assert.equal(result.exitCode, 0);
  assert.equal(await readFile(policyPath, 'utf8'), changed);
  await writeFile(policyPath, text); ownedDeny = undefined;
  report.testScriptExplicitlyDenied = true;
  }
  report.after = await hashes(); assert.deepEqual(report.after, seed.before);
  await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
  await assert.rejects(access(resolve(profile, 'node_modules', name)), { code: 'ENOENT' });
  report.installedTestPackageRemoved = true; report.originalProfileRestored = true; report.passed = true;
} catch (error) { report.failure = { message: error.message, code: error.code }; process.exitCode = 1; }
finally {
  if (ownedDeny) {
    assert.equal(await readFile(ownedDeny.policyPath, 'utf8'), ownedDeny.changed);
    await writeFile(ownedDeny.policyPath, ownedDeny.text);
  }
}
await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ passed: report.passed, failure: report.failure, originalProfileRestored: report.originalProfileRestored }));
