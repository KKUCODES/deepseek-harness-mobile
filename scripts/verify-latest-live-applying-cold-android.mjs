// 真实原管理器的 applying 阶段：只延长测试 HMR 排队，不替换安装、回执或恢复实现。
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const flags = process.argv.slice(2);
assert.ok(flags.length <= 3 && new Set(flags).size === flags.length
  && flags.every(flag => ['--cleanup', '--stop-owned-host'].includes(flag) || /^--attempt-[2-9]$/.test(flag)));
assert.ok(flags.filter(flag => /^--attempt-/.test(flag)).length <= 1);
const cleanupOnly = flags.includes('--cleanup');
const stopOwnedHost = flags.includes('--stop-owned-host');
assert.ok(!cleanupOnly || !stopOwnedHost);
const attempt = flags.find(flag => /^--attempt-/.test(flag));
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const statePath = resolve(runtime, 'latest-live-state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
assert.ok(['release', 'source'].includes(state.executionMode));
assert.equal(state.autoReviewDiagnostic, false); assert.equal(state.installTimeoutDiagnostic, false);
process.kill(state.hostPid, 0); process.kill(state.supervisorPid, 0);
if (state.executionMode === 'release') {
  const plan = await (await import('../../plugin/compatibility/latest-upstream/package-range-runtime.mjs')).readInstalledLatestPackageRange();
  assert.equal(plan.files.length, 5); assert.equal(plan.patched, 5);
} else await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
const scenarioPrefix = `latest-live-${state.executionMode}-applying-cold-phone${attempt?.replace('--', '-') ?? ''}`;
const prefix = scenarioPrefix + (cleanupOnly ? '-cleanup' : '');
const reportPath = resolve(runtime, prefix + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const profile = resolve(state.home, 'profiles/web');
const recovery = cleanupOnly ? JSON.parse(await readFile(resolve(runtime, scenarioPrefix + '.json'), 'utf8')) : undefined;
const fixtureNonce = randomUUID().slice(0, 8);
const baseNames = ['applying-gate-verification', 'applying-target-verification'];
const names = cleanupOnly ? recovery.names ?? baseNames : baseNames.map(name => `${name}-${fixtureNonce}`);
assert.equal(names.length, 2);
names.forEach((name, index) => assert.ok(name === baseNames[index] || new RegExp(`^${baseNames[index]}-[a-f0-9]{8}$`).test(name)));
const packageName = name => `@dsh-mobile/${name}`;
const originals = Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']
  .map(async name => [name, await readFile(resolve(profile, name))])));
if (cleanupOnly) {
  assert.equal(recovery.home, state.home); assert.equal(recovery.executionMode, state.executionMode);
  assert.equal(recovery.passed, false); assert.equal(recovery.managementRestored, true);
  assert.ok(recovery.stage === 'helper-install' && recovery.failure.name === 'TimeoutError'
    || recovery.stage === 'target-install' && recovery.actualApplyingObserved === true
      && recovery.appStoppedBeforeHost === true && recovery.failure.message === 'applying_core_host_not_stopped');
} else for (const name of names) assert.equal(JSON.parse(originals['package.json']).dependencies?.[packageName(name)], undefined);
const owned = await mkdtemp(resolve(runtime, prefix + '-owned-'));
const base = resolve(owned, 'hmr-gate').replaceAll('\\', '/');
const specs = {};
for (const [index, name] of cleanupOnly ? [] : names.entries()) {
  const fixture = resolve(import.meta.dirname, '../tests/fixtures', index === 0 ? 'applying-gate-plugin' : 'applying-target-plugin');
  const dir = resolve(owned, name, 'package'); await mkdir(dir, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(fixture, 'package.json'), 'utf8'));
  assert.equal(manifest.name, packageName(baseNames[index])); assert.equal(manifest.scripts, undefined);
  manifest.name = packageName(name);
  manifest.peerDependencies = { '@deepseek-ai/dsh': '0.2.1-alpha.1' };
  await writeFile(resolve(dir, 'package.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  let source = await readFile(resolve(fixture, 'index.js'), 'utf8');
  if (index === 0) {
    const declaration = "const base = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/plugin-applying-gate';";
    assert.ok(source.includes(declaration));
    source = source.replace(declaration, `const base = ${JSON.stringify(base)};`);
    const bound = 'Math.min(arm.expiresAt, Date.now() + 45000)'; assert.ok(source.includes(bound));
    source = source.replace(bound, 'Math.min(arm.expiresAt, Date.now() + 85000)');
    const applyDeclaration = 'export function apply(ctx) {'; assert.ok(source.includes(applyDeclaration));
    source = source.replace(applyDeclaration, applyDeclaration + '\n  writeFileSync(`${base}.boot.json`, JSON.stringify({ base, moduleUrl: import.meta.url, pid: process.pid }), { mode: 0o600 });');
  }
  await writeFile(resolve(dir, 'index.js'), source, { flag: 'wx' });
  const originalPatch = await readFile(resolve(fixture, 'cordis.patch.yml'), 'utf8');
  assert.ok(originalPatch.includes(baseNames[index]));
  await writeFile(resolve(dir, 'cordis.patch.yml'), originalPatch.replaceAll(baseNames[index], name), { flag: 'wx' });
  specs[name] = resolve(owned, name + '.tgz').replaceAll('\\', '/');
  execFileSync('C:/Windows/system32/tar.exe', ['-czf', specs[name], '-C', resolve(dir, '..'), 'package'], { cwd: owned, windowsHide: true });
}
let live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
let { page, main, device, capture } = live;
let manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
const report = { at: new Date().toISOString(), executionMode: state.executionMode, home: state.home,
  previousHostPid: state.hostPid, fixtureHome: owned, specs, names, passed: false, managementRestored: false, pageErrors: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
let cookie, entry, grantAttempted = false, original, token, hostRecovered = false;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
async function waitFor(probe, label, ms = 30000) {
  const deadline = Date.now() + ms;
  for (;;) { const value = await probe(); if (value) return value;
    assert.ok(Date.now() < deadline, label); await new Promise(done => setTimeout(done, 100)); }
}
async function authenticate() {
  const current = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(current.home, state.home); assert.equal(current.origin, state.origin);
  assert.equal(current.executionMode, state.executionMode); assert.equal(current.ready, true);
  process.kill(current.hostPid, 0); process.kill(current.supervisorPid, 0);
  entry = new URL(JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8')).loginURL);
  assert.equal(entry.hostname, '127.0.0.1'); assert.equal(entry.protocol, 'http:');
  const response = await fetch(entry, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 303); cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  return current;
}
async function request(body) {
  const response = await fetch(new URL('/api/dsh-mobile', entry), { method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); return response.json();
}
async function binding() {
  const current = await request(); assert.equal(current.connection, 'online'); assert.equal(current.origin, state.origin);
  const row = current.devices.find(item => item.id === '9f44abd1-12b1-4a9a-9bad-4f43837e820d');
  assert.equal(row?.fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco'); assert.equal(row.status, 'active'); return row;
}
async function connection() {
  if (!await main.isVisible()) return null;
  return main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const snapshot = fiber.memoizedProps.model.getSnapshot();
      return { ready: snapshot.ready, connection: snapshot.connectionState, plugins: snapshot.plugins?.state, selected: snapshot.selected };
    }
    return null;
  });
}
async function reconnect() {
  await waitFor(async () => {
    const current = await connection(); if (current?.ready && current.connection === 'connected') return true;
    const button = page.getByRole('button', { name: '重新连接', exact: true });
    if (await button.isVisible() && await button.isEnabled({ timeout: 1000 }).catch(error => { if (error.name === 'TimeoutError') return false; throw error; })) {
      assert.equal(await page.getByTestId('remote-fingerprint').textContent(), 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
      await button.click({ timeout: 1000 }).catch(error => { if (error.name !== 'TimeoutError') throw error; });
    }
    return false;
  }, 'applying_cold_reconnect_failed', 90000);
}
async function openManager() {
  await waitFor(async () => (await connection())?.plugins === 'ready', 'applying_plugin_directory_not_ready');
  if (!await manager.isVisible()) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
  }
  await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
}
async function install(name) {
  await manager.getByRole('button', { name: '添加插件', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
  await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(specs[name]);
  await dialog.getByRole('button', { name: '安装', exact: true }).click();
  return page.getByRole('dialog').filter({ has: page.locator('[data-install-phase]') });
}
const readGate = async () => { try { return JSON.parse(await readFile(base + '.status.json', 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
try {
  await authenticate(); assert.equal((await binding()).management, false);
  original = await live.readSession(); assert.equal(original.row.running, false);
  assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  grantAttempted = true;
  await request({ action: 'management', deviceId: (await binding()).id, enabled: true });
  await page.getByRole('button', { name: '重新连接', exact: true }).waitFor(); await reconnect(); await openManager();
  if (cleanupOnly) {
    report.recoveryOf = scenarioPrefix + '.json'; report.passed = true;
  } else {
  report.stage = 'helper-install';
  const helper = await install(names[0]);
  await helper.getByRole('button', { name: '立即启用', exact: true }).click({ timeout: 60000 });
  await helper.waitFor({ state: 'detached' });
  await manager.getByRole('button', { name: new RegExp(`^查看 .*${names[0]}$`) }).click();
  await waitFor(async () => {
    const toggle = manager.getByRole('switch', { name: new RegExp(`^启用 .*${names[0]}$`) });
    return await toggle.getAttribute('aria-checked') === 'true' && await toggle.isEnabled();
  }, 'applying_helper_not_enabled');
  await manager.getByRole('button', { name: '返回插件列表', exact: true }).click(); report.helperEnabled = true;
  const boot = JSON.parse(await readFile(base + '.boot.json', 'utf8'));
  assert.equal(boot.base, base); assert.ok(alive(boot.pid)); assert.ok(boot.moduleUrl.includes(fixtureNonce));
  report.actualHelperModule = boot;
  if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null)
    await manager.getByText('最近插件操作', { exact: true }).click();
  token = randomUUID(); await writeFile(base + '.arm.json', JSON.stringify({ token, expiresAt: Date.now() + 85000 }), { flag: 'wx' });
  const dialog = await install(names[1]); report.stage = 'target-install';
  const gate = await waitFor(async () => { const value = await readGate(); return value?.token === token ? value : null; }, 'applying_gate_missing');
  assert.equal(gate.state, 'holding'); assert.match(gate.requestId, /^[0-9a-f-]{36}$/);
  await dialog.locator('[data-install-phase="applying"]').waitFor(); report.actualApplyingObserved = true;
  report.originalRequestId = gate.requestId;
  const pending = manager.locator('[data-operation-state="pending"]').filter({ hasText: specs[names[1]] }); await pending.waitFor();
  report.operationId = await pending.getAttribute('data-operation-id'); assert.match(report.operationId, /^[0-9a-f-]{36}$/);
  const durable = await main.evaluate((element, id) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client)
      return fiber.memoizedProps.model.draftStore.readPluginOperations().find(item => item.id === id);
  }, report.operationId);
  assert.equal(durable?.state, 'pending'); assert.equal(durable.target, specs[names[1]]); assert.equal(durable.payload, undefined);
  report.durableSummaryBeforeExit = durable;
  const manifest = JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8'));
  assert.ok(manifest.dependencies?.[packageName(names[1])]);
  await assert.rejects(access(resolve(profile, '.plugin-manager/run.json')), { code: 'ENOENT' });
  report.pnpmFinishedBeforeExit = true;
  const rows = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { cwd: runtime, windowsHide: true, encoding: 'utf8' })
    .split(/\r?\n/).map(row => row.trim().split(/\s+/)).filter(row => row[0] === 'TCP' && row[1] === entry.host && row[3] === 'LISTENING');
  assert.equal(rows.length, 1); report.coreHostPid = Number(rows[0][4]); assert.ok(alive(report.coreHostPid));
  report.timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await capture(prefix + '-applying');
  report.previousAppPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
  assert.ok(Number.isSafeInteger(report.previousAppPid) && report.previousAppPid > 0);
  await device.shell('am force-stop dev.dshmobile.validation.latesttest');
  assert.equal((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim(), '');
  report.appStoppedBeforeHost = true;
  await writeFile(resolve(runtime, prefix + '-seed.json'), JSON.stringify({ ...report, originalSeq: original.projections.asOfSeq,
    originalRecords: original.records, originalValues: original.projections.values }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ readyForHostExit: true, executionMode: state.executionMode, coreHostPid: report.coreHostPid, operationId: report.operationId }));
  if (stopOwnedHost) {
    const current = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(current.home, state.home); assert.equal(current.hostPid, state.hostPid);
    assert.equal(current.executionMode, state.executionMode); assert.equal((await readGate()).state, 'holding');
    // 驱动运行在DSH树外；只结束从本轮实际监听表取得的核心，不结束包装器或子树。
    const args = ['/PID', String(report.coreHostPid), '/F'];
    execFileSync('taskkill.exe', args, { cwd: runtime, windowsHide: true, stdio: 'ignore' });
    report.hostExitMethod = { binary: 'taskkill.exe', args, outsideDshTree: true };
  }
  await waitFor(() => !alive(report.coreHostPid), 'applying_core_host_not_stopped', 60000);
  assert.equal((await readGate()).state, 'holding'); report.hostExitedWhileApplying = true;
  console.log(JSON.stringify({ disconnected: true }));
  const restored = await waitFor(async () => { const next = JSON.parse(await readFile(statePath, 'utf8'));
    return next.hostPid !== state.hostPid && alive(next.hostPid) && alive(next.supervisorPid) ? next : null;
  }, 'applying_new_host_missing', 180000);
  await authenticate(); hostRecovered = true; report.hostPid = restored.hostPid; assert.equal((await binding()).management, true);
  await device.close();
  const adb = process.env.ADB_PATH; assert.equal(adb, 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe');
  execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'am', 'start', '-n',
    'dev.dshmobile.validation.latesttest/dev.dshmobile.validation.ValidationActivity'], { cwd: runtime, windowsHide: true });
  await waitFor(() => { try { return /^[1-9]\d*$/.test(execFileSync(adb, ['-s', 'emulator-5554', 'shell', 'pidof',
    'dev.dshmobile.validation.latesttest'], { cwd: runtime, windowsHide: true, encoding: 'utf8' }).trim()); }
    catch (error) { if (error.status === 1 && !String(error.stdout ?? '').trim()) return false; throw error; }
  }, 'applying_cold_app_not_started');
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true }); ({ page, main, device, capture } = live);
  page.on('pageerror', error => report.pageErrors.push(error.message)); manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  report.appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
  assert.notEqual(report.appPid, report.previousAppPid); assert.notEqual(await page.evaluate(() => performance.timeOrigin), report.timeOrigin);
  await openManager();
  if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null) await manager.getByText('最近插件操作', { exact: true }).click();
  await manager.getByRole('button', { name: '刷新操作记录', exact: true }).click();
  const unknown = manager.locator(`[data-operation-id="${report.operationId}"][data-operation-state="unknown"]`); await unknown.waitFor();
  await unknown.getByText('无法确认结果，请核对电脑插件列表。', { exact: true }).waitFor();
  assert.ok((await unknown.innerText()).includes(specs[names[1]])); assert.equal(await unknown.getByRole('button').count(), 0);
  report.unknownOutcomeVisible = true; report.noRetry = true; await capture(prefix + '-unknown');
  await manager.getByText('最近插件操作', { exact: true }).click();
  await manager.getByRole('alert').getByText('有插件操作的结果尚未确认，请展开最近插件操作并核对电脑插件列表。', { exact: true }).waitFor();
  report.collapsedUnknownVisible = true;
  const after = await live.readSession(); assert.deepEqual(after.records, original.records); assert.deepEqual(after.projections.values, original.projections.values);
  report.originalHistoryPreserved = true; report.originalProjectionPreserved = true;
  const actual = JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8'));
  assert.ok(actual.dependencies?.[packageName(names[1])]); report.targetFilesRetained = true;
  report.passed = true;
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message, code: error.code }; process.exitCode = 1;
  await capture(prefix + '-failure').catch(() => {});
} finally {
  if (token) await writeFile(base + '.release.json', JSON.stringify({ token }));
  if (grantAttempted) {
    try {
      await authenticate();
      // 只通过原管理页卸载本轮精确包；未恢复Host时保留失败现场，不直接改写profile。
      if (alive(state.hostPid) || hostRecovered) {
        await reconnect();
        const openInstall = page.getByRole('dialog').filter({ has: page.locator('[data-install-phase]') });
        if (await openInstall.isVisible()) await openInstall.getByRole('button', { name: '关闭', exact: true }).click();
        await openManager();
        for (const name of [...names].reverse()) {
          const manifest = JSON.parse(await readFile(resolve(profile, 'package.json'), 'utf8'));
          if (!manifest.dependencies?.[packageName(name)]) continue;
          if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).isVisible())
            await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
          await manager.getByRole('button', { name: '刷新', exact: true }).click();
          await manager.getByRole('button', { name: new RegExp(`^查看 .*${name}$`) }).click();
          await manager.getByRole('button', { name: new RegExp(`^卸载 .*${name}$`) }).click();
          const confirm = page.getByRole('dialog', { name: new RegExp(`^卸载「.*${name}」？$`) });
          await confirm.getByRole('button', { name: '卸载', exact: true }).click(); await confirm.waitFor({ state: 'detached' });
          await manager.locator(`[data-plugin-package="${packageName(name)}"]`).waitFor({ state: 'detached' });
          await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
        }
        for (const [name, bytes] of Object.entries(originals)) {
          const actual = await readFile(resolve(profile, name));
          if (cleanupOnly) assert.equal(createHash('sha256').update(actual).digest('hex'), recovery.originalProfileHashes[name], name);
          else assert.deepEqual(actual, bytes, name);
        }
        report.profileRestored = true; report.testPackagesRemoved = true;
      }
    } catch (error) { report.cleanupError = error.message; report.passed = false; process.exitCode = 1; }
    try {
      await authenticate(); await request({ action: 'management', deviceId: (await binding()).id, enabled: false });
      assert.equal((await binding()).management, false); report.managementRestored = true;
      await page.getByRole('button', { name: '重新连接', exact: true }).waitFor(); await reconnect();
      if ((await connection()).selected !== live.session.sessionId) await main.locator('.remote-session-row').filter({ hasText: live.session.title }).click();
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
      if (original) { const restored = await live.readSession(); assert.deepEqual(restored.records, original.records); assert.deepEqual(restored.projections.values, original.projections.values); }
      assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.pageErrors, []);
      report.primaryRestored = true; await capture(prefix + '-restored');
    } catch (error) { report.permissionRestoreError = error.message; report.passed = false; process.exitCode = 1; }
  }
  report.originalProfileHashes = Object.fromEntries(Object.entries(originals).map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]));
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, failure: report.failure, cleanupError: report.cleanupError, managementRestored: report.managementRestored }));
  await device.close().catch(() => {});
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
