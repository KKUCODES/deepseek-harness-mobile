// 原手机 Creator 入口及真实模型专项；不生成模式内容替代模型，不读取 Key。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, lstat, readFile, readdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['prepare', 'start', 'observe', 'approve', 'approve-recover', 'use-start', 'use-observe', 'replay', 'cold-baseline', 'cold-replay', 'cleanup', 'cleanup-recover', 'finish'].includes(phase));
const reconnectAttempt = ['--reconnect', '--reconnect-reuse'].includes(process.argv[3]);
const observeAttempt = phase === 'observe' && /^--poll-[1-9][0-9]?$/.test(process.argv[3] ?? '');
assert.ok(process.argv.length === 3 || process.argv.length === 4 && (reconnectAttempt && phase === 'prepare' || observeAttempt));
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
assert.ok(['source', 'release'].includes(state.executionMode));
assert.equal(state.autoReviewDiagnostic, false);
process.kill(state.hostPid, 0); process.kill(state.supervisorPid, 0);
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'creator';
const seedPath = resolve(runtime, prefix + '-seed.json');
const sessionFile = prefix + '-session.json';
const reportPath = resolve(runtime, prefix + '-' + phase + (reconnectAttempt || observeAttempt ? process.argv[3].slice(1) : '') + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
if (phase === 'prepare') {
  await assert.rejects(access(seedPath), { code: 'ENOENT' });
  await assert.rejects(access(resolve(runtime, sessionFile)), { code: 'ENOENT' });
}
const live = await openLatestLiveAndroid(phase === 'prepare' ? undefined : sessionFile, { openRecorded: true, reconnectRecorded: true });
const { page, main, device, capture, readSession } = live;
assert.equal(live.state.hostPid, state.hostPid);
const report = { phase, home: state.home, hostPid: state.hostPid, executionMode: state.executionMode,
  passed: false, managementRestored: false };
const url = new URL(JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8')).loginURL);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
async function request(path, body) {
  const response = await fetch(new URL(path, url), { method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, 200, 'latest_creator_http_' + response.status);
  return response.json();
}
async function rpc(method, args) {
  assert.ok(['session/list', 'session/projections', 'session/page', 'session/rename', 'agentPresets/list'].includes(method));
  const rpcId = randomUUID();
  const frame = await request('/api/' + method, { type: 'client-request', rpcId, method, payload: { args } });
  assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true, 'latest_creator_original_rpc_refused');
  return frame.result.value;
}
async function devices() {
  const current = await request('/api/dsh-mobile');
  assert.equal(current.connection, 'online'); assert.equal(current.origin, state.origin);
  const binding = current.devices.find(row => row.id === '9f44abd1-12b1-4a9a-9bad-4f43837e820d');
  assert.equal(binding?.fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(binding.status, 'active'); return binding;
}
async function connected() {
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  await reconnect.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await page.getByTestId('remote-fingerprint').textContent(), 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  await reconnect.click();
  await main.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="remote-workspace"]'); if (!element) return false;
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) {
        const snapshot = fiber.memoizedProps.model.getSnapshot();
        return snapshot.connectionState === 'connected' && snapshot.ready;
      }
    return false;
  }, undefined, { timeout: 30000 });
}
async function selected() {
  return main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('latest_creator_selected_missing');
  });
}
async function originalSession(id) {
  assert.ok([seed.sessionId, seed.useSessionId].includes(id));
  const projections = await rpc('session/projections', { request: { sessionId: id } });
  const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: id },
    throughSeq: projections.asOfSeq, maxMessages: 60 } });
  const row = (await rpc('session/list', { _request: {} })).items.find(row => row.sessionId === id);
  assert.equal(resolve(row.cwd), state.workspacePath);
  return { projections, records: history.records, row };
}
async function openUse() {
  await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  await main.locator('.remote-session-row').filter({ hasText: seed.useTitle }).click();
  await main.locator('.remote-heading strong').getByText(seed.useTitle, { exact: true }).waitFor();
  assert.equal(await selected(), seed.useSessionId);
}
let grantAttempted = false, seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
try {
  if (phase === 'prepare') {
    const original = await readSession(); assert.equal(original.row.running, false);
    assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await devices()).management, false);
    grantAttempted = true;
    await request('/api/dsh-mobile', { action: 'management', deviceId: (await devices()).id, enabled: true });
    assert.equal((await devices()).management, true); await connected();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑设置', exact: true }).click();
    await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
    await page.getByRole('button', { name: '让 Agent 帮我创建预设模式', exact: true }).click();
    await page.getByRole('combobox', { name: '设置页面', exact: true }).waitFor({ state: 'detached' });
    await main.getByRole('button', { name: /^(Agent 模式，当前 )?创\s*造\s*模\s*式$/, exact: true }).waitFor();
    const selected = await main.evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
      throw Error('latest_creator_selected_missing');
    });
    if (selected === state.sessionId) assert.match(selected, /^latest-live-[0-9a-f-]{36}$/);
    else assert.match(selected, /^session-[0-9a-f-]{36}$/);
    assert.notEqual(selected, live.session.sessionId);
    const row = (await rpc('session/list', { _request: {} })).items.find(row => row.sessionId === selected);
    assert.equal(row.blank, true); assert.equal(row.running, false); assert.equal(resolve(row.cwd), state.workspacePath);
    const projection = await rpc('session/projections', { request: { sessionId: selected } });
    assert.equal(projection.values.agentPreset, 'cordis');
    const id = 'dshm-creator-' + randomUUID();
    const title = 'DSHM 新版模式创作 ' + (state.executionMode === 'source' ? 'SOURCE' : 'RELEASE');
    await rpc('session/rename', { request: { sessionId: selected, title } });
    await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
    seed = { home: state.home, sessionId: selected, title, id, packageName: '@local/' + id,
      directory: resolve(state.workspacePath, id), initialSeq: projection.asOfSeq,
      marker: 'DSHM_CREATOR_' + randomUUID().replaceAll('-', ''), creatorEntryVerified: true,
      parentSessionId: live.session.sessionId, parentSeq: original.projections.asOfSeq };
    await assert.rejects(access(seed.directory), { code: 'ENOENT' });
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(resolve(runtime, sessionFile), JSON.stringify({ home: state.home, sessionId: selected, title }), { flag: 'wx' });
    const retained = await rpc('session/page', { request: { address: { kind: 'session', sessionId: live.session.sessionId },
      throughSeq: original.projections.asOfSeq, maxMessages: 60 } });
    assert.deepEqual(retained.records.map(row => row.event), original.records.map(row => row.event));
    report.creatorEntryVerified = true; report.parentHistoryPreserved = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, live.session.sessionId);
    assert.equal(dirname(seed.directory), state.workspacePath); assert.match(seed.id, /^dshm-creator-[0-9a-f-]{36}$/);
    assert.equal(seed.directory, resolve(state.workspacePath, seed.id));
    assert.equal((await devices()).management, false);
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    if (phase === 'start') {
      assert.equal(seed.startAttempted, undefined); const original = await readSession();
      assert.equal(original.row.blank, true); assert.equal(original.row.running, false);
      assert.equal(original.projections.values.agentPreset, 'cordis');
      assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await input.innerText()).trim(), '');
      seed.initialSeq = original.projections.asOfSeq;
      seed.prompt = `这是独立的 DSHM 模式创作验收，不补做以前任务。请真实创建并安装一个最小聊天模式：模式标识 ${seed.id}，名称“手机创作验收”，只挂载内置 @deepseek-ai/dsh-persona，persona prefix要求它面对任何用户消息仅回复“${seed.marker}_REPLY 中文🙂”，不注册工具。先只加载 editing-cordis-compositions skill，再只用两次write在 ${seed.directory} 创建package.json和cordis.patch.yml，依照官方组合声明规范自行编写内容；包名 ${seed.packageName}，版本1.0.0，private=true，type=module，没有dependencies、scripts或其他文件。随后只调用一次plugin_manager，action=install_bundle，target为这个绝对目录，等待手机单次批准；不切换会话权限，不批准安装脚本，不创建版本豁免，不读写其他路径或Key，不执行Shell/联网工具/其他插件操作，也不重试。安装成功只回复 ${seed.marker}_CREATED；任何失败或拒绝立即停止并报告原错误。`;
      seed.startAttempted = true; await persist();
      await input.fill(seed.prompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await persist(); report.sent = true;
    } else if (phase === 'finish') {
      const cleanup = JSON.parse(await readFile(resolve(runtime, prefix + '-cleanup-recover.json'), 'utf8'));
      assert.equal(cleanup.passed, true); assert.equal(cleanup.managementRestored, true);
      assert.equal(cleanup.removed.length, 2);
      const primary = JSON.parse(await readFile(resolve(runtime, 'latest-live-android-session.json'), 'utf8'));
      assert.equal(primary.sessionId, seed.parentSessionId); assert.equal(primary.home, state.home);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: primary.title }).click();
      await main.locator('.remote-heading strong').getByText(primary.title, { exact: true }).waitFor();
      assert.equal(await selected(), primary.sessionId);
      assert.equal((await input.innerText()).trim(), '');
      const projections = await rpc('session/projections', { request: { sessionId: primary.sessionId } });
      assert.equal(projections.values.permissions.currentValue, 'workspace-write');
      const row = (await rpc('session/list', { _request: {} })).items.find(item => item.sessionId === primary.sessionId);
      assert.equal(row.running, false);
      assert.equal(await page.locator('iframe').count(), 0);
      report.primaryRestored = { sessionId: primary.sessionId, asOfSeq: projections.asOfSeq, emptyDraft: true, permission: 'workspace-write' };
    } else if (phase === 'cleanup' || phase === 'cleanup-recover') {
      if (phase === 'cleanup-recover') {
        const previous = JSON.parse(await readFile(resolve(runtime, prefix + '-cleanup.json'), 'utf8'));
        assert.equal(previous.home, state.home); assert.equal(previous.passed, false);
        assert.equal(previous.removed, undefined); assert.equal(previous.managementRestored, true);
      }
      const owned = [];
      for (const ownerPrefix of ['latest-live-source-creator', 'latest-live-creator']) {
        const owner = JSON.parse(await readFile(resolve(runtime, ownerPrefix + '-seed.json'), 'utf8'));
        const evidence = JSON.parse(await readFile(resolve(runtime, ownerPrefix + '-cold-replay.json'), 'utf8'));
        assert.equal(owner.home, state.home); assert.equal(evidence.home, state.home); assert.equal(evidence.passed, true);
        assert.equal(owner.packageName, '@local/' + owner.id); assert.match(owner.id, /^dshm-creator-[0-9a-f-]{36}$/);
        assert.equal(owner.directory, resolve(state.workspacePath, owner.id));
        assert.equal((await lstat(owner.directory)).isSymbolicLink(), false);
        assert.deepEqual((await readdir(owner.directory)).sort(), ['cordis.patch.yml', 'package.json']);
        const ownerProjection = await rpc('session/projections', { request: { sessionId: owner.sessionId } });
        const events = await rpc('session/page', { request: { address: { kind: 'session', sessionId: owner.sessionId },
          throughSeq: ownerProjection.asOfSeq, maxMessages: 60 } });
        const writes = events.records.map(row => row.event).filter(event => event.type === 'tool/call' && event.data.name === 'write');
        assert.equal(writes.length, 2);
        for (const event of writes) {
          const args = JSON.parse(event.data.arguments);
          assert.ok(['package.json', 'cordis.patch.yml'].some(name => resolve(owner.directory, name) === resolve(args.file_path)));
          assert.equal((await lstat(args.file_path)).isSymbolicLink(), false);
          assert.equal(await readFile(args.file_path, 'utf8'), args.content);
        }
        const histories = [];
        for (const id of [owner.sessionId, owner.useSessionId]) {
          const projection = await rpc('session/projections', { request: { sessionId: id } });
          const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: id },
            throughSeq: projection.asOfSeq, maxMessages: 60 } });
          histories.push({ id, seq: projection.asOfSeq, events: history.records.map(row => row.event) });
        }
        owned.push({ ...owner, writes, histories });
      }
      const before = await rpc('agentPresets/list', {});
      assert.ok(owned.every(owner => before.presets.some(item => item.id === owner.id)));
      grantAttempted = true;
      await request('/api/dsh-mobile', { action: 'management', deviceId: (await devices()).id, enabled: true });
      assert.equal((await devices()).management, true); await connected();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
      const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
      report.removed = [];
      for (const owner of owned) {
        const card = manager.locator(`[data-plugin-package="${owner.packageName}"]`); await card.waitFor();
        await card.getByRole('button', { name: '查看 ' + owner.packageName, exact: true }).click();
        await manager.getByRole('button', { name: '卸载 ' + owner.packageName, exact: true }).click();
        const confirm = page.getByRole('dialog', { name: '卸载「' + owner.packageName + '」？', exact: true });
        await confirm.getByRole('button', { name: '卸载', exact: true }).click();
        await confirm.waitFor({ state: 'detached' });
        const deadline = Date.now() + 60000;
        while ((await rpc('agentPresets/list', {})).presets.some(item => item.id === owner.id)) {
          assert.ok(Date.now() < deadline, 'latest_creator_removal_timeout'); await new Promise(done => setTimeout(done, 200));
        }
        await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor(); await card.waitFor({ state: 'detached' });
        const profile = JSON.parse(await readFile(resolve(state.home, 'profiles/web/package.json'), 'utf8'));
        assert.equal(profile.dependencies?.[owner.packageName], undefined);
        for (const original of owner.histories) {
          const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: original.id },
            throughSeq: original.seq, maxMessages: 60 } });
          assert.deepEqual(history.records.map(row => row.event), original.events);
        }
        for (const event of owner.writes) {
          const args = JSON.parse(event.data.arguments);
          assert.equal(await readFile(args.file_path, 'utf8'), args.content); await unlink(args.file_path);
        }
        assert.deepEqual(await readdir(owner.directory), []); await rmdir(owner.directory);
        report.removed.push({ id: owner.id, packageName: owner.packageName, originalHistoriesPreserved: true, exactFilesRemoved: true });
      }
      const after = await rpc('agentPresets/list', {});
      assert.deepEqual(after.presets, before.presets.filter(item => !owned.some(owner => owner.id === item.id)));
      report.unrelatedRosterPreserved = true;
    } else if (['use-start', 'use-observe', 'replay', 'cold-baseline', 'cold-replay'].includes(phase)) {
      assert.equal(seed.approvalSent, true);
      const creator = await readSession();
      assert.equal(creator.row.running, false);
      assert.equal(creator.projections.values.agentPreset, 'cordis');
      const events = creator.records.map(row => row.event).filter(event => event.seq > seed.initialSeq);
      const calls = events.filter(event => event.type === 'tool/call');
      assert.deepEqual(calls.map(event => event.data.name), ['skill', 'write', 'write', 'plugin_manager']);
      const results = events.filter(event => event.type === 'tool/result');
      assert.equal(results.length, 4); assert.ok(results.every(event => !event.data.message.isError));
      const result = results.find(event => event.data.message.toolCallId === seed.installCallId);
      const installation = JSON.parse(result.data.message.content.find(part => part.type === 'text').text);
      assert.equal(installation.application, 'applied'); assert.equal(installation.bundle, seed.packageName);
      assert.equal(installation.version, '1.0.0'); assert.equal(installation.packageResult.exitCode, 0);
      const decisions = events.filter(event => event.type === 'approval/decided');
      assert.equal(decisions.length, 1);
      assert.ok(events.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes(seed.marker + '_CREATED')));
      const roster = await rpc('agentPresets/list', {});
      const preset = roster.presets.find(item => item.id === seed.id); assert.ok(preset);
      assert.equal(preset.name, '手机创作验收'); assert.equal(preset.isDefault, false);
      report.installation = { application: installation.application, bundle: installation.bundle, version: installation.version,
        callId: seed.installCallId, resultSeq: result.seq, approvalDecisions: decisions.length };
      if (phase === 'use-start') {
        assert.equal(seed.useAttempted, undefined);
        await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
        await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'test-project', exact: true }).click();
        await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
        seed.useSessionId = await selected(); assert.match(seed.useSessionId, /^session-[0-9a-f-]{36}$/);
        assert.notEqual(seed.useSessionId, seed.sessionId); seed.useTitle = 'DSHM 新版创作模式使用 ' + state.executionMode.toUpperCase();
        const initial = await originalSession(seed.useSessionId); assert.equal(initial.row.blank, true);
        assert.equal(initial.row.running, false); assert.equal(initial.projections.values.permissions.currentValue, 'workspace-write');
        await rpc('session/rename', { request: { sessionId: seed.useSessionId, title: seed.useTitle } });
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: 'Agent 模式', exact: true }).click();
        const option = page.locator(`[data-agent-preset="${seed.id}"]`); await option.waitFor();
        assert.equal(await option.isEnabled(), true); await option.click();
        await page.locator(`[data-agent-preset="${seed.id}"][aria-pressed="true"]`).waitFor();
        await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
        const original = await originalSession(seed.useSessionId); assert.equal(original.projections.values.agentPreset, seed.id);
        assert.equal(original.row.blank, true); seed.useInitialSeq = original.projections.asOfSeq;
        seed.usePrompt = '请按当前模式回复。'; seed.useAttempted = true; await persist();
        assert.equal((await input.innerText()).trim(), ''); await input.fill(seed.usePrompt);
        await main.getByRole('button', { name: '发送消息', exact: true }).click();
        seed.useSent = true; await persist(); report.useSent = true;
      } else {
        assert.equal(seed.useSent, true); await openUse();
        await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker + '_REPLY 中文🙂' }).waitFor({ timeout: 90000 });
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
        const original = await originalSession(seed.useSessionId);
        assert.equal(original.row.running, false); assert.equal(original.projections.values.agentPreset, seed.id);
        const rows = original.records.map(row => row.event).filter(event => event.seq > seed.useInitialSeq);
        assert.equal(rows.filter(event => event.type === 'user/message' && event.data.content?.some(part => part.text === seed.usePrompt)).length, 1);
        assert.equal(rows.filter(event => event.type === 'tool/call').length, 0);
        assert.ok(rows.some(event => event.type === 'assistant/message' && event.data.message?.content?.some(part => part.type === 'text' && part.text.trim() === seed.marker + '_REPLY 中文🙂')));
        assert.ok(rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
        assert.equal((await input.innerText()).trim(), '');
        if (phase === 'use-observe') {
          seed.creatorHistory = creator.records.map(row => row.event); seed.useHistory = original.records.map(row => row.event); await persist();
        } else if (phase === 'cold-baseline') {
          seed.cold = { hostPid: state.hostPid, creator: creator.records.map(row => row.event),
            use: original.records.map(row => row.event), creatorValues: creator.projections.values, useValues: original.projections.values };
          await persist(); report.coldBaseline = true;
        } else if (phase === 'cold-replay') {
          assert.notEqual(state.hostPid, seed.cold.hostPid);
          const verify = (before, after) => {
            assert.deepEqual(after.slice(0, before.length), before);
            const appended = after.slice(before.length); assert.ok(appended.length <= 1);
            if (appended.length) {
              assert.notEqual(before.at(-1).type, 'session/end-seed');
              assert.equal(appended[0].type, 'session/end-seed'); assert.deepEqual(appended[0].data, {});
              assert.equal(appended[0].seq, before.at(-1).seq + 1);
            }
            return { retainedEvents: before.length, recoveryMarkers: appended.length };
          };
          report.coldRecovery = { creator: verify(seed.cold.creator, creator.records.map(row => row.event)),
            use: verify(seed.cold.use, original.records.map(row => row.event)) };
          assert.deepEqual(creator.projections.values, seed.cold.creatorValues);
          assert.deepEqual(original.projections.values, seed.cold.useValues);
        } else {
          assert.deepEqual(creator.records.map(row => row.event), seed.creatorHistory);
          assert.deepEqual(original.records.map(row => row.event), seed.useHistory);
          report.historyPreserved = true;
        }
        report.useVerified = { sessionId: seed.useSessionId, presetId: seed.id, asOfSeq: original.projections.asOfSeq,
          toolCalls: 0, reply: seed.marker + '_REPLY 中文🙂' };
      }
    } else {
      assert.equal(seed.sent, true); const original = await readSession();
      const events = original.records.map(row => row.event).filter(event => event.seq > seed.initialSeq);
      report.original = { asOfSeq: original.projections.asOfSeq, running: original.row.running,
        calls: events.filter(event => event.type === 'tool/call').map(event => ({ seq: event.seq, ...event.data })),
        results: events.filter(event => event.type === 'tool/result').map(event => ({ seq: event.seq, ...event.data })),
        approvals: events.filter(event => event.type === 'approval/asked' || event.type === 'approval/decided') };
      assert.ok(report.original.calls.every(call => ['skill', 'write', 'plugin_manager'].includes(call.name)), 'latest_creator_unexpected_tool');
      if (phase === 'approve' || phase === 'approve-recover') {
        assert.equal(seed.approvalSent, undefined);
        if (phase === 'approve') assert.equal(seed.approvalAttempted, undefined);
        else {
          assert.ok(seed.approvalAttempted === undefined || seed.approvalAttempted === true);
          const prior = JSON.parse(await readFile(resolve(runtime, prefix + '-approve.json'), 'utf8'));
          assert.equal(prior.passed, false); assert.equal(prior.home, state.home);
          assert.equal(report.original.approvals.filter(event => event.type === 'approval/decided').length, 0);
        }
        const install = report.original.calls.filter(call => call.name === 'plugin_manager'); assert.equal(install.length, 1);
        assert.deepEqual(JSON.parse(install[0].arguments), { action: 'install_bundle', target: seed.directory });
        assert.equal((await lstat(seed.directory)).isSymbolicLink(), false);
        assert.deepEqual((await readdir(seed.directory)).sort(), ['cordis.patch.yml', 'package.json']);
        const metadata = JSON.parse(await readFile(resolve(seed.directory, 'package.json'), 'utf8'));
        assert.deepEqual(Object.keys(metadata).sort(), ['dsh', 'name', 'private', 'type', 'version']);
        assert.equal(metadata.name, seed.packageName); assert.equal(metadata.version, '1.0.0');
        assert.equal(metadata.private, true); assert.equal(metadata.type, 'module');
        assert.equal(metadata.scripts, undefined); assert.equal(metadata.dependencies, undefined);
        assert.deepEqual(metadata.dsh, { bundle: { patch: './cordis.patch.yml' } });
        const { parse } = createRequire(resolve(runtime, 'package.json'))('yaml');
        const patch = parse(await readFile(resolve(seed.directory, 'cordis.patch.yml'), 'utf8'));
        assert.equal(patch.length, 1); assert.equal(patch[0].insert.length, 1);
        assert.deepEqual(Object.keys(patch[0]), ['insert']);
        const row = patch[0].insert[0]; assert.equal(row.id, 'preset-' + seed.id);
        assert.deepEqual(Object.keys(row).sort(), ['config', 'id', 'name']);
        assert.equal(row.name, '@deepseek-ai/dsh-agent-preset'); assert.equal(row.config.id, seed.id);
        assert.ok(Object.keys(row.config).every(key => ['description', 'id', 'name', 'order', 'plugins'].includes(key)));
        assert.equal(row.config.name, '手机创作验收');
        if (row.config.order !== undefined) assert.equal(typeof row.config.order, 'number');
        assert.equal(row.config.plugins.length, 1); assert.equal(row.config.plugins[0].name, '@deepseek-ai/dsh-persona');
        assert.deepEqual(Object.keys(row.config.plugins[0]).sort(), ['config', 'id', 'name']);
        assert.deepEqual(Object.keys(row.config.plugins[0].config), ['prefix']);
        assert.ok(row.config.plugins[0].config.prefix.includes(seed.marker + '_REPLY 中文🙂'));
        const pending = page.locator('[data-approval-key]'); await pending.waitFor({ timeout: 10000 });
        assert.equal(await pending.count(), 1); assert.match(await pending.innerText(), /plugin_manager|plugin management/i);
        if (phase === 'approve-recover' && seed.approvalAttempted) assert.equal(seed.installCallId, install[0].callId);
        seed.approvalAttempted = true; seed.installCallId = install[0].callId; await persist();
        await pending.getByRole('button', { name: '允许一次', exact: true }).click();
        seed.approvalSent = true; await persist(); report.approvalSent = true;
      } else {
        report.pendingApprovals = await page.locator('[data-approval-key]').count();
        report.roster = await rpc('agentPresets/list', {});
      }
    }
  }
  await capture(prefix + '-' + phase);
  report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message, code: error.code }; process.exitCode = 1;
} finally {
  if (grantAttempted) {
    try {
      await request('/api/dsh-mobile', { action: 'management', deviceId: (await devices()).id, enabled: false });
      assert.equal((await devices()).management, false); report.managementRestored = true;
    } catch (error) { report.permissionRestoreError = error.message; report.passed = false; process.exitCode = 1; }
  } else report.managementRestored = (await devices()).management === false;
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ phase, passed: report.passed, failure: report.failure, sent: report.sent,
    creatorEntryVerified: report.creatorEntryVerified, managementRestored: report.managementRestored,
    pendingApprovals: report.pendingApprovals, calls: report.original?.calls.map(call => call.name) }));
  await device.close();
}
// 源码检查器可能持有 esbuild 句柄；报告和设备连接关闭后结束本测试客户端。
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
