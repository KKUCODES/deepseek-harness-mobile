// 原父模型前台委派与只读子历史；不注入模型结果、不创建额外授权或重发未知请求。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const [phase, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert.ok(['start', 'observe', 'views', 'list-start', 'list-observe', 'cleanup', 'restored'].includes(phase));
assert.ok(['release', 'source'].includes(mode));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, session, main, page, device, capture, readSession, readChild } = live;
assert.equal(state.executionMode, mode);
const prefix = `latest-live-${mode}-one-shot`;
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, executionMode: mode, command: state.command,
  hostPid: state.hostPid, parentId: session.sessionId, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const input = main.getByRole('textbox', { name: '消息', exact: true });
const delay = ms => new Promise(done => setTimeout(done, ms));
const digest = event => createHash('sha256').update(JSON.stringify(event)).digest('hex');
const hashes = current => current.records.map(({ event }) => ({ seq: event.seq, hash: digest(event) }));
const text = event => (event.data.message?.content ?? event.data.content ?? [])
  .filter(part => part.type === 'text').map(part => part.text).join('');
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return)
    if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
  return undefined;
});
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
function originalPrefix(current, original) {
  for (const row of original) {
    const found = current.records.find(item => item.event.seq === row.seq);
    assert.ok(found, 'one_shot_original_event_missing'); assert.equal(digest(found.event), row.hash);
  }
}
function userAndCalls(current, after, prompt, names) {
  const rows = current.records.map(row => row.event).filter(event => event.seq > after);
  const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  assert.equal(users.length, 1); assert.equal(text(users[0]), prompt);
  assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
  const calls = rows.filter(event => event.type === 'tool/call');
  assert.deepEqual(calls.map(event => event.data.name).sort(), [...names].sort());
  const results = calls.map(call => {
    const matches = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === call.data.callId);
    assert.equal(matches.length, 1); assert.equal(matches[0].data.message.isError, false);
    return { call, result: matches[0] };
  });
  assert.ok(rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
  assert.equal(current.row.running, false);
  assert.equal(current.projections.values.permissions.currentValue, 'workspace-write');
  return { rows, calls, results, rpcId: users[0].data.source.rpcId };
}
function auditChild(child) {
  assert.equal(child.entry.id, seed.childId); assert.equal(child.entry.label, seed.label);
  assert.equal(child.entry.mode, 'one-shot');
  assert.equal(child.records.length, child.projections.asOfSeq + 1);
  child.records.forEach((row, index) => assert.equal(row.event.seq, index));
  const events = child.records.map(row => row.event);
  assert.equal(events.filter(event => event.type === 'tool/call').length, 0);
  assert.ok(events.some(event => event.type === 'assistant/message' && text(event).includes(seed.childReply)));
  assert.ok(events.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
  const descriptors = events.filter(event => event.type === 'subagent/descriptor');
  assert.equal(descriptors.length, 1); assert.equal(descriptors[0].data.mode, 'one-shot');
}
async function stable() {
  const parent = await readSession({ allRecords: true }), child = await readChild(seed.childId);
  auditChild(child); originalPrefix(parent, seed.initialHashes);
  assert.deepEqual(hashes(child), seed.childHashes); assert.equal(child.projections.asOfSeq, seed.childSeq);
  assert.equal(parent.row.running, false);
  assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
  return { parent, child };
}
async function waitIdle() {
  const deadline = Date.now() + 120000;
  while (true) {
    const current = await readSession();
    if (current.projections.asOfSeq > (phase === 'observe' ? seed.initialSeq : seed.listInitialSeq) && !current.row.running) return;
    assert.ok(Date.now() < deadline, 'one_shot_parent_not_settled'); await delay(300);
  }
}
async function openCatalog() {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '子会话', exact: true });
  const group = panel.getByRole('group', { name: seed.label, exact: true });
  await group.waitFor(); assert.match(await group.innerText(), /只读记录/); return group;
}
async function assertReadOnly(scope) {
  await scope.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.childReply }).last().waitFor();
  await scope.getByText('这是一次性子任务，可以查看执行记录。', { exact: true }).waitFor();
  assert.equal(await scope.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
  assert.equal(await scope.getByRole('button', { name: '发送消息', exact: true }).count(), 0);
  assert.equal(await scope.getByRole('button', { name: '添加附件', exact: true }).count(), 0);
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.equal(state.autoReviewDiagnostic, false); assert.equal(state.reviewCandidate, undefined);
  if (mode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'restored') {
    assert.equal(mode, 'release');
    const restored = JSON.parse(await readFile(resolve(import.meta.dirname, '../artifacts/latest-child-notice-main-apk-restore.json'), 'utf8'));
    assert.equal(restored.passed, true);
    const apk = (await device.shell(`pm path ${pkg}`)).toString().trim();
    assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
    assert.equal((await device.shell(`sha256sum ${apk.slice(8)}`)).toString().split(/\s+/)[0], restored.originalSha256);
    const parent = await readSession({ allRecords: true });
    assert.equal(parent.row.running, false); assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal(await selected(), session.sessionId); assert.equal((await input.innerText()).trim(), '');
    assert.deepEqual(await notices(), []); report.children = [];
    for (const originalMode of ['release', 'source']) {
      const originalPrefixName = `latest-live-${originalMode}-one-shot`;
      const cleanup = JSON.parse(await readFile(resolve(runtime, originalPrefixName + '-android-cleanup.json'), 'utf8'));
      assert.equal(cleanup.passed, true);
      seed = JSON.parse(await readFile(resolve(runtime, originalPrefixName + '-seed.json'), 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId); assert.equal(seed.cleaned, true);
      originalPrefix(parent, seed.finalParentHashes);
      const child = await readChild(seed.childId); auditChild(child);
      assert.deepEqual(hashes(child), seed.childHashes); assert.equal(child.projections.asOfSeq, seed.childSeq);
      assert.equal(await pid(), seed.pid);
      report.children.push({ executionMode: originalMode, id: seed.childId, records: child.records.length, originalHistoryUnchanged: true });
    }
    report.originalApkUnchanged = true; report.parentRecords = parent.records.length;
    report.emptyDraft = true; report.permissionUnchanged = true;
  } else if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession({ allRecords: true });
    assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), ''); assert.deepEqual(await notices(), []);
    const marker = 'DSHM_ONE_SHOT_' + randomUUID().replaceAll('-', '');
    seed = { home: state.home, parentId: session.sessionId, pid: await pid(), marker,
      label: 'DSHM 一次性子任务 ' + marker.slice(-8), childReply: marker + '_CHILD中文🍀',
      parentReply: marker + '_PARENT', draft: marker + '_DRAFT',
      initialSeq: before.projections.asOfSeq, initialHashes: hashes(before) };
    assert.match(seed.pid, /^[1-9]\d*$/);
    seed.args = { description: seed.label, run_in_background: false,
      prompt: `这是DSHM专用一次性子任务验收。不要调用任何工具，不读写文件、不执行命令、不联网、不创建子任务、不发送父会话消息。仅回复 ${seed.childReply}。` };
    seed.prompt = `这是新的独立DSHM前台子任务验收。仅调用一次subagent，参数严格为 ${JSON.stringify(seed.args)}。等待结果后仅回复 ${seed.parentReply}。不要调用其他工具、不读写文件、不执行命令、不联网、不创建其他子任务。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    seed.attempted = true; await persist(); await input.fill(seed.prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await persist(); report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(await pid(), seed.pid);
    if (phase === 'observe') {
      assert.equal(seed.attempted, true); await waitIdle();
      const parent = await readSession({ allRecords: true }); originalPrefix(parent, seed.initialHashes);
      const audit = userAndCalls(parent, seed.initialSeq, seed.prompt, ['subagent']);
      assert.deepEqual(JSON.parse(audit.calls[0].data.arguments), seed.args);
      assert.ok(text(audit.results[0].result).includes(seed.childReply));
      const entries = parent.projections.values.subagentCatalog.filter(entry => entry.label === seed.label);
      assert.equal(entries.length, 1); assert.equal(entries[0].mode, 'one-shot'); seed.childId = entries[0].id;
      const child = await readChild(seed.childId); auditChild(child);
      seed.childHashes = hashes(child); seed.childSeq = child.projections.asOfSeq;
      seed.parentHashes = hashes(parent); seed.parentSeq = parent.projections.asOfSeq;
      seed.observed = true; await persist();
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.parentReply }).last().waitFor();
      assert.equal((await input.innerText()).trim(), '');
      report.originalRpcId = audit.rpcId; report.foregroundResultContainsChildReply = true;
      report.originalDescriptorOneShot = true; report.childRecords = child.records.length;
    } else if (phase === 'views') {
      assert.equal(seed.observed, true); const { parent } = await stable();
      assert.deepEqual(hashes(parent), seed.parentHashes); assert.equal((await input.innerText()).trim(), '');
      await input.fill(seed.draft);
      const group = await openCatalog();
      await group.getByRole('button').filter({ hasText: seed.label }).click();
      await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
      assert.equal(await selected(), seed.childId); await assertReadOnly(main);
      await capture(prefix + '-main-readonly');
      await main.getByRole('button', { name: '返回父会话', exact: true }).click(); await input.waitFor();
      assert.equal(await selected(), seed.parentId); assert.equal((await input.innerText()).trim(), seed.draft);
      const sideGroup = await openCatalog();
      await sideGroup.getByRole('button', { name: '在旁栏打开', exact: true }).click();
      const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
      await aside.waitFor(); await assertReadOnly(aside); assert.equal(await selected(), seed.parentId);
      await capture(prefix + '-aside-readonly');
      await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      await input.waitFor(); assert.equal((await input.innerText()).trim(), seed.draft);
      const after = await stable(); assert.deepEqual(hashes(after.parent), seed.parentHashes);
      seed.viewsChecked = true; await persist();
      report.mainReadOnly = true; report.asideReadOnly = true; report.parentDraftPreserved = true;
      report.originalHistoryUnchanged = true;
    } else if (phase === 'list-start') {
      assert.equal(seed.viewsChecked, true); assert.equal(seed.listAttempted, undefined);
      const { parent } = await stable(); assert.deepEqual(hashes(parent), seed.parentHashes);
      assert.equal((await input.innerText()).trim(), seed.draft); await input.fill('');
      seed.listInitialSeq = parent.projections.asOfSeq;
      seed.expectedChildren = parent.projections.values.subagentCatalog.filter(entry => entry.mode === 'continuable')
        .map(entry => ({ id: entry.id, label: entry.label }));
      assert.ok(seed.expectedChildren.length > 0);
      seed.listPrompt = `这是DSHM专用原子任务发现验收。仅依次调用list_agents两次：第一次参数严格为 {"scope":"children"}，第二次参数严格为 {"scope":"descendants"}。之后仅回复 ${seed.marker}_LIST_DONE。不要调用其他工具、不发子会话消息、不创建子任务、不读写文件、不执行命令、不联网。`;
      seed.listAttempted = true; await persist(); await input.fill(seed.listPrompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.listSent = true; await persist();
      report.sent = true;
    } else if (phase === 'list-observe') {
      assert.equal(seed.listAttempted, true); await waitIdle();
      const { parent } = await stable(); originalPrefix(parent, seed.parentHashes);
      const audit = userAndCalls(parent, seed.listInitialSeq, seed.listPrompt, ['list_agents', 'list_agents']);
      assert.deepEqual(audit.calls.map(call => JSON.parse(call.data.arguments)), [{ scope: 'children' }, { scope: 'descendants' }]);
      report.lists = [];
      for (const { call, result } of audit.results) {
        const scope = JSON.parse(call.data.arguments).scope;
        const lines = text(result).split('\n').filter(Boolean);
        assert.ok(lines.every(line => !line.includes(seed.childId)));
        const entries = lines.map(line => {
          const match = line.match(/^([a-f0-9-]{36}) \[(running|inactive)\](?: parent=([^ ]+) depth=(\d+))? — (.*)$/);
          assert.ok(match, 'one_shot_list_unexpected_diagnostic_or_shape');
          return { id: match[1], status: match[2], parent: match[3], depth: match[4] && Number(match[4]), label: match[5] };
        });
        assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
        assert.deepEqual(entries.filter(entry => scope === 'children' || entry.depth === 1).map(({ id, label }) => ({ id, label }))
          .sort((a, b) => a.id.localeCompare(b.id)), [...seed.expectedChildren].sort((a, b) => a.id.localeCompare(b.id)));
        assert.ok(entries.every(entry => entry.status === 'inactive'));
        if (scope === 'children') assert.ok(entries.every(entry => entry.parent === undefined && entry.depth === undefined));
        else {
          assert.ok(entries.every(entry => typeof entry.parent === 'string' && Number.isInteger(entry.depth) && entry.depth >= 1));
          assert.ok(entries.filter(entry => entry.depth === 1).every(entry => entry.parent === seed.parentId));
        }
        report.lists.push({ scope, entries, oneShotExcluded: true });
      }
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker + '_LIST_DONE' }).last().waitFor();
      assert.equal((await input.innerText()).trim(), '');
      seed.finalParentHashes = hashes(parent); seed.listChecked = true; await persist();
      report.originalRpcId = audit.rpcId; report.originalToolResultsChecked = true;
    } else {
      assert.equal(seed.listChecked, true); const { parent } = await stable();
      assert.deepEqual(hashes(parent), seed.finalParentHashes);
      assert.equal(await selected(), seed.parentId); assert.equal((await input.innerText()).trim(), '');
      assert.deepEqual(await notices(), []); seed.cleaned = true; await persist();
      report.emptyDraft = true; report.permissionUnchanged = true; report.retainedDedicatedHistory = true;
    }
    report.childId = seed.childId;
  }
  assert.equal(await pid(), seed.pid); report.sameAppProcess = true;
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []);
  await capture(prefix + '-' + phase); report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-one-shot-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report));
  await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
