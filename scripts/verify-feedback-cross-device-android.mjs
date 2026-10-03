import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 分阶段暂停给电脑真实 UI 操作。写入阶段仅在人工核对本机日志目的地后执行。
const phase = process.argv[2] ?? 'read';
const marker = process.env.DSHM_FEEDBACK_REPLY_MARKER ?? 'DSHM_HOST_RESTART_OK_1790215159292';
assert.match(marker, /^DSHM_[A-Za-z0-9_]+$/);
assert.ok(['read', 'positive', 'negative-observed', 'retract', 'clean'].includes(phase));
if (['positive', 'retract'].includes(phase)) assert.equal(process.env.DSHM_FEEDBACK_LIVE_TEST, 'local-collector');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, marker, errors: [], writes: [] };
const watchdog = setTimeout(() => { console.error('Feedback verification timed out'); process.exit(2); }, 90000);
let page;
try {
  const initial = await (await androidAppWebView(device)).page();
  page = initial.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, '请先进入已有 Remote 连接');
  page.on('pageerror', () => report.errors.push('page-error'));
  const workspace = page.getByTestId('remote-workspace');
  await workspace.waitFor();
  assert.equal(await workspace.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const reply = page.getByRole('article', { name: '模型回复' }).last();
  assert.ok((await reply.innerText()).split(/\s+/).includes(marker), '仅测试预先核对标记的回复，不自动选择其他内容');
  const draft = page.getByRole('textbox', { name: '消息', exact: true }), beforeDraft = await draft.textContent();
  const beforeCount = await page.getByRole('article', { name: '模型回复' }).count();
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, original = bridge.postMessage;
    window.feedbackCrossDeviceGuard = { writes: [], restore: () => { bridge.postMessage = original; } };
    bridge.postMessage = function(raw) {
      const operation = JSON.parse(raw)?.data?.frame?.operation;
      if (operation?.endpoint === 'messageFeedback/put' || operation?.endpoint === 'messageFeedback/delete') window.feedbackCrossDeviceGuard.writes.push(operation.endpoint);
      return original.call(bridge, raw);
    };
  });
  // 评价挂在原 turn-tail，而不是模型正文 article 内；已核对最新回复后选最后一对控件。
  const actions = workspace.getByRole('button', { name: /^(好的回答|有问题的回答|取消标记)$/ });
  const actionCount = await actions.count(); assert.ok(actionCount >= 2 && actionCount % 2 === 0);
  const like = actions.nth(actionCount - 2), dislike = actions.nth(actionCount - 1);
  const active = like.or(dislike).and(page.locator('[aria-pressed="true"]'));
  if (phase === 'read' || phase === 'clean') {
    assert.equal(await active.count(), 0);
    assert.equal(await like.getAttribute('aria-pressed'), 'false');
    assert.equal(await dislike.getAttribute('aria-pressed'), 'false');
  } else if (phase === 'positive') {
    assert.equal(await active.count(), 0, '不覆盖既有评价');
    await like.click();
    const dialog = page.getByRole('dialog', { name: '提交反馈', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: '其他', exact: true }).click();
    await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).fill('DSHM_LOCAL_FEEDBACK_PHONE：仅本机双端同步验收，稍后撤回。');
    await dialog.getByRole('button', { name: '提交', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await active.waitFor();
    assert.equal(await active.getAttribute('aria-pressed'), 'true');
    assert.equal(await dislike.getAttribute('aria-label'), '有问题的回答');
  } else {
    // 不先点击或悬停评价：这个状态必须来自电脑变动通知。
    await active.waitFor();
    assert.equal(await active.getAttribute('aria-pressed'), 'true');
    assert.equal(await like.getAttribute('aria-label'), '好的回答');
    assert.equal(await dislike.getAttribute('aria-label'), '取消标记');
    report.pcNegativeObserved = true;
    if (phase === 'retract') { await active.click(); await active.waitFor({ state: 'detached' }); }
  }
  assert.equal(await draft.textContent(), beforeDraft);
  assert.equal(await page.getByRole('article', { name: '模型回复' }).count(), beforeCount);
  report.writes = await page.evaluate(() => window.feedbackCrossDeviceGuard.writes);
  assert.deepEqual(report.writes, phase === 'positive' ? ['messageFeedback/put'] : phase === 'retract' ? ['messageFeedback/delete'] : []);
  report.draftAndMessagesPreserved = true;
  await page.screenshot({ path: `artifacts/feedback-cross-device-${phase}-android.png`, fullPage: true });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; throw error; }
finally {
  await page?.evaluate(() => { window.feedbackCrossDeviceGuard?.restore(); delete window.feedbackCrossDeviceGuard; }).catch(() => {});
  await writeFile(`artifacts/feedback-cross-device-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? (report.failure ? 1 : 0));
}
