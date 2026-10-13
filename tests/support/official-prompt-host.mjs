import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 保持真实手机进程，原提交未知时结束电脑；重开后按原记录决定草稿与新请求。 */
export async function verifyOfficialPromptHost({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.promptSending, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]'), offline = page.getByTestId('remote-offline-status');
  const report = { passed: false, phases: [] };
  const save = () => writeFile(resolve(evidence, 'prompt-host.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell('pidof ' + packageName)).toString().trim();
  const selected = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client)
      return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('official_prompt_host_identity_missing');
  });
  const preserve = async () => {
    assert.equal(await pid(), report.appPid); assert.equal(await selected(), report.sessionId);
    assert.equal(await page.locator('iframe').count(), 0);
  };
  const draft = async text => {
    await page.waitForFunction(text => {
      const main = document.querySelector('[data-testid="remote-workspace"]'), editor = main?.querySelector('[data-composer-input]');
      if (!editor) return false;
      if (text !== '') return editor.innerText === text;
      if (editor.textContent !== '' || !/^\n*$/.test(editor.innerText)) return false;
      const key = Object.keys(main).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = main[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const state = fiber.memoizedProps.model.getSnapshot(); return state.drafts[state.selected] === '';
      }
      return false;
    }, text);
  };
  const reply = marker => main.getByRole('article', { name: '模型回复', exact: true }).getByText(marker, { exact: true });
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/); report.sessionId = await selected();
    await editor.click(); report.modelLabel = await main.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    for (const phase of ['before-forward', 'after-receipt']) {
      const target = seed.targets[phase], item = { phase, initial: await seed.arm(phase) };
      report.phases.push(item); assert.equal(item.initial.sessionId, report.sessionId);
      await editor.fill(target.text); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      item.held = await seed.held(); assert.equal(item.held.awaitingHostExit, true); assert.equal(item.held.socketClosed, false);
      await preserve(); assert.equal(await reply(target.marker).count(), 0);
      await writeFile(resolve(evidence, 'prompt-host-' + phase + '-pending.png'), await device.screenshot());
      await mark('official-prompt-host-' + phase + '-unconfirmed-original-request'); await save();
      item.stop = await seed.stop(); await save();
      assert.equal(item.stop.stopped.processTreeEnded, true); assert.equal(item.stop.stopped.portClosed, true);
      assert.equal(item.stop.realHostDisconnectForwarded, true);
      await offline.waitFor({ timeout: 30000 }); await preserve();
      await draft(target.text); assert.equal(await reply(target.marker).count(), 0);
      item.unknownDraftPreservedWhileHostOffline = true;
      await writeFile(resolve(evidence, 'prompt-host-' + phase + '-offline.png'), await device.screenshot());
      await mark('official-prompt-host-' + phase + '-actual-host-exit-and-original-draft');
      item.start = await seed.start(); await save();
      assert.equal(item.start.entry, 'pnpm dsh web'); assert.notEqual(item.start.launchPid, item.stop.stopped.oldLaunchPid);
      await offline.waitFor({ state: 'detached', timeout: 60000 }); await editor.waitFor();
      await preserve(); item.recovered = await seed.reconnected();
      await editor.click(); await main.getByRole('button', { name: report.modelLabel, exact: true }).waitFor();
      if (phase === 'before-forward') {
        await draft(target.text); item.unreceivedDraftRetainedAfterReconnect = true;
      } else {
        await draft(''); item.confirmedOriginalDraftCleared = true;
        await main.getByText(target.text, { exact: true }).waitFor();
        assert.equal(await main.getByText(target.text, { exact: true }).count(), 1);
        if (item.recovered.reason.kind === 'interrupted') {
          const interrupted = main.locator('button[data-turn-process]').filter({ hasText: '已中断' });
          await interrupted.waitFor(); await interrupted.scrollIntoViewIfNeeded();
          item.interruptedOriginalShownWithoutRetry = true;
        } else {
          await reply(target.marker).waitFor(); assert.equal(await reply(target.marker).count(), 1);
          await reply(target.marker).scrollIntoViewIfNeeded();
          item.completedOriginalShownWithoutRetry = true;
        }
        await writeFile(resolve(evidence, 'prompt-host-after-receipt-recovered.png'), await device.screenshot());
      }
      await mark('official-prompt-host-' + phase + '-same-app-original-session-model-and-request-recovery'); await save();
      const next = phase === 'before-forward' ? target : seed.targets.followup;
      if (phase === 'before-forward') item.explicitRetryClicked = true;
      else { await editor.fill(next.text); item.explicitNewFollowup = true; }
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      item.settled = await seed.settled(); await save();
      await reply(next.marker).waitFor({ timeout: 30000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      await draft(''); await preserve();
      await reply(next.marker).scrollIntoViewIfNeeded();
      await writeFile(resolve(evidence, 'prompt-host-' + phase + '-settled.png'), await device.screenshot());
      await mark('official-prompt-host-' + phase + '-explicit-new-request-and-unique-real-reply'); await save();
    }
    report.final = await seed.final(); report.sameProcessAndOriginalSession = true; report.twoActualHostExits = true;
    report.passed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
