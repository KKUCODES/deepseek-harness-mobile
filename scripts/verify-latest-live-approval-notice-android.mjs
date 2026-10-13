// 只拒绝专用文件的一次真实审批；不批准写入，不重发结果未知的模型请求。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['start', 'observe', 'inspect', 'recover', 'audit'].includes(phase)); assert.equal(process.argv.length, 3);
const live = await openLatestLiveAndroid(undefined, { openRecorded: !['inspect', 'observe'].includes(phase) });
const { runtime, state, session, main, page, device, capture, readSession } = live;
assert.ok(['source', 'release'].includes(state.executionMode));
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'approval-notice';
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, home: state.home, sessionId: session.sessionId,
  executionMode: state.executionMode, hostPid: state.hostPid, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const delay = ms => new Promise(done => setTimeout(done, ms));
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/latest-approval-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/latest-approval-notice.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
async function tap(node) {
  assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
async function setPermission(from, to) {
  const options = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
  if (await options.isVisible()) await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '会话权限', exact: true });
  await dialog.getByText('当前权限：' + from, { exact: true }).waitFor();
  await dialog.getByRole('button', { name: to, exact: true }).click();
  await dialog.getByText('当前权限：' + to, { exact: true }).waitFor();
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
}
function filePath(seed) {
  assert.match(seed.fileName, /^dshm-latest-approval-notice-[0-9a-f-]{36}\.txt$/);
  const path = resolve(state.workspacePath, seed.fileName);
  assert.equal(dirname(path), resolve(state.workspacePath)); return path;
}
function originalCall(original, seed) {
  const calls = original.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
  assert.equal(calls.length, 2); assert.equal(calls[0].event.data.name, 'read'); assert.equal(calls[1].event.data.name, 'write');
  for (const { event } of calls) assert.equal(resolve(state.workspacePath, JSON.parse(event.data.arguments).file_path), filePath(seed));
  const write = calls[1].event; const args = JSON.parse(write.data.arguments);
  assert.ok(args.content === seed.after || args.content === seed.after + '\n');
  assert.equal(args.sandbox_permissions, 'workspace-write');
  return write;
}
function rejectedResult(original, seed) {
  const results = original.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId);
  assert.equal(results.length, 1); assert.equal(results[0].event.data.message.isError, true);
  assert.ok(JSON.stringify(results[0].event.data).includes('user rejected escalating')); return results[0].event;
}
page.on('pageerror', () => report.errors.push('page-error'));
let seed;
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  } else {
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const release = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(resolve(runtime, 'candidate/package.json'), 'utf8'));
    assert.equal(release.name, '@deepseek-ai/dsh'); assert.equal(release.version, '0.2.1-alpha.1');
    assert.equal(candidate.name, '@dsh-mobile/plugin'); assert.equal(candidate.version, '0.1.76-latest.0');
    report.releasePackageVerified = true;
  }
  report.command = state.command;
  if (phase === 'start' || phase === 'observe') {
    if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0);
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    const settings = await nodes();
    assert.ok(settings.some(row => row.text === 'Remote 提醒 · 已连接'));
    assert.ok(settings.some(row => row.text === '需要批准' && row.checked === 'true'));
    await tap(settings.find(row => row.text === '完成'));
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, title: session.title,
      initialSeq: before.projections.asOfSeq, pid: await pid(), originalPermission: 'workspace-write',
      fileName: 'dshm-latest-approval-notice-' + randomUUID() + '.txt', before: 'DSHM_NOTICE_BEFORE',
      after: 'DSHM_NOTICE_DENIED_' + randomUUID().replaceAll('-', ''), settingsUnchanged: true };
    assert.match(seed.pid, /^\d+$/); await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(filePath(seed), seed.before, { flag: 'wx' });
    await setPermission('工作区内修改', '仅可查看');
    seed.permissionChanged = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
    await main.getByRole('textbox', { name: '消息', exact: true }).fill(
      `这是 DSHM 新版后台审批通知验收，只执行本条请求，不补做以前任务。只调用一次 read 读取工作区文件 ${seed.fileName}，再只调用一次 write，把同一文件内容替换为 ${seed.after}。write 直接指定 sandbox_permissions=workspace-write 和 justification=后台审批通知验证，请等待本次单次批准，不先尝试无批准写入。审批被拒绝后只回复 DSHM_NOTICE_WRITE_REJECTED，立即停止，不重试、不调用其他工具、不执行命令、不改其他文件或设置。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await device.shell('input keyevent KEYCODE_HOME');
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    } else {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
      assert.equal(seed.sent, true); assert.equal(seed.answerAttempted, undefined); assert.equal(seed.readyToClick, undefined);
      const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start.json'), 'utf8'));
      assert.equal(failed.passed, false);
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
      report.observedOriginalAttempt = true;
    }
    const until = Date.now() + 45000;
    while (!(await notices()).length && Date.now() < until) await delay(300);
    assert.equal((await notices()).length, 1);
    const original = await readSession(); const call = originalCall(original, seed);
    seed.callId = call.data.callId; seed.originalContent = JSON.parse(call.data.arguments).content;
    assert.equal(original.row.running, true);
    assert.equal(original.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId).length, 0);
    assert.equal(await readFile(filePath(seed), 'utf8'), seed.before);
    await device.shell('cmd statusbar expand-notifications'); const shade = await nodes();
    assert.ok(shade.some(row => row.text === seed.title));
    const body = shade.find(row => row.text.includes('有操作等待你批准')); assert.ok(body);
    assert.equal(await pid(), seed.pid); await capture(prefix + '-shade');
    seed.readyToClick = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.originalCallId = seed.callId; report.noticeTitle = seed.title; report.noticeBody = body.text;
    report.notificationCount = 1; report.backgroundRetainedProcess = true; report.passed = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    assert.equal(await pid(), seed.pid);
    if (phase === 'audit') {
      const inspected = JSON.parse(await readFile(resolve(runtime, prefix + '-android-inspect.json'), 'utf8'));
      assert.equal(inspected.passed, true); assert.equal(seed.cleaned, true); assert.equal(seed.permissionRestored, true);
      const before = await readSession(); assert.equal(before.row.running, false);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: seed.title }).click();
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_WRITE_REJECTED' }).last().waitFor();
      const original = await readSession(); assert.equal(originalCall(original, seed).data.callId, seed.callId);
      rejectedResult(original, seed); assert.equal(original.row.running, false);
      assert.equal(original.projections.asOfSeq, before.projections.asOfSeq);
      assert.equal(original.projections.values.permissions.currentValue, seed.originalPermission);
      assert.equal(await page.locator('[data-approval-key]').count(), 0); assert.equal((await notices()).length, 0);
      await assert.rejects(access(filePath(seed)), { code: 'ENOENT' });
      await capture(prefix + '-history'); report.historyReopened = true; report.noRepeatedCall = true;
    } else {
      assert.equal(seed.answerAttempted, undefined);
      if (phase === 'inspect') {
        assert.equal(seed.readyToClick, true); assert.equal((await notices()).length, 1);
        await device.shell('cmd statusbar expand-notifications');
        const title = (await nodes()).find(row => row.text === seed.title); assert.ok(title);
        seed.clickAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
        await tap(title); report.nativeNotificationClicked = true;
      }
      await main.locator('.remote-heading strong').getByText(seed.title, { exact: true }).waitFor();
      const pending = page.locator('[data-approval-key]'); await pending.waitFor({ timeout: 15000 });
      assert.equal(await pending.count(), 1);
      const original = await readSession(); const call = originalCall(original, seed);
      if (seed.callId) assert.equal(call.data.callId, seed.callId); else seed.callId = call.data.callId;
      assert.equal(original.projections.values.permissions.currentValue, 'read-only');
      const details = page.getByRole('dialog', { name: '工具详情', exact: true });
      await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
      await details.getByText('write · 执行中', { exact: true }).waitFor();
      await details.getByRole('button', { name: '打开文件：' + seed.fileName, exact: true }).waitFor();
      assert.ok((await details.innerText()).includes(seed.after)); await capture(prefix + '-opened');
      await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
      assert.equal(await readFile(filePath(seed), 'utf8'), seed.before); assert.equal((await notices()).length, 0);
      seed.answerAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await pending.getByRole('button', { name: '拒绝', exact: true }).click();
      seed.answered = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await pending.waitFor({ state: 'detached' });
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_WRITE_REJECTED' }).last().waitFor({ timeout: 45000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 15000 });
      const settled = await readSession(); assert.equal(settled.row.running, false);
      assert.equal(originalCall(settled, seed).data.callId, seed.callId); rejectedResult(settled, seed);
      assert.equal(await readFile(filePath(seed), 'utf8'), seed.before);
      await setPermission('仅可查看', '工作区内修改');
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.originalPermission);
      seed.permissionRestored = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      assert.equal(await readFile(filePath(seed), 'utf8'), seed.before); await unlink(filePath(seed));
      seed.cleaned = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await capture(prefix + '-complete'); report.rejectedWithoutWrite = true; report.originalDecisionVerified = true;
      report.recovered = phase === 'recover';
    }
    assert.equal((await notices()).length, 0); assert.equal(await pid(), seed.pid);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal(await page.locator('iframe').count(), 0);
    report.originalCallId = seed.callId; report.permissionRestored = seed.permissionRestored;
    report.testFileRemoved = seed.cleaned; report.sameProcess = true; report.passed = phase !== 'recover';
    if (phase === 'recover') process.exitCode = 1;
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.passed = false;
  report.failure = { name: error.name, code: error.code ?? 'validation_failed', message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-approval-notice-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
