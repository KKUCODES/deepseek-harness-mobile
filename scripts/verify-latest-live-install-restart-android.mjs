// 真实下载/脚本阶段取消或结束隔离 Host；保留同一手机、原安装器和失败证据。
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const flags = process.argv.slice(2);
assert.ok(flags.length <= 3 && new Set(flags).size === flags.length);
assert.ok(flags.every(flag => /^--attempt-[2-9]$/.test(flag) || ['--finish', '--inspect', '--cold-phone', '--script-cancel', '--script-restart', '--script-timeout'].includes(flag)));
const coldPhone = flags.includes('--cold-phone');
const scriptScenario = flags.find(flag => flag.startsWith('--script-'));
assert.ok(flags.filter(flag => flag.startsWith('--script-')).length <= 1);
assert.ok(flags.filter(flag => !flag.startsWith('--script-') && flag !== '--cold-phone').length <= 1);
const variant = flags.find(flag => !flag.startsWith('--script-') && flag !== '--cold-phone');
assert.ok(!scriptScenario || variant === undefined || /^--attempt-/.test(variant));
assert.ok(!coldPhone || (!scriptScenario || scriptScenario === '--script-restart') && (variant === undefined || /^--attempt-/.test(variant)));
const finishing = variant === '--finish';
const inspecting = variant === '--inspect';
const scriptCancel = scriptScenario === '--script-cancel';
const scriptRestart = scriptScenario === '--script-restart';
const scriptTimeout = scriptScenario === '--script-timeout';
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const statePath = resolve(runtime, 'latest-live-state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
assert.ok(['source', 'release'].includes(state.executionMode));
assert.equal(state.autoReviewDiagnostic, false);
assert.equal(state.installTimeoutDiagnostic === true, scriptTimeout);
process.kill(state.hostPid, 0); process.kill(state.supervisorPid, 0);
if (coldPhone && state.executionMode === 'release') {
  const plan = await (await import('../../plugin/compatibility/latest-upstream/package-range-runtime.mjs')).readInstalledLatestPackageRange();
  assert.equal(plan?.files.length, 5); assert.equal(plan.patched, 5);
}
if (coldPhone && state.executionMode === 'source') {
  const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
  assert.equal(installed.sourceCommit, state.sourceCommit); assert.equal(installed.files, 36);
}
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '')
  + (scriptScenario?.slice(2) ?? 'install-restart') + (coldPhone ? '-cold-phone' : '');
const reportSuffix = variant?.replace('--', '-') ?? '';
const reportPath = resolve(runtime, prefix + reportSuffix + '.json');
const seedPath = resolve(runtime, prefix + (finishing && state.executionMode === 'source' ? '-attempt-4' : /^--attempt-/.test(variant ?? '')
  ? reportSuffix : '') + '-seed.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
if (!finishing && !inspecting) await assert.rejects(access(seedPath), { code: 'ENOENT' });
let live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
let { page, main, device, capture } = live;
const profile = resolve(state.home, 'profiles/web');
const report = { at: new Date().toISOString(), home: state.home, executionMode: state.executionMode,
  previousHostPid: state.hostPid, passed: false, managementRestored: false, pageErrors: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
let entry, cookie, grantAttempted = false, server, seed, scriptPolicy;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
async function authenticate() {
  const current = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(current.home, state.home); assert.equal(current.origin, state.origin);
  assert.equal(current.executionMode, state.executionMode); assert.equal(current.ready, true);
  process.kill(current.hostPid, 0); process.kill(current.supervisorPid, 0);
  entry = new URL(JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8')).loginURL);
  assert.equal(entry.hostname, '127.0.0.1'); assert.equal(entry.protocol, 'http:');
  const login = await fetch(entry, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303); cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  return current;
}
async function request(path, body) {
  const response = await fetch(new URL(path, entry), { method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, 200, 'latest_install_restart_http_' + response.status);
  return response.json();
}
async function binding() {
  const current = await request('/api/dsh-mobile'); assert.equal(current.origin, state.origin);
  assert.equal(current.connection, 'online');
  const row = current.devices.find(item => item.id === '9f44abd1-12b1-4a9a-9bad-4f43837e820d');
  assert.equal(row?.fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(row.status, 'active'); return row;
}
async function rpc(method, args) {
  assert.ok(['session/projections', 'session/page'].includes(method));
  const rpcId = randomUUID();
  const frame = await request('/api/' + method, { type: 'client-request', rpcId, method, payload: { args } });
  assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true); return frame.result.value;
}
const hashes = async () => Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name => {
  try { return [name, createHash('sha256').update(await readFile(resolve(profile, name))).digest('hex')]; }
  catch (error) { if (error.code === 'ENOENT') return [name, null]; throw error; }
})));
async function waitFor(probe, name, timeout = 30000) {
  const deadline = Date.now() + timeout;
  for (;;) { const value = await probe(); if (value) return value;
    assert.ok(Date.now() < deadline, name); await new Promise(done => setTimeout(done, 100)); }
}
let manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
async function openManager() {
  if (await manager.isVisible()) return;
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
}
async function connection() {
  if (!await main.isVisible()) return null;
  return main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) {
        const model = fiber.memoizedProps.model, snapshot = model.getSnapshot();
        return { ready: snapshot.ready, state: snapshot.connectionState, selected: snapshot.selected, plugins: snapshot.plugins?.state };
      }
    return null;
  });
}
async function reconnect() {
  await waitFor(async () => {
    const value = await connection();
    if (value?.ready && value.state === 'connected') return true;
    const button = page.getByRole('button', { name: '重新连接', exact: true });
    if (await button.isVisible() && await button.isEnabled({ timeout: 1000 }).catch(error => {
      if (error.name === 'TimeoutError') return false; throw error;
    })) {
      assert.equal(await page.getByTestId('remote-fingerprint').textContent(), 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
      await button.click({ timeout: 1000 }).catch(error => {
        if (error.name !== 'TimeoutError') throw error;
      });
    }
    return false;
  }, 'latest_install_restart_mobile_reconnect_failed', 90000);
}
try {
  await authenticate(); assert.equal((await binding()).management, false);
  const original = await live.readSession(); assert.equal(original.row.running, false);
  assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  if (finishing) {
    const previousPath = resolve(runtime, prefix + (state.executionMode === 'source' ? '-attempt-4' : '-attempt-3') + '.json');
    const previous = JSON.parse(await readFile(previousPath, 'utf8'));
    assert.equal(previous.home, state.home); assert.equal(previous.managementRestored, true);
    for (const key of ['disconnected', 'sameWebView', 'unknownOutcomeVisible', 'collapsedUnknownVisible', 'noRetry',
      'processesGoneBeforeCleanup', 'profileUnchanged', 'originalHistoryPreserved', 'originalProjectionPreserved'])
      assert.equal(previous[key], true, 'latest_install_restart_recovery_' + key);
    if (state.executionMode === 'source') assert.equal(previous.originalManagerUnknownVisible, true);
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, live.session.sessionId);
    assert.notEqual(seed.hostPid, state.hostPid); assert.ok(seed.processes.every(pid => !alive(pid)));
    assert.deepEqual(await hashes(), seed.before);
    const retained = await rpc('session/page', { request: { address: { kind: 'session', sessionId: seed.sessionId },
      throughSeq: seed.originalSeq, maxMessages: 60 } });
    assert.deepEqual(retained.records, seed.originalRecords);
    assert.deepEqual(original.projections.values, seed.originalValues);
    report.recoveryOf = previousPath; report.primaryRestored = true;
    report.managementRestored = true; report.passed = true;
  } else if (inspecting) {
    grantAttempted = true;
    await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: true });
    await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
    await reconnect(); await openManager();
    await manager.waitFor();
    await new Promise(done => setTimeout(done, 5000));
    report.managerText = await manager.innerText();
    report.managerButtons = await manager.getByRole('button').allTextContents();
    await capture(prefix + '-inspect');
    console.log(JSON.stringify({ managerText: report.managerText, managerButtons: report.managerButtons }));
    report.passed = true;
  } else {
  const before = await hashes(); assert.ok(before['package.json']);
  const requests = [];
  report.downloads = requests;
  const path = '/dshm-install-restart-' + randomUUID() + '.tgz';
  let spec, scriptPid, approvedHashes;
  if (scriptScenario) {
    const archiveRoot = await mkdtemp(resolve(runtime, prefix + '-package-'));
    const fixture = resolve(import.meta.dirname, '../tests/fixtures/script-cancel-plugin');
    const fixtureManifest = JSON.parse(await readFile(resolve(fixture, 'package.json'), 'utf8'));
    assert.equal(fixtureManifest.name, '@dsh-mobile/script-cancel-verification');
    assert.equal(fixtureManifest.scripts.postinstall, 'node postinstall.mjs');
    assert.equal(fixtureManifest.dependencies, undefined);
    assert.equal(JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8')).dependencies?.[fixtureManifest.name], undefined);
    spec = resolve(archiveRoot, 'script-cancel.tgz').replaceAll('\\', '/');
    const packaged = resolve(archiveRoot, 'package'); await mkdir(packaged);
    for (const name of ['package.json', 'index.js', 'postinstall.mjs', 'cordis.patch.yml'])
      await writeFile(resolve(packaged, name), await readFile(resolve(fixture, name)), { flag: 'wx' });
    execFileSync('C:/Windows/system32/tar.exe', ['-czf', spec, '-C', archiveRoot, 'package'], { cwd: archiveRoot, windowsHide: true });
    report.archive = { path: spec, sha256: createHash('sha256').update(await readFile(spec)).digest('hex'), fixture };
    const policyPath = resolve(profile, 'pnpm-workspace.yaml');
    const originalPolicy = await readFile(policyPath, 'utf8');
    const { parse } = createRequire(resolve(runtime, 'package.json'))('yaml');
    const parsedPolicy = parse(originalPolicy);
    // 新版pnpm把本地归档锚定到profile；只批准同一包、同一归档的实际来源键。
    const selector = `${fixtureManifest.name}@file:${relative(profile, spec).replaceAll('\\', '/')}`;
    assert.equal(parsedPolicy.allowBuilds?.[selector], undefined);
    scriptPolicy = { path: policyPath, original: originalPolicy, parsed: parsedPolicy, parse, selector, name: fixtureManifest.name };
  } else {
  server = createServer((incoming, response) => {
    const item = { path: incoming.url, remotePort: incoming.socket.remotePort, closed: false };
    requests.push(item); response.on('close', () => { item.closed = true; });
    if (incoming.url !== path) { response.writeHead(404); response.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  spec = 'http://127.0.0.1:' + server.address().port + path;
  }
  grantAttempted = true;
  await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: true });
  assert.equal((await binding()).management, true);
  // 改变管理授权会关闭旧认证连接；原手机入口重新核验后才能打开管理页面。
  await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
  await reconnect();
  report.stage = 'initial-manager';
  await waitFor(async () => (await connection())?.plugins === 'ready', 'latest_install_restart_plugins_not_ready');
  await openManager(); await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  await manager.getByText('最近插件操作', { exact: true }).click();
  const startedAt = await page.evaluate(() => performance.timeOrigin);
  await manager.getByRole('button', { name: '添加插件', exact: true }).click();
  const install = page.getByRole('dialog', { name: '添加插件', exact: true });
  await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
  await install.getByRole('button', { name: '安装', exact: true }).click();
  if (scriptScenario) {
    report.stage = 'pending-script-approval';
    const currentInstall = page.getByRole('dialog').filter({ has: page.locator('[data-install-phase]') });
    await currentInstall.getByRole('button', { name: '允许这些脚本并重试', exact: true }).waitFor({ timeout: 60000 });
    assert.deepEqual(scriptPolicy.parse(await readFile(scriptPolicy.path, 'utf8')), { ...scriptPolicy.parsed,
      allowBuilds: { ...scriptPolicy.parsed.allowBuilds, [scriptPolicy.selector]: 'set this to true or false' } });
    const blocked = await currentInstall.innerText();
    assert.ok(blocked.includes(scriptPolicy.name)); assert.ok(!blocked.includes('DSHM_CANCEL_SCRIPT_STARTED'));
    const blockedHashes = await hashes();
    assert.equal(blockedHashes['package.json'], before['package.json']);
    assert.equal(blockedHashes['pnpm-lock.yaml'], before['pnpm-lock.yaml']);
    report.blockedBeforeApproval = true;
    await capture(prefix + reportSuffix + '-blocked');
    await currentInstall.getByRole('button', { name: '允许这些脚本并重试', exact: true }).click();
    await currentInstall.getByRole('button', { name: '查看安装详情', exact: true }).click();
    await currentInstall.getByText(/DSHM_CANCEL_SCRIPT_STARTED:\d+/).waitFor({ timeout: 60000 });
    const actualLog = await currentInstall.innerText();
    scriptPid = Number(actualLog.match(/DSHM_CANCEL_SCRIPT_STARTED:(\d+)/)?.[1]);
    assert.ok(Number.isSafeInteger(scriptPid) && alive(scriptPid));
    assert.ok(!actualLog.includes('DSHM_CANCEL_SCRIPT_FINISHED'));
    assert.deepEqual(scriptPolicy.parse(await readFile(scriptPolicy.path, 'utf8')), { ...scriptPolicy.parsed,
      allowBuilds: { ...scriptPolicy.parsed.allowBuilds, [scriptPolicy.selector]: true } });
    approvedHashes = await hashes();
    report.scriptObservedRunning = true; report.scriptPid = scriptPid; report.stage = 'script-running';
  } else {
  await waitFor(() => requests.length > 0, 'latest_install_restart_download_not_started');
  assert.equal(requests.length, 1); assert.equal(requests[0].path, path);
  }
  const tree = JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'), 'utf8'));
  assert.ok(Number.isSafeInteger(tree.pid) && tree.pid > 0); assert.equal(typeof tree.grouped, 'boolean');
  let processes;
  if (scriptScenario) processes = [...new Set([tree.pid, scriptPid])];
  else {
  const port = server.address().port;
  const rows = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { cwd: runtime, windowsHide: true, encoding: 'utf8' })
    .split(/\r?\n/).map(row => row.trim().split(/\s+/));
  const owner = rows.find(row => row[0] === 'TCP' && row[1] === `127.0.0.1:${requests[0].remotePort}` && row[2] === `127.0.0.1:${port}`);
  assert.ok(owner); processes = [...new Set([tree.pid, Number(owner[4])])];
  }
  assert.ok(processes.every(pid => Number.isSafeInteger(pid) && pid > 0 && alive(pid)));
  await page.getByRole('dialog').last().locator('[data-install-phase="running"]').waitFor();
  const pending = manager.locator('[data-operation-state="pending"]').filter({ hasText: spec });
  await pending.waitFor(); const operationId = await pending.getAttribute('data-operation-id'); assert.match(operationId, /^[0-9a-f-]{36}$/);
  if (coldPhone) {
    // pnpm 启动器不是实际监听的 Host；先只结束核心进程，证明安装范围自行退出。
    const listeners = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { cwd: runtime, windowsHide: true, encoding: 'utf8' })
      .split(/\r?\n/).map(row => row.trim().split(/\s+/)).filter(row => row[0] === 'TCP' && row[1] === entry.host && row[3] === 'LISTENING');
    assert.equal(listeners.length, 1); report.coreHostPid = Number(listeners[0][4]);
    assert.ok(Number.isSafeInteger(report.coreHostPid) && alive(report.coreHostPid));
    assert.ok(!processes.includes(report.coreHostPid));
  }
  seed = { home: state.home, executionMode: state.executionMode, hostPid: state.hostPid, supervisorPid: state.supervisorPid,
    ...(coldPhone ? { coreHostPid: report.coreHostPid } : {}),
    sessionId: live.session.sessionId, before, spec, path, operationId, processes, run: tree, timeOrigin: startedAt,
    originalSeq: original.projections.asOfSeq, originalRecords: original.records, originalValues: original.projections.values };
  await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
  report.processes = processes; report.operationId = operationId;
  report.originalProfileHashes = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(name => before[name]);
  await capture(prefix + reportSuffix + '-running');
  if (coldPhone) {
    const durable = await main.evaluate((element, id) => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.draftStore.readPluginOperations().find(item => item.id === id);
    }, operationId);
    assert.equal(durable?.id, operationId); assert.equal(durable.state, 'pending');
    assert.equal(durable.target, spec); assert.equal(durable.payload, undefined);
    report.durableSummaryBeforeExit = durable;
    report.previousAppPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
    assert.ok(Number.isSafeInteger(report.previousAppPid) && report.previousAppPid > 0);
    await device.shell('am force-stop dev.dshmobile.validation.latesttest');
    assert.equal((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim(), '');
    report.appStoppedBeforeHost = true;
  }
  if (scriptTimeout) {
    report.originalRequestId = await main.evaluate((element, id) => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.transport.pluginOperations.journal.get(id)?.requestId;
      throw Error('original_script_request_id_missing');
    }, operationId);
    assert.match(report.originalRequestId, /^[0-9a-f-]{36}$/);
    const failed = page.getByRole('dialog').filter({ has: page.locator('[data-install-phase="failed"]') });
    await failed.waitFor({ timeout: 45000 });
    const outcome = await waitFor(() => failed.locator('[data-install-phase]').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        // React会保留DOM节点并交换fiber，读取两个实际缓存分支后再核对原请求编号。
        for (const branch of [fiber, fiber.alternate]) {
          const install = branch?.memoizedProps?.install;
          if (install?.phase === 'failed') return { phase: install.phase, requestId: install.requestId,
            failure: install.failure, runs: install.runs.map(run => ({ exitCode: run.exitCode, output: run.output })) };
        }
      return null;
    }), 'original_script_failure_state_missing');
    assert.equal(outcome.requestId, report.originalRequestId); assert.equal(outcome.failure.kind, 'timeout');
    assert.notEqual(outcome.failure.code, 'incompatible-version');
    report.originalFailure = outcome.failure; report.originalOutcomeRequestId = outcome.requestId;
    await failed.getByRole('alert').getByText('插件安装失败', { exact: true }).waitFor();
    await failed.getByText('安装超时', { exact: true }).waitFor();
    assert.ok((await failed.innerText()).includes(scriptPolicy.name));
    assert.ok(JSON.stringify(outcome.runs).includes(`DSHM_CANCEL_SCRIPT_STARTED:${scriptPid}`));
    assert.ok(!JSON.stringify(outcome.runs).includes('DSHM_CANCEL_SCRIPT_FINISHED'));
    assert.ok(processes.every(pid => !alive(pid)), 'script still alive when timeout confirmed');
    await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    const timeoutHashes = await hashes();
    assert.equal(timeoutHashes['package.json'], before['package.json']);
    assert.equal(timeoutHashes['pnpm-lock.yaml'], before['pnpm-lock.yaml']);
    assert.equal(timeoutHashes['pnpm-workspace.yaml'], approvedHashes['pnpm-workspace.yaml']);
    await new Promise(done => setTimeout(done, 300));
    assert.ok(processes.every(pid => !alive(pid))); assert.equal(await failed.count(), 1);
    report.originalTimeoutClassified = true; report.scriptTimeoutVisible = true;
    report.scriptExitedBeforeConfirmation = true; report.manifestAndLockRestored = true;
    report.approvalRetainedByOriginalManager = true; report.noAutomaticRetry = true;
    assert.equal(alive(state.hostPid), true); report.sameHost = true;
    assert.equal(await page.evaluate(() => performance.timeOrigin), startedAt); report.sameWebView = true;
    await capture(prefix + reportSuffix + '-timeout');
    await failed.getByRole('button', { name: '关闭', exact: true }).click();
    await manager.locator(`[data-operation-id="${operationId}"][data-operation-state="complete"]`)
      .getByText('未完成', { exact: true }).waitFor();
    report.failedReceipt = true;
  } else if (scriptCancel) {
    await page.getByRole('dialog').filter({ has: page.locator('[data-install-phase="running"]') })
      .getByRole('button', { name: '取消安装', exact: true }).click();
    const cancelled = page.getByRole('dialog', { name: '添加插件', exact: true });
    await cancelled.getByRole('textbox', { name: '包名或地址', exact: true }).waitFor();
    assert.equal(await cancelled.getByRole('textbox', { name: '包名或地址', exact: true }).inputValue(), spec);
    assert.ok(processes.every(pid => !alive(pid)), 'script still alive when original cancellation confirmed');
    assert.equal((await hashes())['package.json'], before['package.json']);
    assert.equal((await hashes())['pnpm-lock.yaml'], before['pnpm-lock.yaml']);
    assert.equal((await hashes())['pnpm-workspace.yaml'], approvedHashes['pnpm-workspace.yaml']);
    await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
    await cancelled.getByRole('button', { name: '关闭', exact: true }).click();
    // 拒绝脚本和显式批准后重试是两次原请求；按第二次真实操作ID核对取消回执。
    const completed = manager.locator(`[data-operation-id="${operationId}"][data-operation-state="complete"]`);
    await completed.getByText('已取消', { exact: true }).waitFor();
    assert.equal(await completed.count(), 1);
    report.scriptExitedBeforeConfirmation = true; report.manifestAndLockRestored = true;
    report.approvalRetainedByOriginalManager = true; report.cancelledReceipt = true;
    report.sameHost = alive(state.hostPid); assert.equal(report.sameHost, true);
    assert.equal(await page.evaluate(() => performance.timeOrigin), startedAt);
    report.sameWebView = true; report.operationId = operationId;
    await capture(prefix + reportSuffix + '-cancelled');
  } else {
  console.log(JSON.stringify({ readyForHostExit: true, executionMode: state.executionMode, hostPid: state.hostPid,
    ...(coldPhone ? { coreHostPid: report.coreHostPid } : {}), processes, operationId }));
  await waitFor(async () => !alive(coldPhone ? report.coreHostPid : state.hostPid) && (coldPhone || (await connection())?.state !== 'connected'), 'latest_install_restart_no_disconnect', 180000);
  report.disconnected = true;
  if (coldPhone) {
    await waitFor(() => processes.every(pid => !alive(pid)) && requests.every(item => item.closed), 'cold_phone_native_range_not_empty', 15000);
    report.processesGoneBeforeRecovery = true;
  }
  console.log(JSON.stringify({ disconnected: true, executionMode: state.executionMode }));
  const restored = await waitFor(async () => {
    const current = JSON.parse(await readFile(statePath, 'utf8'));
    return current.hostPid !== state.hostPid && alive(current.hostPid) && alive(current.supervisorPid) ? current : null;
  }, 'latest_install_restart_new_host_missing', 180000);
  await authenticate(); report.hostPid = restored.hostPid;
  assert.equal((await binding()).management, true);
  if (coldPhone) {
    report.stage = 'cold-app-launch';
    await device.close();
    const adb = process.env.ADB_PATH;
    assert.equal(adb, 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe');
    execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'am', 'start', '-n',
      'dev.dshmobile.validation.latesttest/dev.dshmobile.validation.ValidationActivity'], { cwd: runtime, windowsHide: true });
    // am start 返回只代表系统接收启动；等待实际主进程后才能选择其 WebView。
    await waitFor(() => {
      try { return /^[1-9]\d*$/.test(execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'pidof',
        'dev.dshmobile.validation.latesttest'], { cwd: runtime, windowsHide: true, encoding: 'utf8' }).trim()); }
      catch (error) { if (error.status === 1 && !String(error.stdout ?? '').trim()) return false; throw error; }
    }, 'cold_phone_process_not_ready');
    live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
    ({ page, main, device, capture } = live);
    manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    report.appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
    assert.ok(report.appPid > 0 && report.appPid !== report.previousAppPid);
    assert.notEqual(await page.evaluate(() => performance.timeOrigin), startedAt);
    report.coldAppRestart = true;
  }
  await reconnect();
  report.stage = 'restarted-manager';
  await waitFor(async () => (await connection())?.plugins === 'ready', 'latest_install_restart_plugins_not_ready');
  await openManager();
  const retainedInstall = page.getByRole('dialog').filter({ has: page.locator('[data-install-phase]') });
  if (await retainedInstall.isVisible()) {
    // 新版原组件保留在途任务；真实 waitForInstall 的 null 回执才释放为 unknown。
    const unknownInstall = page.getByRole('dialog').filter({ has: page.locator('[data-install-phase="unknown"]') });
    await unknownInstall.waitFor(); assert.ok((await unknownInstall.innerText()).includes(spec));
    report.originalManagerUnknownVisible = true;
    await unknownInstall.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null)
    await manager.getByText('最近插件操作', { exact: true }).click();
  await manager.getByRole('button', { name: '刷新操作记录', exact: true }).click();
  const unknown = manager.locator(`[data-operation-id="${operationId}"][data-operation-state="unknown"]`);
  await unknown.waitFor(); assert.ok((await unknown.innerText()).includes(spec));
  await unknown.getByText('无法确认结果，请核对电脑插件列表。', { exact: true }).waitFor();
  assert.equal(await unknown.getByRole('button').count(), 0);
  await capture(prefix + reportSuffix + '-unknown');
  await manager.getByText('最近插件操作', { exact: true }).click();
  await manager.getByRole('alert').getByText('有插件操作的结果尚未确认，请展开最近插件操作并核对电脑插件列表。', { exact: true }).waitFor();
  if (!coldPhone) assert.equal(await page.evaluate(() => performance.timeOrigin), startedAt);
  if (scriptRestart) {
    report.profileAtUnknown = await hashes();
    report.profileChangedAtUnknown = Object.keys(before).some(name => before[name] !== report.profileAtUnknown[name]);
    assert.equal(report.profileAtUnknown['pnpm-workspace.yaml'], approvedHashes['pnpm-workspace.yaml']);
  } else { assert.deepEqual(await hashes(), before); assert.equal(requests.length, 1); }
  await waitFor(() => processes.every(pid => !alive(pid)) && requests.every(item => item.closed), 'latest_install_restart_original_processes_remain', 15000);
  report.sameWebView = !coldPhone; report.unknownOutcomeVisible = true; report.collapsedUnknownVisible = true;
  report.noRetry = true; report.downloads = requests; report.processesGoneBeforeCleanup = true;
  if (!scriptRestart) report.profileUnchanged = true;
  report.operationId = operationId;
  }
  const retained = await rpc('session/page', { request: { address: { kind: 'session', sessionId: seed.sessionId },
    throughSeq: seed.originalSeq, maxMessages: 60 } });
  assert.deepEqual(retained.records, seed.originalRecords); report.originalHistoryPreserved = true;
  const projection = await rpc('session/projections', { request: { sessionId: seed.sessionId } });
  assert.deepEqual(projection.values, seed.originalValues); report.originalProjectionPreserved = true;
  await manager.getByRole('button', { name: '返回', exact: true }).click();
  const plugins = page.getByRole('dialog', { name: '电脑插件', exact: true });
  if (await plugins.isVisible()) await plugins.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if ((await connection()).selected !== seed.sessionId)
    await main.locator('.remote-session-row').filter({ hasText: live.session.title }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal((await connection()).selected, seed.sessionId);
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message, code: error.code }; process.exitCode = 1;
  report.mobileStateAtFailure = await connection().catch(() => null);
  if (await manager.isVisible().catch(() => false)) report.managerAtFailure = await manager.innerText().catch(() => null);
  await capture(prefix + reportSuffix + '-failure').catch(() => {});
} finally {
  if (scriptPolicy) {
    try {
      if (seed) assert.ok(seed.processes.every(pid => !alive(pid)), 'do not restore policy while installer can still write');
      try {
        const recorded = JSON.parse(await readFile(resolve(profile, '.plugin-manager/run.json'), 'utf8'));
        assert.ok(!alive(recorded.pid), 'do not restore policy while a recorded run remains active');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const actual = await readFile(scriptPolicy.path, 'utf8');
      const parsed = scriptPolicy.parse(actual);
      const decision = parsed.allowBuilds?.[scriptPolicy.selector];
      assert.ok(decision === undefined || decision === true || decision === 'set this to true or false');
      if (decision !== undefined) delete parsed.allowBuilds[scriptPolicy.selector];
      if (!scriptPolicy.parsed.allowBuilds && Object.keys(parsed.allowBuilds ?? {}).length === 0) delete parsed.allowBuilds;
      assert.deepEqual(parsed, scriptPolicy.parsed, 'refuse to overwrite unrelated script policy changes');
      assert.equal(await readFile(scriptPolicy.path, 'utf8'), actual);
      await writeFile(scriptPolicy.path, scriptPolicy.original);
      assert.equal(await readFile(scriptPolicy.path, 'utf8'), scriptPolicy.original);
      report.testApprovalRemoved = true;
      if (scriptTimeout && seed) {
        assert.deepEqual(await hashes(), seed.before); report.originalProfileRestored = true;
      }
    } catch (error) { report.policyRestoreError = error.message; report.passed = false; process.exitCode = 1; }
  }
  if (grantAttempted) {
    try {
      await authenticate(); await request('/api/dsh-mobile', { action: 'management', deviceId: (await binding()).id, enabled: false });
      assert.equal((await binding()).management, false); report.managementRestored = true;
      await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
      await reconnect();
      if ((await connection()).selected !== live.session.sessionId)
        await main.locator('.remote-session-row').filter({ hasText: live.session.title }).click();
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      assert.equal((await connection()).selected, live.session.sessionId);
      assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
      report.primaryRestored = true;
      await capture(prefix + reportSuffix + '-restored');
    } catch (error) { report.permissionRestoreError = error.message; report.passed = false; process.exitCode = 1; }
  }
  if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, failure: report.failure, managementRestored: report.managementRestored,
    executionMode: state.executionMode, unknownOutcomeVisible: report.unknownOutcomeVisible }));
  await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
