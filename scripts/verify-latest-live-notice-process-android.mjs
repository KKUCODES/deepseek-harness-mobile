// 实际回收独立测试 App 进程，再经原 Launcher 重连；不清除数据或重发模型请求。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'reopen', 'audit', 'local-audit', 'recover-live'].includes(phase));
const killMethod = process.argv[3] ?? 'am-kill'; assert.ok(['am-kill', 'force-stop'].includes(killMethod)); assert.ok(process.argv.length <= 5);
const attempt = process.argv[4] ?? ''; assert.ok(attempt === '' || /^[a-z][a-z0-9-]{0,30}$/.test(attempt));
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const entry = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
assert.ok(['source', 'release'].includes(entry.executionMode));
const prefix = 'latest-live-' + (entry.executionMode === 'source' ? 'source-' : '') + 'notice-process'
  + (killMethod === 'force-stop' ? '-force' : '') + (attempt ? '-' + attempt : '');
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const pkg = 'dev.dshmobile.validation.latesttest';
const delay = ms => new Promise(done => setTimeout(done, ms));
const report = { at: new Date().toISOString(), phase, killMethod, passed: false, errors: [] };
let live, device, seed;
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
async function noNoticesFor(ms, expectedPid) {
  const until = Date.now() + ms;
  do { assert.equal(await pid(), expectedPid); assert.equal((await notices()).length, 0); await delay(300); } while (Date.now() < until);
}
function originalReply(original) {
  const records = original.records.filter(item => item.event.seq > seed.initialSeq);
  assert.equal(records.filter(item => item.event.type === 'tool/call').length, 0);
  const replies = records.filter(item => item.event.type === 'assistant/message' && item.event.data.message.content.some(part =>
    part.type === 'text' && part.text.includes(seed.marker)));
  assert.equal(replies.length, 1); return replies[0].event;
}
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  if (phase === 'reopen') {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    const started = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start.json'), 'utf8'));
    assert.equal(started.passed, true); assert.equal(seed.settledWhileDead, true); assert.equal(seed.reopenAttempted, undefined);
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL); assert.ok(device);
    assert.equal(await pid(), ''); assert.equal((await notices()).length, 0);
    seed.reopenAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
    const until = Date.now() + 15000;
    while (!(await pid()) && Date.now() < until) await delay(100);
    seed.newPid = await pid(); assert.match(seed.newPid, /^\d+$/); assert.notEqual(seed.newPid, seed.oldPid);
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    const ordinary = await (await androidAppWebView(device, pkg)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
    // 通知连接由 Application 启动；先核对普通首页，不能靠预载 Remote 页恢复它。
    assert.equal(ordinary.context().pages().length, 1);
    const listeningUntil = Date.now() + 35000;
    let stage;
    do {
      const logs = (await device.shell(`logcat -d --pid=${seed.newPid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
      stage = logs.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.split(': ').at(-1)?.trim();
      if (stage === 'listening') break;
      assert.ok(Date.now() < listeningUntil, 'notice_connection_restart_missing'); await delay(200);
    } while (true);
    report.noticeConnectionListeningBeforeRemote = true;
    await noNoticesFor(5000, seed.newPid);
    await device.close(); device = undefined;
  }
  live = await openLatestLiveAndroid(undefined, { openRecorded: phase !== 'recover-live' }); device = live.device;
  const { state, session, main, page, readSession, capture } = live;
  assert.equal(state.executionMode, entry.executionMode); assert.equal(state.home, entry.home);
  assert.equal(state.hostPid, entry.hostPid);
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    Object.assign(report, { sourceCommit: installed.sourceCommit, sourceFiles: installed.files });
  } else {
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const release = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(resolve(runtime, 'candidate/package.json'), 'utf8'));
    assert.equal(release.name, '@deepseek-ai/dsh'); assert.equal(release.version, '0.2.1-alpha.1');
    assert.equal(candidate.name, '@dsh-mobile/plugin'); assert.equal(candidate.version, '0.1.76-latest.0');
    report.releasePackageVerified = true;
  }
  Object.assign(report, { home: state.home, sessionId: session.sessionId, hostPid: state.hostPid,
    executionMode: state.executionMode, command: state.command });
  page.on('pageerror', () => report.errors.push('page-error'));
  if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal((await notices()).length, 0);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, initialSeq: before.projections.asOfSeq,
      oldPid: await pid(), fingerprint: await page.getByTestId('remote-fingerprint').textContent(),
      permission: before.projections.values.permissions.currentValue,
      marker: 'DSHM_NOTICE_PROCESS_' + randomUUID().replaceAll('-', '').slice(0, 12) };
    assert.match(seed.oldPid, /^\d+$/); assert.match(seed.fingerprint, /^[A-Za-z0-9_-]{43}$/);
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    if (attempt === 'draft-receipt') {
      // 仅延迟真实成功回执交给输入shell的时刻，电脑请求/结果均保持原值；进程结束即释放。
      await main.evaluate((element, marker) => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          const model = fiber.memoizedProps?.model; if (!model?.client) continue;
          const session = model.reference.binding.session, prompt = session.prompt.bind(session);
          session.prompt = async (content, mode, signal, requestId) => {
            if (!content.some(part => part.type === 'text' && part.text.includes(marker))) return prompt(content, mode, signal, requestId);
            if (window.__dshmProcessReceipt) throw new Error('duplicate_process_probe');
            window.__dshmProcessReceipt = { requestId, persistedBeforeDispatch: model.draftStore.readSubmission(model.snapshot.selected)?.requestId === requestId };
            const result = await prompt(content, mode, signal, requestId);
            window.__dshmProcessReceipt.accepted = result.ok;
            await new Promise(() => {});
            return result;
          };
          return;
        }
        throw new Error('process_probe_model_missing');
      }, seed.marker);
    }
    await main.getByRole('textbox', { name: '消息', exact: true }).fill(
      `这是 DSHM 新版进程结束后的通知验收，不调用任何工具，不做其他任务。回复第一行只写 ${seed.marker}，随后用约800个中文字介绍晴天散步的见闻。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    if (attempt === 'draft-receipt') {
      await page.waitForFunction(() => window.__dshmProcessReceipt?.accepted === true);
      const receipt = await page.evaluate(() => window.__dshmProcessReceipt);
      assert.equal(receipt.persistedBeforeDispatch, true);
      seed.requestId = receipt.requestId; report.realAcknowledgementHeld = true;
    }
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await device.shell('input keyevent KEYCODE_HOME');
    const during = await readSession(); assert.equal(during.row.running, true);
    assert.equal(during.records.some(item => item.event.type === 'assistant/message' && item.event.seq > seed.initialSeq
      && JSON.stringify(item.event.data).includes(seed.marker)), false);
    assert.equal(await pid(), seed.oldPid);
    seed.killAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await device.shell(`am ${killMethod === 'force-stop' ? 'force-stop' : 'kill'} ${pkg}`);
    const killedUntil = Date.now() + 3000;
    while ((await pid()) && Date.now() < killedUntil) await delay(100);
    assert.equal(await pid(), ''); seed.killedAt = new Date().toISOString();
    // 必须在电脑结算之前证明进程已消失，完成后再杀进程不能覆盖此场景。
    assert.equal((await readSession()).row.running, true);
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    const settledUntil = Date.now() + 60000; let original;
    do {
      assert.equal(await pid(), ''); assert.equal((await notices()).length, 0);
      original = await readSession(); if (!original.row.running) break;
      assert.ok(Date.now() < settledUntil, 'original_reply_settlement_missing'); await delay(300);
    } while (true);
    const reply = originalReply(original);
    if (seed.requestId) {
      const received = original.records.filter(item => item.event.seq > seed.initialSeq && item.event.type === 'user/message'
        && item.event.data.source.kind === 'user' && item.event.data.source.rpcId === seed.requestId);
      assert.equal(received.length, 1); seed.userSeq = received[0].event.seq;
    }
    assert.equal(original.projections.values.permissions.currentValue, seed.permission);
    seed.replySeq = reply.seq; seed.settledSeq = original.projections.asOfSeq; seed.settledAt = new Date().toISOString();
    await noNoticesFor(8000, ''); seed.settledWhileDead = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2)); await capture(prefix + '-dead');
    Object.assign(report, { oldPid: seed.oldPid, killedBeforeSettlement: true, originalReplySeq: seed.replySeq,
      absentDuringAndAfterSettlement: true, postSettlementObservationMs: 8000, passed: true });
  } else if (phase === 'recover-live') {
    assert.equal(killMethod, 'am-kill'); seed = JSON.parse(await readFile(seedPath, 'utf8'));
    const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start.json'), 'utf8'));
    assert.equal(failed.passed, false); assert.equal(seed.killAttempted, true);
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(await pid(), seed.oldPid);
    const original = await readSession(); assert.equal(original.row.running, false); originalReply(original);
    assert.equal((await notices()).length, 1);
    await device.shell('cmd statusbar expand-notifications');
    await device.shell('uiautomator dump /data/local/tmp/latest-process-recover.xml');
    const xml = (await device.shell('cat /data/local/tmp/latest-process-recover.xml')).toString();
    const rows = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
    const title = rows.find(row => row.text === session.title); assert.ok(title);
    const [a,b,c,d] = title.bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((a+c)/2)} ${Math.floor((b+d)/2)}`);
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker }).last().waitFor();
    assert.equal((await notices()).length, 0); assert.equal(await pid(), seed.oldPid);
    await capture(prefix + '-failed-recovered'); seed.failedAttemptRecovered = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.failedAttemptRecovered = true; report.processEnded = false; process.exitCode = 1;
  } else {
    seed ??= JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.settledWhileDead, true);
    assert.match(seed.newPid, /^\d+$/); assert.equal(await pid(), seed.newPid);
    assert.equal(await page.getByTestId('remote-fingerprint').textContent(), seed.fingerprint);
    if (phase === 'audit' || phase === 'local-audit') {
      const reopened = JSON.parse(await readFile(resolve(runtime, prefix + '-android-reopen.json'), 'utf8')); assert.equal(reopened.passed, true);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
    }
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker }).last().waitFor();
    const original = await readSession(); assert.equal(original.row.running, false);
    assert.equal(originalReply(original).seq, seed.replySeq);
    const requests = original.records.filter(item => item.event.seq > seed.initialSeq && item.event.type === 'user/message'
      && item.event.data.content.some(part => part.type === 'text' && part.text.includes(seed.marker)));
    assert.equal(requests.length, 1); report.originalUserMessageOnce = true;
    assert.equal(original.projections.asOfSeq, seed.settledSeq);
    assert.equal(original.projections.values.permissions.currentValue, seed.permission);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    if (attempt) {
      const local = await main.evaluate(element => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          const model = fiber.memoizedProps?.model; if (!model?.client) continue;
          const id = model.snapshot.selected;
          return { draft: model.draftStore.read(id), pending: model.draftStore.readSubmission(id), error: model.snapshot.draftErrors[id] };
        }
        throw new Error('process_probe_model_missing');
      });
      assert.equal(local.draft, ''); assert.equal(local.pending, null); assert.equal(local.error, null);
      report.submissionAndDraftCleared = true;
    }
    assert.equal(await page.locator('iframe').count(), 0);
    await noNoticesFor(5000, seed.newPid); await capture(prefix + '-' + phase);
    seed.reopened = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    Object.assign(report, { oldPid: seed.oldPid, newPid: seed.newPid, originalReplySeq: seed.replySeq, identityPreserved: true,
      originalReplyOpened: true, noHistoryBackfill: true, historyReopened: ['audit', 'local-audit'].includes(phase), postReconnectObservationMs: 5000, passed: true });
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.passed = false;
  report.failure = { name: error.name, code: error.code ?? 'validation_failed', message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-notice-process-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); if (device) await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
