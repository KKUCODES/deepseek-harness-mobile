import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 原反馈插件界面、真实Host写入与只读通知，不改桥或注入组件状态。 */
export async function verifyOfficialFeedback({ page, device, evidence, inference, phoneMarker, disconnect, reconnect, mark }) {
  const seed = inference.feedback, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]'), dialog = page.getByRole('dialog', { name: '提交反馈', exact: true });
  const report = { passed: false, phases: [], draft: 'DSHM_FEEDBACK_DRAFT' };
  const save = () => writeFile(resolve(evidence, 'feedback.json'), JSON.stringify(report, null, 2) + '\n');
  const actions = main.getByRole('button', { name: /^(好的回答|有问题的回答|取消标记)$/ });
  const count = await actions.count(); assert.ok(count >= 2 && count % 2 === 0);
  const like = actions.nth(count - 2), dislike = actions.nth(count - 1);
  const observed = async rating => {
    await like.and(page.locator(`[aria-pressed="${rating === 'positive'}"]`)).waitFor();
    await dislike.and(page.locator(`[aria-pressed="${rating === 'negative'}"]`)).waitFor();
  };
  const preserve = async () => {
    assert.equal(await editor.innerText(), report.draft);
    assert.equal(await main.getByRole('article', { name: '模型回复', exact: true }).count(), replies);
    assert.equal(await page.locator('iframe').count(), 0);
  };
  const sessionDialog = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '会话反馈', exact: true }).click();
    await dialog.waitFor(); assert.equal(await dialog.count(), 1);
  };
  const replies = await main.getByRole('article', { name: '模型回复', exact: true }).count();
  try {
    report.initial = await seed.initial(phoneMarker);
    await editor.fill(report.draft); await observed(null);
    await like.click(); await dialog.waitFor();
    await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).fill(seed.note + '_CANCELLED');
    await dialog.getByRole('button', { name: '关闭', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    await sessionDialog(); await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await dialog.waitFor({ state: 'detached' }); report.phases.push(await seed.cancelled()); await preserve();
    await mark('official-feedback-message-and-session-dialog-cancel-no-write'); await save();

    await like.click(); await dialog.waitFor();
    await dialog.getByRole('button', { name: '任务结果', exact: true }).click();
    await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).fill(seed.note);
    await dialog.getByRole('button', { name: '提交', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    await observed('positive'); report.phases.push(await seed.phonePositive()); await preserve();
    await writeFile(resolve(evidence, 'feedback-phone-positive.png'), await device.screenshot());
    await mark('official-feedback-phone-positive-original-message-id-and-log'); await save();

    report.phases.push(await seed.desktopNegative());
    // 不点击或悬停反馈按钮，必须由原通知和重新读取自动反映电脑变更。
    await observed('negative'); report.desktopNegativeObservedWithoutInteraction = true;
    report.staleVersion = await seed.staleVersion(); await preserve();
    await writeFile(resolve(evidence, 'feedback-desktop-negative.png'), await device.screenshot());
    await mark('official-feedback-desktop-negative-live-notification-and-stale-version-refused'); await save();

    await dislike.click(); await observed(null); report.phases.push(await seed.phoneRetracted()); await preserve();
    await mark('official-feedback-phone-retract-original-delete-event'); await save();
    report.phases.push(await seed.desktopPositive()); await observed('positive');
    await disconnect(); await page.getByTestId('remote-offline-status').waitFor();
    await preserve(); await reconnect(); await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await observed('positive'); report.phases.push(await seed.reconnected()); await preserve();
    report.reconnectKeepsRatingAndDraftWithoutResubmit = true;
    await mark('official-feedback-reconnect-reloads-same-rating-no-write'); await save();

    report.phases.push(await seed.desktopDelete()); await observed(null); await preserve();
    report.desktopDeleteObservedWithoutInteraction = true;
    await mark('official-feedback-desktop-delete-live-notification'); await save();
    await sessionDialog();
    await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).fill(seed.note + '_SESSION');
    await dialog.getByRole('button', { name: '产品功能与交互', exact: true }).click();
    await dialog.getByRole('button', { name: '提交', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    report.recorded = await seed.sessionRecorded(); await observed(null); await preserve();
    await writeFile(resolve(evidence, 'feedback-session-recorded.png'), await device.screenshot());
    await mark('official-feedback-session-recorded-actual-local-otlp-and-no-model-work');
    report.passed = true; await editor.fill(''); return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
}
