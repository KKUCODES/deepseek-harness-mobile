import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'run'; assert.ok(['run', 'restore', 'discard', 'cleaned'].includes(phase));
const preview = process.argv.includes('--preview');
const approvalCategory = process.argv.includes('--approval-category');
const backgroundDwell = process.argv.includes('--background-dwell');
assert.ok(!backgroundDwell || !approvalCategory, '后台停留与分类开关使用独立场景');
const dwellMs = backgroundDwell && phase === 'run' ? 300000 : 0;
const prefix = backgroundDwell ? 'artifacts/notice-background-dwell' : approvalCategory ? 'artifacts/notice-approval-category' : preview ? 'artifacts/notice-pending-preview' : 'artifacts/notice-cancel';
const artifact = `${prefix}-${phase}-android.json`;
const control = 'artifacts/approval-timeout-control.json';
const report = { at: new Date().toISOString(), phase, checks: [], errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const readHost = () => readFile('artifacts/approval-timeout-host.json', 'utf8').then(JSON.parse);
let device, pendingRequest, remotePage, restoreApproval;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2)); }, 90000 + dwellMs);
async function until(check) {
  const end = Date.now() + 20000;
  while (!await check() && Date.now() < end) await delay(100);
  assert.ok(await check(), 'Expected condition within 20 seconds');
}
async function openRemote() {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/dev.dshmobile.validation.ValidationActivity');
  const root = await (await androidAppWebView(device)).page();
  const ordinary = root.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const remote = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(remote); return remote;
}
async function nativeNodes() {
  await device.shell('uiautomator dump /data/local/tmp/dshm-approval-category.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-approval-category.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(pair => [pair[1], pair[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
}
async function tapNode(node) {
  assert.ok(node);
  const bounds = node.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert.ok(bounds);
  const [, left, top, right, bottom] = bounds.map(Number);
  await device.shell(`input tap ${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`);
}
async function approvalSetting(value, capture = false) {
  await remotePage.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await remotePage.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
  let nodes = await nativeNodes();
  const labels = ['需要批准', '需要回答', '任务完成', '执行失败或受阻'];
  const choices = () => Object.fromEntries(labels.map(label => {
    const node = nodes.find(item => item.text === label && item.checkable === 'true'); assert.ok(node);
    return [label, node.checked === 'true'];
  }));
  const before = choices();
  if (capture) {
    assert.equal(before['需要批准'], true, 'Do not change a previously disabled preference');
    restoreApproval = before;
  }
  try {
    if (before['需要批准'] !== value) {
      await tapNode(nodes.find(item => item.text === '需要批准' && item.checkable === 'true'));
      nodes = await nativeNodes();
    }
    const after = choices(); assert.equal(after['需要批准'], value);
    for (const label of labels.slice(1)) assert.equal(after[label], restoreApproval[label]);
    return after;
  } finally {
    await tapNode(nodes.find(item => item['resource-id'] === 'android:id/button1'));
    await remotePage.getByRole('button', { name: '关闭窗口', exact: true }).click();
  }
}
try {
  let seed = await readHost(); assert.equal(seed.ready, true); assert.equal(seed.failure, undefined);
  if (phase === 'cleaned' && !seed.cleaned) {
    // CLI返回早于运行中插件的异步dispose；只等同一实例，不重复卸载或重启服务。
    const sessionId = seed.sessionId;
    await until(async () => {
      seed = await readHost(); assert.equal(seed.sessionId, sessionId); assert.equal(seed.failure, undefined);
      return seed.cleaned === true;
    });
  }
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(15000);
  // 后台通知验收结束后，从公开启动入口恢复页面；RemoteActivity本身不向其他应用导出。
  const page = remotePage = await openRemote();
  assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
  const title = main.locator('.remote-heading strong');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const notices = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
  if (phase === 'run') {
    assert.equal(seed.cleaned, false);
    assert.equal(await title.innerText(), 'DSHM Remote 联调提示'); assert.equal((await editor.innerText()).trim(), '', 'Original chat draft must be empty');
    assert.equal((await notices()).length, 0);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '刷新会话', exact: true }).click();
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: seed.title }).click();
    await title.getByText(seed.title, { exact: true }).waitFor(); await editor.waitFor();
    assert.ok(['', 'DSHM_CANCEL_NOTICE_DRAFT'].includes((await editor.innerText()).trim()), 'Do not replace an unknown test-chat draft');
    await editor.fill('DSHM_CANCEL_NOTICE_DRAFT');
    const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim(); assert.match(pid, /^\d+$/);
    const logs = async () => (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D DSHMNotifications:D '*:S'`)).toString();
    await until(async () => (await logs()).split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
    const steps = approvalCategory ? ['enabled', 'disabled', 'restored'] : ['approval-cancel', 'question-cancel'];
    for (const step of steps) {
      const kind = approvalCategory ? 'approval-cancel' : step;
      let settings;
      if (approvalCategory) {
        if (step !== 'enabled') await openRemote();
        settings = await approvalSetting(step !== 'disabled', step === 'enabled');
      }
      await device.shell('input keyevent KEYCODE_HOME');
      if (dwellMs && report.checks.length === 0) {
        // 在发出请求之前等待，避免把“前台已收到后挂在通知栏”当作后台新事件。
        const started = Date.now();
        report.dwell = { requestedMs: dwellMs, startedAt: new Date(started).toISOString(), observations: [],
          environment: 'MuMu Android 12; screen on; ADB/WebView debugger attached; no forced Doze' };
        do {
          const actualPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
          const activities = (await device.shell('dumpsys activity activities')).toString();
          assert.equal(actualPid, pid, '此场景要求后台进程仍存活，不自动重启来制造通过');
          assert.ok(!/topResumedActivity=.*dev\.dshmobile\.validation\//.test(activities));
          assert.equal((await notices()).length, 0);
          report.dwell.observations.push({ elapsedMs: Date.now() - started, sameProcess: true, background: true });
          await writeFile(artifact, JSON.stringify(report, null, 2));
          console.log(JSON.stringify({ backgroundDwellElapsedMs: Date.now() - started }));
          if (Date.now() - started >= dwellMs) break;
          await delay(Math.min(30000, dwellMs - (Date.now() - started)));
        } while (true);
        report.dwell.elapsedMs = Date.now() - started;
      }
      const beforeLog = await logs();
      const id = randomUUID(); pendingRequest = { id, sessionId: seed.sessionId };
      await writeFile(control, JSON.stringify({ ...pendingRequest, kind }));
      const card = page.locator(kind === 'approval-cancel' ? '[data-approval-key]' : '[data-question-key]');
      await card.waitFor();
      const nativeKind = kind.split('-')[0];
      let key;
      if (approvalCategory && step === 'disabled') {
        // 有界无投递检查；前后正向请求与连接日志共同核对，不能推断无限期无通知。
        await delay(2000);
        assert.equal((await notices()).length, 0);
        const fresh = (await logs()).slice(beforeLog.length);
        assert.equal(fresh.includes('display kind=approval'), false);
        assert.equal(/retrying|disconnected|stream_overflow/.test(fresh), false);
      } else {
        await until(async () => (await notices()).length === 1);
        key = (await notices())[0];
        assert.ok((await logs()).slice(beforeLog.length).includes(`display kind=${nativeKind} foreground=null started=0`));
      }
      let titleVerified;
      if (preview && key) {
        // 只读取本轮专用请求的真实系统通知，不枚举其他App通知内容。
        assert.match(key, /^[a-zA-Z0-9_|.:-]+$/);
        const details = (await device.shell(`cmd notification get '${key}'`)).toString();
        const displayFields = details.split('\n').filter(line => /android\.(title|text)=/.test(line)).join('\n');
        assert.ok(displayFields.includes(seed.title), 'Actual Android notification title must match the original session');
        assert.ok(displayFields.includes(nativeKind === 'approval' ? '有操作等待你批准' : '有问题等待你回答'), 'Actual Android notification must retain its actionable status');
        titleVerified = seed.title;
      }
      const cancelledAt = Date.now();
      await writeFile(control, JSON.stringify({ id: randomUUID(), sessionId: seed.sessionId, kind: 'cancel', target: id }));
      let host, result;
      await until(async () => { host = await readHost(); result = host.results.find(row => row.id === id); return !!result; });
      assert.equal(host.failure, undefined);
      pendingRequest = null;
      assert.equal(result.outcome, kind === 'approval-cancel' ? 'cancelled' : 'ASK_ABORTED');
      assert.ok(result.elapsedMs < 60000, 'Explicit cancellation must precede the three-minute fallback deadline');
      await card.waitFor({ state: 'detached' });
      await until(async () => (await notices()).length === 0);
      assert.equal(await editor.innerText(), 'DSHM_CANCEL_NOTICE_DRAFT');
      if (kind === 'approval-cancel') {
        const decision = host.audit.filter(event => event.type === 'approval/decided').at(-1);
        assert.equal(decision.data.outcome, 'cancelled');
      }
      report.checks.push({ kind, outcome: result.outcome, originalSystemNotification: key, clearedAfterMs: Date.now() - cancelledAt,
        pendingCardRemoved: true, draftPreserved: true, ...(preview ? { titleVerified } : {}),
        ...(approvalCategory ? { step, settings, suppressedObservationMs: step === 'disabled' ? 2000 : undefined } : {}) });
    }
    assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), pid);
    assert.equal((await notices()).length, 0);
    await writeFile(`${prefix}-host.json`, JSON.stringify(await readHost(), null, 2));
    report.backgroundProcessPreserved = true;
  } else if (phase === 'restore' || phase === 'discard') {
    assert.equal(await title.innerText(), seed.title);
    if (phase === 'discard') {
      await page.getByRole('button', { name: '放弃整组问题', exact: true }).click();
      await page.locator('[data-question-key]').waitFor({ state: 'detached' });
      report.interruptedQuestionDiscarded = true;
    }
    assert.ok(['', 'DSHM_CANCEL_NOTICE_DRAFT'].includes((await editor.innerText()).trim()), 'Only the known test draft may be cleared');
    assert.equal(await page.locator('[data-approval-key]').count(), 0);
    assert.equal(await page.locator('[data-question-key]').count(), 0);
    await editor.fill('');
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await editor.waitFor(); assert.equal((await editor.innerText()).trim(), '');
    report.originalChatRestored = true; report.testDraftCleared = true;
  } else {
    assert.equal(seed.cleaned, true);
    assert.equal(await title.innerText(), 'DSHM Remote 联调提示'); assert.equal((await editor.innerText()).trim(), '');
    assert.equal(await page.getByRole('article', { name: '模型回复', exact: true }).count(), 16);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '刷新会话', exact: true }).click();
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await main.locator('button.remote-session-row').filter({ hasText: seed.title }).count(), 0);
    assert.equal(await main.getByText('DSHM 审批超时测试', { exact: true }).count(), 0);
    await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    report.testWorkspaceAndChatRemovedFromList = true; report.originalChatAndDraftPreserved = true;
  }
  assert.equal((await notices()).length, 0); assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (pendingRequest) {
    try {
      await writeFile(control, JSON.stringify({ id: randomUUID(), sessionId: pendingRequest.sessionId, kind: 'cancel', target: pendingRequest.id }));
      await until(async () => (await readHost()).results.some(row => row.id === pendingRequest.id));
      report.failedRequestCancelled = true;
    } catch { report.failedRequestCleanupPending = true; }
  }
  if (restoreApproval) {
    try {
      await openRemote();
      const settings = await approvalSetting(restoreApproval['需要批准']);
      assert.deepEqual(settings, restoreApproval); report.settingsRestored = true;
    } catch (error) { report.settingsRestoreFailure = error.message; process.exitCode = 1; }
  }
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') report.cleanupError = error.code; });
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
