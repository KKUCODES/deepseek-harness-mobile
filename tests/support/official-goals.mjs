import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机原目标表单与真实自动回复；目标有轮次上限，不改文件或电脑凭据。 */
export async function verifyOfficialGoals({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace'), checks = inference.goals;
  const editor = main.locator('[data-composer-input]');
  const report = { completed: false };
  const save = () => writeFile(resolve(evidence, 'goals.json'), JSON.stringify(report, null, 2) + '\n');
  const sheet = page.getByRole('dialog', { name: '当前目标', exact: true });
  const modelRead = task => main.evaluate(async (element, task) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model;
      if (task.staleRef) {
        const result = await model.remote.goals.edit(model.getSnapshot().selected, task.staleRef,
          { objective: task.objective });
        return { ok: result.ok, code: result.ok ? null : result.error.code };
      }
      return model.goals.getSnapshot();
    }
    throw Error('official_goal_model_missing');
  }, task ?? {});
  const ready = async () => {
    await sheet.getByRole('button', { name: '重新读取目标', exact: true }).waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const state = fiber.memoizedProps?.model?.goals?.getSnapshot();
        if (state) return state.status === 'ready' && !state.busy;
      }
      return false;
    });
  };
  const open = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '当前目标', exact: true }).click();
    await ready();
  };
  const close = () => sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const objective = token => `这是只读通信验收，请只回复 ${token}。不要调用任何工具，不读写文件，不执行命令。目标状态由用户操作，不需要自行完成或修改目标。`;
  try {
    await checks.initial();
    await editor.fill('DSHM_GOAL_PRESERVED_DRAFT');
    await open();
    const first = objective(checks.marker + '_INITIAL');
    await sheet.getByRole('textbox', { name: '目标内容', exact: true }).fill(first);
    await sheet.getByRole('spinbutton', { name: '最多执行轮次', exact: true }).fill('1');
    await sheet.getByRole('button', { name: '开始目标', exact: true }).click();
    await sheet.getByRole('button', { name: '暂停目标', exact: true }).click();
    await sheet.getByText('已暂停', { exact: true }).waitFor();
    await ready();
    await checks.settled();
    await sheet.getByRole('button', { name: '重新读取目标', exact: true }).click();
    await ready();
    report.createPause = await checks.verify((await modelRead()).value);
    const paused = report.createPause.goal;
    assert.equal(paused.phase, 'paused'); assert.equal(paused.activation, 'disarmed');
    assert.ok(paused.roundsStarted <= 1);
    await mark('official-phone-goal-create-pause-and-durable-state');
    const changed = objective(checks.marker + '_COMPUTER_EDIT');
    report.computerEdit = await checks.editOnComputer(changed);
    await sheet.getByText(changed, { exact: true }).waitFor();
    await ready();
    report.computerEditObserved = await checks.verify((await modelRead()).value);
    const beforeStale = await checks.history();
    report.staleEdit = await modelRead({ staleRef: { id: paused.id, revision: paused.revision },
      objective: objective(checks.marker + '_MUST_NOT_APPLY') });
    // 官方 wire 对 GoalError 返回通用错误；拒绝仍须结合持久日志未变核对。
    assert.equal(report.staleEdit.ok, false); assert.equal(report.staleEdit.code, 'gateway/internal');
    assert.deepEqual((await checks.history()).records, beforeStale.records);
    const finalToken = checks.marker + '_RESUMED', finalObjective = objective(finalToken);
    await sheet.getByRole('button', { name: '编辑目标', exact: true }).click();
    await sheet.getByRole('textbox', { name: '目标内容', exact: true }).fill(finalObjective);
    await sheet.getByRole('spinbutton', { name: '最多执行轮次', exact: true }).fill(String(paused.roundsStarted + 1));
    await sheet.getByRole('button', { name: '保存目标', exact: true }).click();
    await sheet.getByText(finalObjective, { exact: true }).waitFor(); await ready();
    report.phoneEdit = await checks.verify((await modelRead()).value);
    const beforeRound = await checks.history();
    await sheet.getByRole('button', { name: '继续目标', exact: true }).click();
    await close();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: finalToken })
      .last().waitFor({ timeout: 180000 });
    report.resumed = await checks.verifyRound(beforeRound, finalObjective, finalToken);
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await editor.innerText(), 'DSHM_GOAL_PRESERVED_DRAFT');
    await open();
    await sheet.getByText('需要处理', { exact: true }).waitFor();
    await ready();
    await checks.verify((await modelRead()).value);
    assert.equal(await sheet.getByRole('button', { name: '继续目标', exact: true }).isDisabled(), true);
    await writeFile(resolve(evidence, 'goal-real-round.png'), await device.screenshot());
    await mark('official-goal-computer-phone-edit-stale-rejection-and-real-automatic-reply');
    await sheet.getByRole('button', { name: '标记完成', exact: true }).click();
    await sheet.getByText('已完成', { exact: true }).waitFor(); await ready();
    report.complete = await checks.verify((await modelRead()).value);
    const completed = await checks.history();
    await sheet.getByRole('button', { name: '清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '取消清除', exact: true }).click();
    assert.deepEqual((await checks.history()).records, completed.records);
    await sheet.getByRole('button', { name: '清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '确认清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '开始目标', exact: true }).waitFor(); await ready();
    report.clear = await checks.cleared(completed);
    assert.equal((await modelRead()).value, null); await close();
    const cleared = await checks.history();
    await disconnect(); await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    assert.equal(await editor.innerText(), 'DSHM_GOAL_PRESERVED_DRAFT');
    await open(); await sheet.getByRole('button', { name: '开始目标', exact: true }).waitFor();
    assert.equal((await modelRead()).value, null);
    assert.deepEqual((await checks.history()).records, cleared.records);
    assert.equal(await page.locator('iframe').count(), 0);
    await writeFile(resolve(evidence, 'goal-cleared-reconnected.png'), await device.screenshot());
    await close(); await editor.fill('');
    await mark('official-goal-complete-clear-cancel-and-reconnect-no-replay');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
