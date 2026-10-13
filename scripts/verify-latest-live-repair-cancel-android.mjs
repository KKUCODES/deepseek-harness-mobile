// 真实手机原管理组件：不兼容升级修复期间取消/退出，保留旧版本及原失败证据。
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
import { createLatestRepairFixture } from '../../plugin/tests/support/latest-repair-fixture.mjs';

const flags = process.argv.slice(2);
assert.ok(flags.length <= 6 && new Set(flags).size === flags.length);
assert.ok(flags.every(flag => ['--cleanup', '--restart', '--timeout', '--host-only', '--native-installed', '--cold-phone'].includes(flag) || /^--attempt-[2-9]$/.test(flag)));
const cleanupOnly = flags.includes('--cleanup'), restarting = flags.includes('--restart'), timingOut = flags.includes('--timeout');
const hostOnly = flags.includes('--host-only');
const nativeInstalled = flags.includes('--native-installed');
const coldPhone = flags.includes('--cold-phone');
assert.ok(!coldPhone || restarting && hostOnly && nativeInstalled && !cleanupOnly && !timingOut);
assert.ok(!nativeInstalled || !restarting || hostOnly, 'Native restart validation requires a core Host-only scenario');
assert.ok(!nativeInstalled || !cleanupOnly || hostOnly, 'Native cleanup is restricted to the recorded Host-only failures');
assert.ok(!timingOut || !restarting);
assert.ok(!hostOnly || restarting);
const attempt = flags.find(flag => /^--attempt-/.test(flag));
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
assert.ok(['source', 'release'].includes(state.executionMode)); assert.equal(state.autoReviewDiagnostic, false);
assert.equal(state.installTimeoutDiagnostic === true, timingOut);
process.kill(state.hostPid, 0); process.kill(state.supervisorPid, 0);
if (nativeInstalled) {
  if (state.executionMode === 'source') await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
  else {
    const plan = await (await import('../../plugin/compatibility/latest-upstream/package-range-runtime.mjs')).readInstalledLatestPackageRange();
    assert.equal(plan?.files.length, 5); assert.equal(plan.patched, 5);
  }
}
const prefix = `latest-live-${state.executionMode}-repair-${timingOut ? 'timeout' : hostOnly ? 'host-only' : restarting ? 'restart' : 'cancel'}${nativeInstalled ? '-native-installed' : ''}${coldPhone ? '-cold-phone' : ''}${cleanupOnly ? '-cleanup' : ''}${attempt?.replace('--', '-') ?? ''}`;
const reportPath = resolve(runtime, prefix + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
let live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
let { page, main, device, capture } = live;
const profile = resolve(state.home, 'profiles/web');
const { parse, parseDocument } = createRequire(resolve(runtime, 'package.json'))('yaml');
const originals = await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name))));
const originalPolicy = parse(originals[2].toString());
const requests = [], responses = [];
let allowFreshBuild = false;
const report = { at: new Date().toISOString(), executionMode: state.executionMode, home: state.home,
  hostPid: state.hostPid, passed: false, managementRestored: false, pageErrors: [], requests };
report.originalProfileHashes = originals.map(bytes => createHash('sha256').update(bytes).digest('hex'));
page.on('pageerror', error => report.pageErrors.push(error.message));
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
const delay = ms => new Promise(done => setTimeout(done, ms));
async function waitFor(probe, name, ms = 60000) {
  const deadline = Date.now() + ms;
  for (;;) { const value = await probe(); if (value) return value; assert.ok(Date.now() < deadline, name); await delay(100); }
}
const server = createServer((incoming, response) => {
  const url = new URL(incoming.url, 'http://127.0.0.1');
  if (url.pathname !== '/build') { response.writeHead(404).end(); return; }
  const item = { pid: Number(url.searchParams.get('pid')), child: Number(url.searchParams.get('child')),
    remotePort: incoming.socket.remotePort, closed: false };
  requests.push(item); response.once('close', () => { item.closed = true; });
  if (requests.length === 1 || allowFreshBuild) response.writeHead(200).end(); else responses.push(response);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const fixtureHome = await mkdtemp(resolve(runtime, prefix + '-owned-'));
const fixture = await createLatestRepairFixture(fixtureHome, profile, `http://127.0.0.1:${server.address().port}`);
report.fixtureHome = fixtureHome;
if (!cleanupOnly) assert.equal(JSON.parse(originals[0]).dependencies?.[fixture.name], undefined);
assert.equal(originalPolicy.allowBuilds?.[fixture.selector], undefined);
let entry, cookie;
async function authenticate() {
  const current = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
  assert.equal(current.home, state.home); assert.equal(current.origin, state.origin);
  assert.equal(current.executionMode, state.executionMode); assert.equal(current.target, state.target);
  process.kill(current.hostPid, 0); process.kill(current.supervisorPid, 0);
  entry = new URL(JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8')).loginURL);
  assert.equal(entry.protocol, 'http:'); assert.equal(entry.hostname, '127.0.0.1');
  const login = await fetch(entry, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303); cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  return current;
}
await authenticate();
async function request(path, body) {
  const response = await fetch(new URL(path, entry), { method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, 200); return response.json();
}
async function binding() {
  const value = await request('/api/dsh-mobile'); assert.equal(value.connection, 'online');
  const row = value.devices.find(item => item.id === '9f44abd1-12b1-4a9a-9bad-4f43837e820d');
  assert.equal(row?.fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(row.status, 'active'); return row;
}
async function connected() {
  if (!await main.isVisible()) return false;
  return main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) {
        const value = fiber.memoizedProps.model.getSnapshot();
        return value.ready && value.connectionState === 'connected' && value.plugins?.state === 'ready';
      }
    return false;
  });
}
async function reconnect() {
  await waitFor(async () => {
    if (await connected()) return true;
    const button = page.getByRole('button', { name: '重新连接', exact: true });
    if (await button.isVisible()) {
      try {
        // 原页面可能在两次观察之间完成重连；短等待后重新检查实际连接。
        if (await button.isEnabled({ timeout: 1000 })) {
          assert.equal(await page.getByTestId('remote-fingerprint').textContent({ timeout: 1000 }), 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
          await button.click({ timeout: 1000 });
        }
      } catch (error) { if (error.name !== 'TimeoutError') throw error; }
    }
    return false;
  }, 'mobile connection and original plugins not ready', 90000);
}
async function openManager() {
  if (!await manager.isVisible()) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
  }
}
let manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
const install = () => page.getByRole('dialog').filter({ has: page.locator('[data-install-phase]') });
async function add(spec) {
  await manager.getByRole('button', { name: '添加插件', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
  await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
}
async function failedInstallOutcome(dialog) {
  return waitFor(() => dialog.locator('[data-install-phase]').evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      for (const branch of [fiber, fiber.alternate]) {
        const install = branch?.memoizedProps?.install;
        if (install?.phase === 'failed') return { requestId: install.requestId, failure: install.failure,
          runs: install.runs.map(run => ({ exitCode: run.exitCode, output: run.output })) };
      }
    return null;
  }), 'original guard failure state missing');
}
let granted = false, policyChanged = false, tree;
async function uninstallFixture() {
  const detail = manager.locator(`[data-plugin-detail="${fixture.name}"]`);
  const show = manager.getByRole('button', { name: /^查看 .*latest-inflight-repair-test$/ });
  // 安装关闭后原组件可能异步导航到详情；重新观察，不能依据单次isVisible等待旧列表。
  await waitFor(async () => {
    if (await detail.isVisible()) return true;
    if (await show.isVisible()) try { await show.click({ timeout: 1000 }); }
    catch (error) { if (error.name !== 'TimeoutError') throw error; }
    return false;
  }, 'test package list or detail unavailable');
  await detail.getByRole('button', { name: /^卸载 / }).click();
  await page.getByRole('dialog', { name: /^卸载「.*latest-inflight-repair-test」？$/ }).getByRole('button', { name: '卸载', exact: true }).click();
  // 等原管理器结算后再读文件，避免轮询读句柄干扰Windows上的原子重命名。
  await detail.waitFor({ state: 'detached', timeout: 60000 });
  await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  assert.equal(JSON.parse(await readFile(resolve(profile, 'package.json'))).dependencies?.[fixture.name], undefined);
  await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
}
try {
  assert.equal((await binding()).management, hostOnly && cleanupOnly && !nativeInstalled);
  if (cleanupOnly && nativeInstalled) {
    const recoveryOf = `latest-live-${state.executionMode}-repair-host-only-native-installed${attempt?.replace('--', '-') ?? ''}.json`;
    const previous = JSON.parse(await readFile(resolve(runtime, recoveryOf)));
    assert.equal(previous.home, state.home); assert.equal(previous.passed, false);
    assert.ok(['native-next-write', 'remove-test-package'].includes(previous.stage)); assert.equal(previous.failure.name, 'TimeoutError');
    if (previous.stage === 'remove-test-package') {
      assert.equal(previous.originalNextWriteAdmitted, true); assert.equal(previous.freshBuildGoneBeforeConfirmation, true);
    }
    assert.equal(previous.processesGoneBeforeRecovery, true); assert.equal(previous.writesStoppedBeforeRecovery, true);
    assert.equal(previous.unknownOutcomeVisible, true); assert.equal(previous.noAutomaticRetry, true);
    assert.equal(previous.managementRestored, true);
    assert.ok(previous.processes.every(pid => !alive(pid))); assert.ok(previous.requests.every(item => item.closed));
    assert.equal(JSON.parse(originals[0]).dependencies[fixture.name], 'file:' + resolve(previous.fixtureHome, 'repair-0.0.1.tgz').replaceAll('\\', '/'));
    await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    granted = true;
    await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: true });
    await reconnect(); await openManager();
    if (await install().isVisible()) await install().getByRole('button', { name: '关闭', exact: true }).click();
    await uninstallFixture();
    const hashes = await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name => createHash('sha256').update(await readFile(resolve(profile, name))).digest('hex')));
    assert.deepEqual(hashes, previous.originalProfileHashes);
    const retained = await live.readSession();
    assert.deepEqual(retained.records, previous.originalRecords); assert.deepEqual(retained.projections.values, previous.originalValues);
    report.originalProfileRestored = true; report.historyAndProjectionPreserved = true; report.recoveryOf = recoveryOf;
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    const plugins = page.getByRole('dialog', { name: '电脑插件', exact: true });
    if (await plugins.isVisible()) await plugins.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.passed = true;
  } else if (cleanupOnly) {
    const recoveryOf = `latest-live-${state.executionMode}-repair-${timingOut ? 'timeout' : hostOnly ? 'host-only' : restarting ? 'restart' : 'cancel'}${attempt?.replace('--', '-') ?? (restarting || timingOut ? '' : '-attempt-2')}.json`;
    const previous = JSON.parse(await readFile(resolve(runtime, recoveryOf)));
    assert.equal(previous.home, state.home);
    if (hostOnly) {
      assert.equal(previous.passed, false); assert.equal(previous.stage, 'repair-running');
      assert.equal(previous.failure?.name, 'AssertionError');
      assert.ok(previous.failure.message.includes('assert.ok(report.processes.every(alive))'));
      assert.equal(previous.managementRestored, false); assert.equal(previous.permissionRestoreError, 'kill ESRCH');
      assert.notEqual(previous.hostPid, state.hostPid); assert.equal(alive(previous.hostPid), false);
      assert.equal(alive(previous.coreHostPid), false); assert.equal(previous.requests.length, 2);
      assert.ok(previous.requests.every(item => item.closed));
      assert.deepEqual(report.originalProfileHashes.slice(0, 2), previous.baseline.slice(0, 2));
      const recorded = JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json')));
      assert.equal(recorded.pid, previous.processes[0]); assert.equal(recorded.grouped, false);
      report.originalStaleRun = recorded;
    } else if (timingOut) {
      assert.equal(previous.stage, 'repair-running'); assert.equal(previous.failure?.name, 'TimeoutError');
      assert.ok(previous.failure.message.includes("getByText('安装超时'"));
      assert.equal(previous.managementRestored, true); assert.equal(previous.sameHost, true);
      assert.equal(previous.hostPid, state.hostPid); assert.equal(previous.requests.length, 2);
      assert.ok(previous.requests.every(item => item.closed));
      assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
      assert.deepEqual(report.originalProfileHashes.slice(0, 2), previous.baseline.slice(0, 2));
      await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    } else if (restarting) {
      // 外部控制器未结束Host的失败轮次，只允许清理它已记录的专用包。
      assert.equal(previous.stage, 'repair-running');
      assert.equal(previous.failure?.message, 'owned Host did not exit during actual repair');
      assert.equal(previous.sameHost, true); assert.equal(previous.managementRestored, true);
      assert.equal(previous.hostPid, state.hostPid);
      assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
      assert.deepEqual(report.originalProfileHashes.slice(0, 2), previous.baseline.slice(0, 2));
      await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    } else {
      assert.equal(previous.oldVersionRestored, true);
      assert.equal(previous.cancelledReceipt, true); assert.equal(previous.writesStoppedBeforeConfirmation, true);
    }
    assert.ok(previous.processes.every(pid => !alive(pid)));
    const cleanupBase = JSON.parse(await readFile(resolve(runtime, 'latest-live-source-script-restart-cleanup.json')));
    assert.equal(cleanupBase.home, state.home); assert.equal(cleanupBase.passed, true);
    if (restarting || timingOut) assert.deepEqual(previous.originalProfileHashes,
      ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => cleanupBase.after[name]));
    assert.deepEqual(Object.keys(JSON.parse(originals[0]).dependencies), [fixture.name]);
    assert.equal(JSON.parse(originals[0]).dependencies[fixture.name], 'file:' + resolve(previous.fixtureHome, 'repair-0.0.1.tgz').replaceAll('\\', '/'));
    granted = true;
    await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: true });
    await reconnect();
    if (!await manager.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
    }
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    await uninstallFixture();
    if (hostOnly) {
      const path = resolve(profile, 'pnpm-workspace.yaml'), text = await readFile(path, 'utf8');
      const policy = parseDocument(text), selector = `${fixture.name}@file:${relative(profile, resolve(previous.fixtureHome, 'repair-0.0.1.tgz')).replaceAll('\\', '/')}`;
      assert.deepEqual(Object.keys(policy.toJS().allowBuilds), [selector]);
      assert.equal(policy.getIn(['allowBuilds', selector]), true); assert.equal(policy.get('sideEffectsCache'), false);
      policy.delete('allowBuilds'); policy.delete('sideEffectsCache');
      const restored = String(policy);
      assert.equal(createHash('sha256').update(restored).digest('hex'), cleanupBase.after['pnpm-workspace.yaml']);
      assert.equal(await readFile(path, 'utf8'), text); await writeFile(path, restored);
      report.originalPolicyRestored = true; report.originalManagerClearedStaleRun = true;
      const retained = await request('/api/session/page', { type: 'client-request', rpcId: randomUUID(), method: 'session/page',
        payload: { args: { request: { address: { kind: 'session', sessionId: previous.sessionId }, throughSeq: previous.originalSeq, maxMessages: 60 } } } });
      assert.equal(retained.result.ok, true); assert.deepEqual(retained.result.value.records, previous.originalRecords);
      const projection = await request('/api/session/projections', { type: 'client-request', rpcId: randomUUID(), method: 'session/projections',
        payload: { args: { request: { sessionId: previous.sessionId } } } });
      assert.equal(projection.result.ok, true); assert.deepEqual(projection.result.value.values, previous.originalValues);
      report.historyAndProjectionPreserved = true;
    }
    const after = Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name =>
      [name, createHash('sha256').update(await readFile(resolve(profile, name))).digest('hex')])));
    assert.deepEqual(after, cleanupBase.after); report.originalProfileRestored = true;
    report.recoveryOf = recoveryOf;
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    const plugins = page.getByRole('dialog', { name: '电脑插件', exact: true });
    if (await plugins.isVisible()) await plugins.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.passed = true;
  } else {
  const originalSession = await live.readSession();
  assert.equal(originalSession.row.running, false);
  assert.equal(originalSession.projections.values.permissions.currentValue, 'workspace-write');
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  report.timeOrigin = timeOrigin;
  // 仅测试profile关闭脚本缓存，批准仍必须通过手机原管理器完成。
  const policy = parseDocument(originals[2].toString()); policy.set('sideEffectsCache', false);
  await writeFile(resolve(profile, 'pnpm-workspace.yaml'), String(policy)); policyChanged = true;
  granted = true;
  await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: true });
  await reconnect();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
  await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null)
    await manager.getByText('最近插件操作', { exact: true }).click();
  await add(fixture.tarballs[0]); report.stage = 'baseline-approval';
  await install().getByRole('button', { name: '允许这些脚本并重试', exact: true }).waitFor({ timeout: 60000 });
  assert.equal(requests.length, 0);
  await install().getByRole('button', { name: '允许这些脚本并重试', exact: true }).click();
  await install().locator('[data-install-phase="done"]').waitFor({ timeout: 60000 });
  assert.equal(requests.length, 1); assert.ok(!alive(requests[0].pid) && !alive(requests[0].child));
  await install().getByRole('button', { name: '关闭', exact: true }).click();
  assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
  const baseline = await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name))));
  report.baseline = baseline.map(bytes => createHash('sha256').update(bytes).digest('hex'));
  report.sessionId = live.session.sessionId;
  report.originalSeq = originalSession.projections.asOfSeq;
  report.originalRecords = originalSession.records;
  report.originalValues = originalSession.projections.values;
  await add(fixture.tarballs[1]); report.stage = 'repair-running';
  await waitFor(() => requests.length === 2, 'original repair script did not start');
  const repairing = requests[1];
  tree = JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'), 'utf8'));
  report.processes = [tree.pid, repairing.pid, repairing.child];
  if (nativeInstalled) assert.ok(alive(repairing.pid) && alive(repairing.child));
  else assert.ok(report.processes.every(alive));
  report.processStatesAtStart = report.processes.map(pid => ({ pid, alive: alive(pid) }));
  const rows = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { cwd: runtime, windowsHide: true, encoding: 'utf8' })
    .split(/\r?\n/).map(row => row.trim().split(/\s+/));
  assert.equal(Number(rows.find(row => row[0] === 'TCP' && row[1] === `127.0.0.1:${repairing.remotePort}`
    && row[2] === `127.0.0.1:${server.address().port}`)?.[4]), repairing.pid);
  const writesPath = resolve(profile, 'node_modules', fixture.name, 'owned-build-writes.json');
  const readActualWriter = () => waitFor(async () => {
    try {
      const value = JSON.parse(await readFile(writesPath));
      return value.pid === repairing.child && Number.isSafeInteger(value.writes) ? value : null;
    } catch (error) { if (error.code === 'ENOENT' || error.name === 'SyntaxError') return null; throw error; }
  }, 'owned writer state unavailable', 5000);
  report.writerAtStart = await waitFor(async () => {
    try { const value = JSON.parse(await readFile(writesPath)); return value.pid === repairing.child ? value : null; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }, 'owned writer not started');
  const pending = manager.locator('[data-operation-state="pending"]').filter({ hasText: fixture.tarballs[1] });
  await pending.waitFor(); report.operationId = await pending.getAttribute('data-operation-id');
  assert.match(report.operationId, /^[0-9a-f-]{36}$/);
  report.originalRequestId = await main.evaluate((element, id) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.transport.pluginOperations.journal.get(id)?.requestId;
    throw Error('original_request_id_missing');
  }, report.operationId);
  assert.match(report.originalRequestId, /^[0-9a-f-]{36}$/);
  await capture(prefix + '-running');
  if (restarting) {
    if (hostOnly) {
      const listeners = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { cwd: runtime, windowsHide: true, encoding: 'utf8' })
        .split(/\r?\n/).map(row => row.trim().split(/\s+/)).filter(row => row[0] === 'TCP' && row[1] === entry.host && row[3] === 'LISTENING');
      assert.equal(listeners.length, 1); report.coreHostPid = Number(listeners[0][4]);
      assert.ok(Number.isSafeInteger(report.coreHostPid) && alive(report.coreHostPid));
      assert.ok(!report.processes.includes(report.coreHostPid));
      await writeFile(resolve(runtime, prefix + '-seed.json'), JSON.stringify({ home: state.home,
        hostPid: state.hostPid, supervisorPid: state.supervisorPid, coreHostPid: report.coreHostPid,
        executionMode: state.executionMode, processes: report.processes, run: tree, fixtureHome,
        operationId: report.operationId, originalRequestId: report.originalRequestId,
        baseline: report.baseline, originalProfileHashes: report.originalProfileHashes }, null, 2), { flag: 'wx' });
    }
    if (coldPhone) {
      const durable = await main.evaluate((element, id) => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return)
          if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.draftStore.readPluginOperations().find(item => item.id === id);
      }, report.operationId);
      assert.equal(durable?.id, report.operationId); assert.equal(durable.state, 'pending');
      assert.equal(durable.target, fixture.tarballs[1]); assert.equal(durable.payload, undefined);
      report.durableSummaryBeforeExit = durable;
      report.previousAppPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
      assert.ok(Number.isSafeInteger(report.previousAppPid) && report.previousAppPid > 0);
      await device.shell('am force-stop dev.dshmobile.validation.latesttest');
      assert.equal((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim(), '');
      report.appEndedBeforeHost = true;
    }
    // 等外部控制器明确结束已核验的拥有树，不因观察超时擅自重启。
    console.log(JSON.stringify({ readyForRepairHostExit: true, executionMode: state.executionMode,
      hostPid: state.hostPid, coreHostPid: report.coreHostPid, hostOnly, processes: report.processes, operationId: report.operationId }));
    await waitFor(async () => !alive(nativeInstalled ? report.coreHostPid : state.hostPid) && (coldPhone || !await connected()), 'owned Host did not exit during actual repair', 180000);
    if (nativeInstalled) {
      await waitFor(() => report.processes.every(pid => !alive(pid)) && requests.every(item => item.closed),
        'native range survived the actual core Host exit', 15000);
      const stoppedWrites = await readFile(writesPath); await delay(300); assert.deepEqual(await readFile(writesPath), stoppedWrites);
      report.processesGoneBeforeRecovery = true; report.writesStoppedBeforeRecovery = true;
      report.connectionsClosedBeforeRecovery = true;
      report.processStatesBeforeRecovery = report.processes.map(pid => ({ pid, alive: alive(pid) }));
      console.log(JSON.stringify({ rangeGoneBeforeRecovery: true, coreHostPid: report.coreHostPid,
        hostPid: state.hostPid, processes: report.processStatesBeforeRecovery }));
    } else if (hostOnly) {
      assert.equal(alive(report.coreHostPid), false); assert.ok(report.processes.every(alive));
      const before = await readActualWriter(); await delay(300);
      const after = await readActualWriter(); assert.equal(after.pid, before.pid); assert.ok(after.writes > before.writes);
      report.orphansAliveBeforeRecovery = true; report.writesContinuedBeforeRecovery = { before, after };
      console.log(JSON.stringify({ orphansPreserved: true, coreHostPid: report.coreHostPid,
        hostPid: state.hostPid, processes: report.processes, writes: { before: before.writes, after: after.writes } }));
    } else {
      assert.ok(report.processes.every(pid => !alive(pid)), 'actual repair processes survived whole Host tree exit');
      report.processesGoneBeforeRecovery = true;
      const stoppedWrites = await readFile(writesPath); await delay(300); assert.deepEqual(await readFile(writesPath), stoppedWrites);
      report.writesStoppedBeforeRecovery = true;
    }
    await waitFor(async () => {
      const current = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
      return current.hostPid !== state.hostPid && alive(current.hostPid) && alive(current.supervisorPid);
    }, 'same owned environment has not resumed', 180000);
    const current = await authenticate(); report.restoredHostPid = current.hostPid;
    assert.equal((await binding()).management, true);
    if (coldPhone) {
      report.stage = 'cold-app-launch'; await device.close();
      const adb = process.env.ADB_PATH;
      assert.equal(adb, 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe');
      execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'am', 'start', '-n',
        'dev.dshmobile.validation.latesttest/dev.dshmobile.validation.ValidationActivity'], { cwd: runtime, windowsHide: true });
      // 系统接收启动不等于主进程已出现；不能提前选择旧的或不存在的WebView。
      await waitFor(() => {
        try { return /^[1-9]\d*$/.test(execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'pidof',
          'dev.dshmobile.validation.latesttest'], { cwd: runtime, windowsHide: true, encoding: 'utf8' }).trim()); }
        catch (error) { if (error.status === 1 && !String(error.stdout ?? '').trim()) return false; throw error; }
      }, 'cold repair phone process not ready');
      live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
      ({ page, main, device, capture } = live);
      manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
      page.on('pageerror', error => report.pageErrors.push(error.message));
      report.appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
      assert.ok(report.appPid > 0 && report.appPid !== report.previousAppPid);
      assert.notEqual(await page.evaluate(() => performance.timeOrigin), timeOrigin);
      report.coldAppRestart = true;
    }
    await reconnect(); await openManager();
    if (await install().isVisible()) {
      const unknownInstall = install().filter({ has: page.locator('[data-install-phase="unknown"]') });
      await unknownInstall.waitFor(); assert.ok((await unknownInstall.innerText()).includes(fixture.tarballs[1]));
      report.originalManagerUnknownVisible = true;
      await unknownInstall.getByRole('button', { name: '关闭', exact: true }).click();
    }
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null)
      await manager.getByText('最近插件操作', { exact: true }).click();
    await manager.getByRole('button', { name: '刷新操作记录', exact: true }).click();
    const unknown = manager.locator(`[data-operation-id="${report.operationId}"][data-operation-state="unknown"]`);
    await unknown.getByText('无法确认结果，请核对电脑插件列表。', { exact: true }).waitFor();
    assert.equal(await unknown.getByRole('button').count(), 0);
    assert.equal(requests.length, 2);
    if (hostOnly && !nativeInstalled) { assert.equal(requests[1].closed, false); assert.ok(report.processes.every(alive)); }
    else assert.ok(requests.every(item => item.closed));
    report.unknownOutcomeVisible = true; report.noAutomaticRetry = true;
    await manager.getByText('最近插件操作', { exact: true }).click();
    await manager.getByRole('alert').getByText('有插件操作的结果尚未确认，请展开最近插件操作并核对电脑插件列表。', { exact: true }).waitFor();
    report.collapsedUnknownVisible = true;
    assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), baseline);
    assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
    report.oldVersionRestored = true; report.baselineProfilePreserved = true;
    await capture(prefix + '-unknown');
    if (nativeInstalled) {
      report.stage = 'native-next-write';
      // 仅原安装器可接管死记录；不预先删除锁，也不重试未知的旧操作。
      assert.deepEqual(JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'))), tree);
      report.originalRunRetainedUntilNextWrite = true;
      await uninstallFixture();
      report.deadRunRecoveredByOriginalManager = true; report.originalNextWriteAdmitted = true;
      allowFreshBuild = true;
      await add(fixture.tarballs[0]);
      await install().locator('[data-install-phase="done"]').waitFor({ timeout: 60000 });
      assert.equal(requests.length, 3); assert.ok(requests.every(item => item.closed && !alive(item.pid) && !alive(item.child)));
      await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
      assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), baseline);
      report.originalNextWriteAdmitted = true; report.deadRunRecoveredByOriginalManager = true;
      report.freshBuildGoneBeforeConfirmation = true;
      await capture(prefix + '-next-write');
      await install().getByRole('button', { name: '关闭', exact: true }).click();
    } else if (hostOnly) {
      report.stage = 'orphan-write-guard';
      assert.deepEqual(JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'))), tree);
      const beforeGuard = await readActualWriter();
      // 新提交必须走手机原管理器；已有未知操作不得自动重试或删除运行记录。
      await add(fixture.tarballs[0]);
      const failed = install().filter({ has: page.locator('[data-install-phase="failed"]') });
      await failed.waitFor({ timeout: 30000 });
      const outcome = await failedInstallOutcome(failed); report.guardFailure = outcome;
      assert.match(outcome.requestId, /^[0-9a-f-]{36}$/); assert.notEqual(outcome.requestId, report.originalRequestId);
      const diagnostic = outcome.failure.reason + JSON.stringify(outcome.runs);
      assert.ok(diagnostic.includes(`process ${tree.pid}`) && diagnostic.includes('still running in this profile'));
      assert.ok(report.processes.every(alive)); assert.equal(requests.length, 2); assert.equal(requests[1].closed, false);
      assert.deepEqual(JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'))), tree);
      assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), baseline);
      const afterGuard = await readActualWriter(); assert.equal(afterGuard.pid, beforeGuard.pid); assert.ok(afterGuard.writes > beforeGuard.writes);
      report.originalOrphanGuardRefused = true; report.runAndProfilePreservedByGuard = true;
      report.writesContinuedDuringGuard = { before: beforeGuard, after: afterGuard };
      if (await failed.getByRole('button', { name: '查看安装详情', exact: true }).isVisible())
        await failed.getByRole('button', { name: '查看安装详情', exact: true }).click();
      await failed.getByText(new RegExp(`process ${tree.pid}, started by an earlier package operation`)).waitFor();
      await capture(prefix + '-guard');
      await failed.getByRole('button', { name: '关闭', exact: true }).click();
      responses.forEach(response => { if (!response.destroyed && !response.writableEnded) response.writeHead(200).end(); });
      await waitFor(() => report.processes.every(pid => !alive(pid)) && requests.every(item => item.closed), 'released owned orphans remain', 15000);
      const stoppedWrites = await readFile(writesPath); await delay(300); assert.deepEqual(await readFile(writesPath), stoppedWrites);
      report.orphansExitedBeforeCleanup = true; report.writesStoppedBeforeCleanup = true;
      // 旧Host已消失，没有finally可移除记录；由下一次原管理器写入核对并接管。
      assert.deepEqual(JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'))), tree);
      report.originalRunRetainedUntilNextWrite = true;
    }
  } else if (timingOut) {
    const failed = install().filter({ has: page.locator('[data-install-phase="failed"]') });
    await failed.waitFor({ timeout: 45000 });
    const outcome = await failed.locator('[data-install-phase]').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const install = fiber.memoizedProps?.install;
        if (install?.phase === 'failed') return { phase: install.phase, requestId: install.requestId,
          failure: install.failure, runs: install.runs.map(run => ({ exitCode: run.exitCode, output: run.output })) };
      }
      throw Error('original_install_failure_state_missing');
    });
    report.originalFailure = outcome.failure; report.originalOutcomeRequestId = outcome.requestId;
    assert.equal(outcome.failure.kind, 'timeout'); assert.equal(outcome.requestId, report.originalRequestId);
    // 原界面优先显示兼容拒绝；超时分类及修复失败诊断仍必须保留。
    assert.equal(outcome.failure.code, 'incompatible-version');
    await failed.getByRole('alert').getByText('插件安装失败', { exact: true }).waitFor();
    assert.ok((await failed.innerText()).includes(fixture.component + '@0.0.1'));
    assert.ok((outcome.failure.reason + JSON.stringify(outcome.runs)).includes('node_modules could not be reinstalled'));
    await failed.getByRole('button', { name: '查看安装详情', exact: true }).click();
    await failed.getByText(/node_modules could not be reinstalled/).waitFor();
    report.originalTimeoutClassified = true; report.repairFailureDiagnosticVisible = true;
    assert.ok(report.processes.every(pid => !alive(pid))); report.processesGoneBeforeConfirmation = true;
    const stoppedWrites = await readFile(writesPath); await delay(300); assert.deepEqual(await readFile(writesPath), stoppedWrites);
    report.writesStoppedBeforeConfirmation = true;
    await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), baseline);
    assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
    report.oldVersionRestored = true; report.baselineProfilePreserved = true;
    assert.equal(requests.length, 2); assert.ok(requests.every(item => item.closed)); report.noAutomaticRetry = true;
    await capture(prefix + '-timeout');
    await failed.getByRole('button', { name: '关闭', exact: true }).click();
    await manager.locator(`[data-operation-id="${report.operationId}"][data-operation-state="complete"]`).getByText('未完成', { exact: true }).waitFor();
    report.failedReceipt = true;
  } else {
  await install().getByRole('button', { name: '取消安装', exact: true }).click();
  await delay(1500);
  assert.equal(await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('textbox', { name: '包名或地址', exact: true }).isVisible(), false);
  assert.ok((nativeInstalled ? report.processes.slice(1) : report.processes).every(alive)); report.waitsForRepair = true;
  responses.forEach(response => response.writeHead(200).end());
  await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('textbox', { name: '包名或地址', exact: true }).waitFor();
  assert.ok(report.processes.every(pid => !alive(pid))); report.processesGoneBeforeConfirmation = true;
  const stoppedWrites = await readFile(writesPath); await delay(300); assert.deepEqual(await readFile(writesPath), stoppedWrites);
  report.writesStoppedBeforeConfirmation = true;
  await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
  assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), baseline);
  assert.equal(JSON.parse(await readFile(resolve(profile, 'node_modules', fixture.name, 'package.json'))).version, '0.0.1');
  report.oldVersionRestored = true;
  await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await manager.locator(`[data-operation-id="${report.operationId}"][data-operation-state="complete"]`).getByText('已取消', { exact: true }).waitFor();
  report.cancelledReceipt = true; await capture(prefix + '-cancelled');
  }
  report.stage = 'remove-test-package';
  await uninstallFixture();
  const retained = await request('/api/session/page', { type: 'client-request', rpcId: randomUUID(), method: 'session/page',
    payload: { args: { request: { address: { kind: 'session', sessionId: live.session.sessionId },
      throughSeq: originalSession.projections.asOfSeq, maxMessages: 60 } } } });
  assert.equal(retained.result.ok, true); assert.deepEqual(retained.result.value.records, originalSession.records);
  const projection = await request('/api/session/projections', { type: 'client-request', rpcId: randomUUID(), method: 'session/projections',
    payload: { args: { request: { sessionId: live.session.sessionId } } } });
  assert.equal(projection.result.ok, true); assert.deepEqual(projection.result.value.values, originalSession.projections.values);
  if (!coldPhone) assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin);
  report.sameWebView = !coldPhone; report.historyAndProjectionPreserved = true;
  await manager.getByRole('button', { name: '返回', exact: true }).click();
  const plugins = page.getByRole('dialog', { name: '电脑插件', exact: true });
  if (await plugins.isVisible()) await plugins.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.deepEqual(report.pageErrors, []); report.passed = true;
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message, code: error.code }; process.exitCode = 1;
  if (report.processes) report.processStatesAtFailure = report.processes.map(pid => ({ pid, alive: alive(pid) }));
  if (await manager.isVisible().catch(() => false)) report.managerAtFailure = await manager.innerText().catch(() => null);
  await capture(prefix + '-failure').catch(() => {});
} finally {
  responses.forEach(response => { if (!response.destroyed && !response.writableEnded) response.writeHead(200).end(); });
  if (policyChanged) try {
    await waitFor(async () => {
      try { await access(resolve(profile, '.plugin-manager/run.json')); return false; }
      catch (error) { if (error.code === 'ENOENT') return true; throw error; }
    }, 'installer still owns profile, refuse policy restoration', 30000);
    assert.ok(requests.every(item => !alive(item.pid) && !alive(item.child)));
    const path = resolve(profile, 'pnpm-workspace.yaml'), actual = await readFile(path, 'utf8'), parsed = parse(actual);
    if (parsed.allowBuilds?.[fixture.selector] !== undefined) delete parsed.allowBuilds[fixture.selector];
    if (!originalPolicy.allowBuilds && Object.keys(parsed.allowBuilds ?? {}).length === 0) delete parsed.allowBuilds;
    if (originalPolicy.sideEffectsCache === undefined) delete parsed.sideEffectsCache;
    else parsed.sideEffectsCache = originalPolicy.sideEffectsCache;
    assert.deepEqual(parsed, originalPolicy); assert.equal(await readFile(path, 'utf8'), actual);
    await writeFile(path, originals[2]);
    assert.deepEqual(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => readFile(resolve(profile, name)))), originals);
    report.originalProfileRestored = true;
  } catch (error) { report.cleanupError = error.message; report.passed = false; process.exitCode = 1; }
  if (granted) try {
    const current = await authenticate();
    await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: false });
    assert.equal((await binding()).management, false); report.managementRestored = true;
    await reconnect();
    if (await main.locator('.remote-heading strong').innerText() !== live.session.title)
      await main.locator('.remote-session-row').filter({ hasText: live.session.title }).click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    report.primaryRestored = true;
    assert.equal(alive(current.hostPid), true);
    report.sameHost = current.hostPid === state.hostPid;
    if (restarting && !cleanupOnly) assert.equal(report.sameHost, false);
    await capture(prefix + '-restored');
  } catch (error) { report.permissionRestoreError = error.message; report.passed = false; process.exitCode = 1; }
  server.closeAllConnections(); await new Promise(done => server.close(done));
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, failure: report.failure, stage: report.stage,
    cleanupError: report.cleanupError, managementRestored: report.managementRestored, oldVersionRestored: report.oldVersionRestored }));
  await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
