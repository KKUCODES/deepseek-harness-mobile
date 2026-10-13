import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机自己的归档/分支与原反馈组件，实际正常Host重启；只读取公开页面模型身份。 */
export async function verifyOfficialFeedbackHistory({ page, device, evidence, inference, phoneMarker, title, packageName, mark }) {
  const seed = inference.feedbackHistory, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]'), dialog = page.getByRole('dialog', { name: '提交反馈', exact: true });
  const report = { passed: false, phases: [], draft: 'DSHM_FEEDBACK_HISTORY_PARENT_DRAFT', forkDraft: 'DSHM_FEEDBACK_HISTORY_FORK_DRAFT' };
  const save = () => writeFile(resolve(evidence, 'feedback-history.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell('pidof ' + packageName)).toString().trim();
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      return { selected: state.selected, title: state.list?.byId[state.selected]?.displayTitle };
    }
    throw Error('official_feedback_history_identity_missing');
  });
  const actions = () => main.getByRole('button', { name: /^(好的回答|有问题的回答|取消标记)$/ });
  const pair = async () => {
    // 会话路由和输入框先出现；必须等真实历史回复及其反馈按钮完成渲染。
    await main.getByRole('article', { name: '模型回复', exact: true }).getByText(phoneMarker, { exact: true }).waitFor();
    await actions().nth(3).waitFor();
    const count = await actions().count();
    assert.ok(count >= 4 && count % 2 === 0);
    return [actions().nth(count - 2), actions().nth(count - 1)];
  };
  const observed = async rating => {
    const [like, dislike] = await pair();
    await like.and(page.locator(`[aria-pressed="${rating === 'positive'}"]`)).waitFor();
    await dislike.and(page.locator(`[aria-pressed="${rating === 'negative'}"]`)).waitFor();
  };
  const menu = async () => { await main.getByRole('button', { name: 'Remote 选项', exact: true }).click(); return page.getByRole('dialog', { name: 'Remote 选项', exact: true }); };
  const row = name => main.locator('.remote-session-row').filter({ has: page.getByText(name, { exact: true }) });
  const back = () => main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  const submit = async (rating, note) => {
    const buttons = await pair(); await buttons[rating === 'positive' ? 0 : 1].click(); await dialog.waitFor();
    await dialog.getByRole('button', { name: rating === 'positive' ? '任务结果' : '其他', exact: true }).click();
    await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).fill(note);
    await dialog.getByRole('button', { name: '提交', exact: true }).click(); await dialog.waitFor({ state: 'detached' }); await observed(rating);
  };
  const preserve = async draft => { assert.equal(await editor.innerText(), draft); assert.equal(await pid(), report.appPid); assert.equal(await page.locator('iframe').count(), 0); };
  const restart = async () => {
    const item = { stopped: await seed.stop() }; report.phases.push(item); await save();
    await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
    assert.equal(await pid(), report.appPid); item.started = await seed.start(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    assert.equal(await pid(), report.appPid); return item;
  };
  try {
    assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.initial = await seed.initial(phoneMarker); report.parentId = (await snapshot()).selected;
    assert.equal(report.parentId, report.initial.sessionId); await observed(null); await editor.fill(report.draft);
    await submit('positive', seed.note); report.positive = await seed.phonePositive(); await preserve(report.draft);
    await mark('official-feedback-history-phone-rating-durable-before-host-exit'); await save();
    await (await menu()).getByRole('button', { name: '归档聊天', exact: true }).click();
    await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).waitFor();
    assert.equal(await row(title).count(), 0); report.archived = await seed.archived();
    await mark('official-feedback-history-phone-archives-original-chat');
    report.firstRestart = await restart();
    report.cold = await seed.coldNegative();
    await mark('official-feedback-history-cold-persistence-put-no-agent-and-local-otlp'); await save();
    await (await menu()).getByRole('button', { name: '查看已归档聊天', exact: true }).click();
    await row(title).click(); await editor.waitFor(); await observed('negative'); await preserve(report.draft);
    await main.getByRole('article', { name: '模型回复', exact: true }).getByText(phoneMarker, { exact: true }).waitFor();
    report.opened = await seed.opened(); report.coldRatingVisibleInOwnHistory = true;
    await writeFile(resolve(evidence, 'feedback-history-cold-negative.png'), await device.screenshot());
    const [, dislike] = await pair(); await dislike.click(); await observed(null); report.retracted = await seed.phoneRetracted();
    await preserve(report.draft); await mark('official-feedback-history-phone-opens-and-retracts-archived-rating');
    await (await menu()).getByRole('button', { name: '取消归档', exact: true }).click();
    await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).waitFor();
    await (await menu()).getByRole('button', { name: '查看最近聊天', exact: true }).click(); await row(title).click();
    await editor.waitFor(); await preserve(report.draft); await submit('positive', seed.note + '_RESTORED');
    report.restored = await seed.restoredPositive();
    await (await menu()).getByRole('button', { name: '在新聊天中分支', exact: true }).click();
    await page.waitForFunction(parentId => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const id = fiber.memoizedProps.model.getSnapshot().selected; return id && id !== parentId;
      }
      return false;
    }, report.parentId);
    const fork = await snapshot(); report.forkId = fork.selected; report.forkTitle = fork.title;
    report.fork = await seed.fork(fork.selected); await observed(null); assert.equal(await editor.innerText(), '');
    await editor.fill(report.forkDraft); await submit('negative', seed.note + '_FORK');
    report.child = await seed.childNegative(); await preserve(report.forkDraft);
    await mark('official-feedback-history-fork-inherited-feedback-unrated-and-independent-child-write');
    report.parentDelete = await seed.parentDeleted(); await observed('negative'); await preserve(report.forkDraft);
    await back(); await row(title).click(); await observed(null); await preserve(report.draft);
    await back(); await row(report.forkTitle).click(); await observed('negative'); await preserve(report.forkDraft);
    report.parentAndForkNavigationKeepIndependentRatingAndDraft = true;
    await mark('official-feedback-history-parent-delete-and-navigation-preserve-child-rating');
    report.secondRestart = await restart(); await observed('negative'); await preserve(report.forkDraft);
    report.recovered = await seed.childRecovered(); assert.equal((await snapshot()).selected, report.forkId);
    assert.equal(report.recovered.item.version, report.child.item.version);
    report.sameForkRatingVersionAndDraftAfterHostRestart = true;
    await writeFile(resolve(evidence, 'feedback-history-fork-restored.png'), await device.screenshot());
    await mark('official-feedback-history-second-host-restart-keeps-fork-rating-and-draft');
    const buttons = await pair(); await buttons[1].click(); await observed(null); report.final = await seed.childRetracted();
    await preserve(report.forkDraft); await editor.fill(''); await back(); await row(title).click();
    await observed(null); await preserve(report.draft); await editor.fill('');
    await writeFile(resolve(evidence, 'feedback-history-parent-restored.png'), await device.screenshot());
    await mark('official-feedback-history-child-retract-parent-independent-and-original-chat-restored');
    report.passed = true; return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
}
