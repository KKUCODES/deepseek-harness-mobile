// 新版真实父子模型的后台完成通知；只点击系统生成的通知，不注入目标或历史。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2], mode = process.argv[3];
const attempt = process.argv[4];
assert.ok(process.argv.length === 4 || process.argv.length === 5 && ['attempt-2', 'attempt-3', 'fixed'].includes(attempt));
assert.ok(['start', 'observe-notice', 'inspect', 'audit', 'cleanup', 'failure-cleanup', 'failure-cleanup-recovered', 'failure-click-cleanup'].includes(phase));
assert.ok(['release', 'source'].includes(mode));
const live = await openLatestLiveAndroid(undefined, { openRecorded: !['inspect', 'observe-notice'].includes(phase) });
const { runtime, state, session, main, page, device, capture, readSession, readChild } = live;
assert.equal(state.executionMode, mode);
const prefix = `latest-live-${mode}-child-notice${attempt ? '-' + attempt : ''}`;
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, executionMode: mode, hostPid: state.hostPid,
  parentId: session.sessionId, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const input = main.getByRole('textbox', { name: '消息', exact: true });
const delay = ms => new Promise(done => setTimeout(done, ms));
const hashes = rows => rows.map(({ event }) => ({ seq: event.seq, type: event.type,
  hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') }));
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return)
    if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
  return undefined;
});
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
function noticeSession(key) {
  assert.match(key, /^[\w.|:@\[\]",-]+$/);
  const start = key.indexOf('dshm.remote.notice.outcome:'); assert.ok(start >= 0);
  const identity = JSON.parse(key.slice(start + 'dshm.remote.notice.outcome:'.length, key.lastIndexOf('|')));
  assert.equal(identity.length, 2); assert.equal(typeof identity[0], 'string');
  assert.ok(Number.isSafeInteger(identity[1])); return identity[0];
}
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/latest-child-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/latest-child-notice.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
async function tap(node) {
  assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
function auditParent(current) {
  assert.equal(current.row.running, false);
  assert.equal(current.projections.values.permissions.currentValue, 'workspace-write');
  const rows = current.records.map(row => row.event).filter(event => event.seq > seed.initialSeq);
  // 原上下文和子任务回报同样写入user/message；提交次数按原用户来源核验。
  const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  assert.equal(users.length, 1);
  assert.ok(users[0].data.content.some(part => part.type === 'text' && part.text === seed.prompt));
  assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
  const calls = rows.filter(event => event.type === 'tool/call');
  assert.equal(calls.length, 1); assert.equal(calls[0].data.name, 'subagent');
  assert.deepEqual(JSON.parse(calls[0].data.arguments), seed.args);
  const catalog = current.projections.values.subagentCatalog.filter(item => item.label === seed.label);
  assert.equal(catalog.length, 1); assert.equal(catalog[0].mode, 'continuable');
  if (seed.childId) assert.equal(catalog[0].id, seed.childId);
  return catalog[0].id;
}
function auditChild(current) {
  assert.equal(current.entry.id, seed.childId); assert.equal(current.entry.label, seed.label);
  assert.equal(current.entry.mode, 'continuable');
  const rows = current.records.map(row => row.event);
  assert.equal(rows[0].seq, 0); assert.equal(rows.at(-1).seq, current.projections.asOfSeq);
  rows.forEach((event, index) => assert.equal(event.seq, index));
  assert.ok(rows.some(event => event.type === 'assistant/message'
    && JSON.stringify(event.data.message.content).includes(seed.childReply)));
  assert.ok(rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
  assert.ok(rows.filter(event => event.type === 'tool/call').every(event => event.data.name === 'send_message'));
  assert.ok(rows.filter(event => event.type === 'tool/result').every(event => !event.data.message.isError));
}
async function originalUnchanged() {
  const parent = await readSession(), child = await readChild(seed.childId);
  auditParent(parent); auditChild(child);
  assert.deepEqual(hashes(parent.records), seed.parentHashes);
  assert.deepEqual(hashes(child.records), seed.childHashes);
  assert.equal(parent.projections.asOfSeq, seed.parentSeq);
  assert.equal(child.projections.asOfSeq, seed.childSeq);
  return { parent, child };
}
async function observeSystemNotices() {
  const keys = await notices();
  assert.deepEqual([...new Set(keys.map(noticeSession))].sort(), [seed.parentId, seed.childId].sort());
  const childKeys = keys.filter(key => noticeSession(key) === seed.childId); assert.equal(childKeys.length, 1);
  const notice = (await device.shell(`cmd notification get '${childKeys[0]}'`)).toString();
  // 原聊天自动标题与子任务description不同；只使用系统通知实际记录的主标题。
  const title = notice.match(/^\s*android.title=String \((.*)\)$/m)?.[1]; assert.ok(title);
  const text = notice.match(/^\s*android.text=String \((.*)\)$/m)?.[1];
  assert.ok(text?.includes(seed.childReply)); assert.ok(text.includes('电脑任务已完成'));
  seed.childNoticeKey = childKeys[0]; seed.childNoticeTitle = title; await persist();
  await device.shell('cmd statusbar expand-notifications');
  const shade = await nodes();
  const childRows = shade.filter(node => node.package === 'com.android.systemui' && node.text === title);
  assert.equal(childRows.length, 1); assert.ok(shade.some(node => node.text === seed.title));
  await capture(prefix + '-shade-observed');
  return childRows[0];
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
  if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), ''); assert.deepEqual(await notices(), []);
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    const settings = await nodes();
    assert.ok(settings.some(node => node.text === 'Remote 提醒 · 已连接'));
    assert.ok(settings.some(node => node.text === '任务完成' && node.checked === 'true'));
    await tap(settings.find(node => node.text === '完成'));
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    const marker = 'DSHM_CHILD_NOTICE_' + randomUUID().replaceAll('-', '');
    seed = { home: state.home, parentId: session.sessionId, initialSeq: before.projections.asOfSeq,
      title: session.title, pid: await pid(), marker, label: 'DSHM 子任务通知 ' + marker.slice(-8),
      childReply: marker + '_CHILD_DONE', draft: marker + '_PARENT_DRAFT', settingsUnchanged: true };
    assert.match(seed.pid, /^\d+$/);
    seed.args = { description: seed.label, run_in_background: true,
      prompt: `这是专用 DSHM 子任务后台通知验收。不要读写文件、执行命令、联网或创建其他子任务。回复第一行只写 ${seed.childReply}，随后用约250字介绍白云。可以按原要求用 send_message 回报父会话，但不调用其他工具。` };
    seed.prompt = `这是新的独立 DSHM 子任务通知验收。只调用一次 subagent，参数严格为 ${JSON.stringify(seed.args)}。不要调用其他工具、不读写文件、不执行命令、不联网、不创建其他子任务。创建后只回复 ${marker}_PARENT_DONE；收到结果后不调用任何工具。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    seed.attempted = true; await persist(); await input.fill(seed.prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.sent = true; await persist();
    // 原编辑器提交期间暂时不可编辑；等待原状态恢复，不能把占位div当成编辑器填写。
    const editableDeadline = Date.now() + 10000;
    while (await input.getAttribute('contenteditable') !== 'true') {
      assert.ok(Date.now() < editableDeadline, 'original_editor_not_editable_after_submit'); await delay(50);
    }
    await input.fill(seed.draft); await device.shell('input keyevent KEYCODE_HOME');
    seed.backgroundAt = new Date().toISOString(); await persist();
    assert.equal(await pid(), seed.pid);
    const deadline = Date.now() + 90000;
    let parent, keys;
    do {
      parent = await readSession(); keys = await notices();
      const child = parent.projections.values.subagentCatalog.find(item => item.label === seed.label);
      if (child && !parent.row.running && new Set(keys.map(noticeSession)).size === 2) break;
      assert.ok(Date.now() < deadline, 'parent_child_actual_notifications_missing'); await delay(300);
    } while (true);
    seed.childId = auditParent(parent); const child = await readChild(seed.childId); auditChild(child);
    assert.deepEqual([...new Set(keys.map(noticeSession))].sort(), [seed.parentId, seed.childId].sort());
    assert.equal((await input.innerText()).trim(), seed.draft);
    seed.parentHashes = hashes(parent.records); seed.childHashes = hashes(child.records);
    seed.parentSeq = parent.projections.asOfSeq; seed.childSeq = child.projections.asOfSeq;
    seed.notificationKeys = keys; seed.readyToClick = true; await persist();
    await observeSystemNotices();
    report.childId = seed.childId; report.distinctNotificationSessions = 2;
    report.actualChildReply = true; report.parentDraftPreserved = true;
    report.sameProcess = await pid() === seed.pid; assert.equal(report.sameProcess, true);
  } else if (phase === 'observe-notice') {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(seed.readyToClick, true); assert.equal(seed.clicked, undefined);
    await originalUnchanged(); await observeSystemNotices();
    assert.equal(await pid(), seed.pid); assert.equal((await input.innerText()).trim(), seed.draft);
    report.childId = seed.childId; report.distinctNotificationSessions = 2;
    report.actualChildReply = true; report.parentDraftPreserved = true; report.sameProcess = true;
  } else if (['failure-cleanup', 'failure-cleanup-recovered'].includes(phase)) {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(seed.attempted, true); assert.equal(seed.backgroundAt, undefined);
    const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start.json'), 'utf8'));
    assert.equal(failed.passed, false);
    const parent = await readSession(); seed.childId = auditParent(parent);
    auditChild(await readChild(seed.childId));
    const draft = (await input.innerText()).trim(); assert.ok(draft === '' || draft === seed.draft);
    if (draft) await input.fill('');
    assert.equal(await selected(), seed.parentId); assert.deepEqual(await notices(), []);
    assert.equal(await pid(), seed.pid); seed.failureCleaned = true; await persist();
    report.originalRequestObservedOnce = true; report.childId = seed.childId;
    report.originalChildCompleted = true; report.emptyDraft = true; report.permissionUnchanged = true;
    report.backgroundNotificationUnverified = true; await capture(prefix + '-failure-cleanup');
  } else if (phase === 'failure-click-cleanup') {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(seed.clickAttempted, true); assert.equal(seed.clicked, undefined);
    const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-inspect.json'), 'utf8'));
    const observed = JSON.parse(await readFile(resolve(runtime, prefix + '-target-observed.json'), 'utf8'));
    assert.equal(failed.passed, false); assert.equal(observed.childTargetVerified, true);
    assert.equal(observed.childId, seed.childId); assert.equal(observed.parentNotificationsUnexpectedlyCleared, true);
    await originalUnchanged(); assert.equal(await selected(), seed.parentId);
    assert.equal((await input.innerText()).trim(), seed.draft); await input.fill('');
    assert.deepEqual(await notices(), []); assert.equal(await pid(), seed.pid);
    seed.failedClickCleaned = true; await persist();
    report.cleaned = true; report.notificationIsolationPassed = false; report.originalHistoryUnchanged = true;
    report.emptyDraft = true; report.permissionUnchanged = true; await capture(prefix + '-failure-click-cleanup');
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(seed.readyToClick, true); assert.equal(await pid(), seed.pid);
    report.childId = seed.childId;
    if (phase === 'inspect') {
      assert.equal(seed.clicked, undefined); await originalUnchanged();
      const target = await observeSystemNotices();
      seed.clickAttempted = true; await persist(); await tap(target);
      const deadline = Date.now() + 20000;
      while (await selected() !== seed.childId) {
        assert.ok(Date.now() < deadline, 'child_notification_target_not_selected'); await delay(100);
      }
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.childReply }).last().waitFor();
      assert.equal((await input.innerText()).trim(), '');
      const remaining = await notices(); assert.ok(remaining.length >= 1);
      assert.ok(remaining.every(key => noticeSession(key) === seed.parentId));
      await capture(prefix + '-child-opened'); await originalUnchanged();
      await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      while (await selected() !== seed.parentId) {
        assert.ok(Date.now() < deadline, 'notification_parent_return_missing'); await delay(100);
      }
      assert.equal((await input.innerText()).trim(), seed.draft); assert.deepEqual(await notices(), []);
      seed.clicked = true; await persist();
      report.nativeChildNotificationClicked = true; report.originalChildSelected = true;
      report.parentDraftPreserved = true; report.parentNotificationsConsumedOnReturn = true;
    } else if (phase === 'audit') {
      assert.equal(seed.clicked, true); await originalUnchanged();
      assert.equal(await selected(), seed.parentId); assert.equal((await input.innerText()).trim(), seed.draft);
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '子会话', exact: true }).click();
      await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: new RegExp(seed.label) }).click();
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.childReply }).last().waitFor();
      assert.equal(await selected(), seed.childId); await originalUnchanged();
      await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      await input.waitFor(); assert.equal((await input.innerText()).trim(), seed.draft);
      seed.audited = true; await persist(); report.originalHistoryUnchanged = true; report.noRetry = true;
    } else {
      assert.equal(seed.clicked, true); assert.equal(seed.audited, true);
      await originalUnchanged(); assert.equal(await selected(), seed.parentId);
      assert.equal((await input.innerText()).trim(), seed.draft); await input.fill('');
      assert.equal((await input.innerText()).trim(), ''); assert.deepEqual(await notices(), []);
      seed.cleaned = true; await persist(); report.emptyDraft = true;
      report.permissionUnchanged = true; report.retainedDedicatedHistory = true;
    }
    assert.equal(await pid(), seed.pid); report.sameProcess = true;
    await capture(prefix + '-' + phase);
  }
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    message: error.message?.split('\n')[0], location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-child-notice-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
