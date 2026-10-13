import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 实际输入框发送/恢复，不注入结果；App重开也只读取电脑原会话。 */
export async function verifyOfficialPromptSending({ page, device, evidence, inference, packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.promptSending;
  let main, editor, offline;
  const bind = () => {
    main = page.getByTestId('remote-workspace'); editor = main.locator('[data-composer-input]');
    offline = page.getByTestId('remote-offline-status');
  }; bind();
  const report = { passed: false, phases: [] }, pid = async () => (await device.shell('pidof ' + packageName)).toString().trim();
  const save = () => writeFile(resolve(evidence, 'prompt-sending.json'), JSON.stringify(report, null, 2) + '\n');
  const selected = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client)
      return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('official_prompt_sending_identity_missing');
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
      // Lexical空段落的br使innerText为换行；同时核对实际文字与保存草稿，不能把空白草稿当空输入。
      if (editor.textContent !== '' || !/^\n*$/.test(editor.innerText)) return false;
      const key = Object.keys(main).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = main[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const state = fiber.memoizedProps.model.getSnapshot(); return state.drafts[state.selected] === '';
      }
      return false;
    }, text);
    if (text !== '') assert.equal(await editor.innerText(), text);
    else assert.equal(await editor.textContent(), '');
  };
  const reply = marker => main.getByRole('article', { name: '模型回复', exact: true }).getByText(marker, { exact: true });
  const reopen = async item => {
    const launch = (await device.shell('am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n '
      + packageName + '/dev.dshmobile.validation.ValidationActivity')).toString();
    assert.match(launch, /Status: ok/); item.newPid = await pid(); assert.match(item.newPid, /^[1-9]\d*$/);
    assert.notEqual(item.newPid, item.oldPid); report.appPid = item.newPid;
    const ordinary = await (await androidAppWebView(device, packageName)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
    assert.equal(ordinary.context().pages().length, 1);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opening = ordinary.context().waitForEvent('page', {
      predicate: target => target.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000,
    });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opening; replacePage(page); bind(); await main.waitFor({ timeout: 60000 });
    await main.locator('.remote-session-row').filter({ hasText: title }).click(); await editor.waitFor();
    assert.equal(await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).count(), 0);
    await preserve(); item.normalLauncherAndExistingBinding = true;
    await mark('official-prompt-' + item.phase + '-normal-launcher-original-binding-and-session');
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/); report.sessionId = await selected();
    for (const phase of ['before-forward', 'after-receipt']) {
      const target = seed.targets[phase], item = { phase, initial: await seed.arm(phase) };
      report.phases.push(item); assert.equal(item.initial.sessionId, report.sessionId);
      await editor.fill(target.text); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      if (seed.processExit) {
        item.held = await seed.held(); assert.equal(item.held.awaitingProcessExit, true); assert.equal(item.held.socketClosed, false);
        assert.equal(item.held.forwarded, phase === 'after-receipt');
        item.oldPid = await pid(); assert.match(item.oldPid, /^[1-9]\d*$/);
        await preserve(); assert.equal(await reply(target.marker).count(), 0);
        await writeFile(resolve(evidence, 'prompt-' + phase + '-pending-before-app-exit.png'), await device.screenshot());
        await device.shell('am force-stop ' + packageName); assert.equal(await pid(), '');
        item.actualProcessEnded = true; item.disconnected = await seed.disconnected(); assert.equal(await pid(), '');
        item.originalRequestClosedByAppExit = true;
      } else {
        item.disconnected = await seed.disconnected(); await offline.waitFor({ timeout: 30000 });
        await draft(target.text); await preserve(); item.originalDraftRetainedWhileUnknown = true;
        assert.equal(await reply(target.marker).count(), 0);
        await writeFile(resolve(evidence, 'prompt-' + phase + '-offline.png'), await device.screenshot());
      }
      await mark('official-prompt-' + phase + '-actual-cut-and-original-draft'); await save();
      await seed.resume();
      if (seed.processExit) await reopen(item);
      else await offline.waitFor({ state: 'detached', timeout: 60000 });
      await editor.waitFor(); await preserve(); item.reconnected = await seed.reconnected();
      if (phase === 'before-forward') {
        await draft(target.text); item.unreceivedDraftRetainedAfterReconnect = true;
        await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.explicitRetryClicked = true;
      } else {
        await draft(''); item.confirmedDraftClearedFromOriginalRequest = true;
        item.emptyEditor = await editor.evaluate(element => ({ innerText: element.innerText, textContent: element.textContent }));
      }
      await reply(target.marker).waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      item.settled = await seed.settled(); await draft(''); await preserve();
      await writeFile(resolve(evidence, 'prompt-' + phase + '-settled.png'), await device.screenshot());
      await mark('official-prompt-' + phase + '-one-original-receipt-and-real-reply'); await save();
    }
    report.final = await seed.final();
    if (seed.processExit) report.twoActualExitsAndOriginalSession = true;
    else report.sameProcessAndSession = true;
    report.passed = true;
  } catch (error) {
    report.failure = error.message;
    report.editorFailureState = await main.evaluate(element => {
      const editor = element.querySelector('[data-composer-input]');
      const value = { innerText: editor?.innerText, textContent: editor?.textContent, inputs: element.querySelectorAll('[data-composer-input]').length };
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const state = fiber.memoizedProps.model.getSnapshot();
        return { ...value, selected: state.selected, savedDraft: state.drafts[state.selected] };
      }
      return value;
    }).catch(() => ({ pageClosed: true }));
    throw error;
  } finally { await save(); }
  return report;
}
