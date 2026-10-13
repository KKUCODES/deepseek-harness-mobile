import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chooseDownload } from '../../scripts/android-picker-test.mjs';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 真实系统选取和发送；只读取自有原件与公开聊天状态，不注入上传或模型结果。 */
export async function verifyOfficialAttachmentSending({ page, device, evidence, inference, packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.attachmentSending, owned = [], report = { passed: false, phases: [] };
  let main, editor, pending, offline;
  const bind = () => {
    main = page.getByTestId('remote-workspace'); editor = main.locator('[data-composer-input]');
    pending = page.getByLabel('待发送附件', { exact: true }); offline = page.getByTestId('remote-offline-status');
  }; bind();
  const pid = async () => (await device.shell('pidof ' + packageName)).toString().trim();
  const save = () => writeFile(resolve(evidence, 'attachment-sending.json'), JSON.stringify(report, null, 2) + '\n');
  const publicState = () => main.evaluate(async element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot(), files = [];
      for (const file of state.attachments[state.selected] ?? []) {
        const source = file.source instanceof Blob ? await file.source.arrayBuffer() : null;
        const sha256 = source ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', source))]
          .map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
        files.push({ name: file.name, bytes: file.bytes, state: file.state, sourceBytes: source?.byteLength, sha256,
          hasReceipt: typeof file.receiptId === 'string', hasFileRef: !!file.file });
      }
      return { selected: state.selected, draft: state.drafts[state.selected], files };
    }
    throw Error('official_attachment_sending_identity_missing');
  });
  const preserve = async () => {
    assert.equal(await pid(), report.appPid); assert.equal((await publicState()).selected, report.sessionId);
    assert.equal(await page.locator('iframe').count(), 0);
  };
  const draft = async text => {
    await page.waitForFunction(text => {
      const editor = document.querySelector('[data-testid="remote-workspace"] [data-composer-input]');
      return editor && (text ? editor.innerText === text : editor.textContent === '' && /^\n*$/.test(editor.innerText));
    }, text);
    assert.equal((await publicState()).draft, text);
  };
  const source = async (file, expectedState, noReceipt = false) => {
    const state = await publicState(); assert.equal(state.files.length, 1);
    assert.ok([expectedState].flat().includes(state.files[0].state));
    assert.equal(state.files[0].name, file.name); assert.equal(state.files[0].bytes, file.bytes);
    assert.equal(state.files[0].sourceBytes, file.bytes); assert.equal(state.files[0].sha256, file.sha256);
    if (noReceipt) { assert.equal(state.files[0].hasReceipt, false); assert.equal(state.files[0].hasFileRef, false); }
    return state;
  };
  const chip = file => pending.locator('.remote-file').filter({ hasText: file.name });
  const select = async file => {
    await main.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
    await chooseDownload(device, file.name);
  };
  const ready = file => chip(file).getByRole('status').filter({ hasText: /^已上传/ }).waitFor({ timeout: 60000 });
  const picture = async name => {
    if (await pending.isVisible()) await pending.scrollIntoViewIfNeeded();
    await writeFile(resolve(evidence, name + '.png'), await device.screenshot());
  };
  const hash = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  const exists = async path => (await device.shell(`if [ -e '${path}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const endApp = async item => {
    await preserve(); item.oldPid = await pid();
    await device.shell('am force-stop ' + packageName); assert.equal(await pid(), ''); item.actualProcessEnded = true;
  };
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
    await mark('official-attachment-' + (item.phase ?? 'partial-upload') + '-normal-launcher-original-binding-and-session');
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.initialAppPid = report.appPid;
    report.sessionId = (await publicState()).selected; assert.equal(report.sessionId, seed.sessionId);
    assert.equal(await pending.count(), 0);
    for (const file of seed.files) {
      assert.match(file.name, /^dshm-attachment-send-[a-f0-9]{8}-(before|after)\.txt$/);
      const bytes = await seed.source(file.name), path = '/sdcard/Download/' + file.name;
      assert.equal(bytes.length, file.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      assert.equal(await exists(path), false); await device.push(bytes, path); owned.push({ path, sha256: file.sha256 });
      assert.equal(await hash(path), file.sha256);
    }
    const first = seed.files[0], partial = { initial: await seed.armUpload() }; report.partialUpload = partial;
    await select(first);
    if (seed.processExit) {
      partial.held = await seed.uploadHeld(); assert.equal(partial.held.awaitingProcessExit, true);
      assert.equal(partial.held.socketClosed, false); partial.preExitOriginal = await source(first, 'uploading', true);
      await draft(''); await picture('attachment-partial-upload-pending-before-app-exit');
      await endApp(partial); partial.cut = await seed.uploadCut(); assert.equal(await pid(), '');
      partial.originalUploadClosedByAppExit = true;
    } else if (seed.hostExit) {
      partial.held = await seed.uploadHeld(); assert.equal(partial.held.awaitingHostExit, true);
      assert.equal(partial.held.socketClosed, false); partial.preHostOriginal = await source(first, 'uploading', true);
      await draft(''); await preserve();
      partial.stop = await seed.stop(true); partial.cut = partial.stop.disconnected;
      assert.equal(partial.stop.stopped.processTreeEnded, true); assert.equal(partial.stop.stopped.portClosed, true);
      assert.equal(partial.stop.realHostDisconnectForwarded, true);
      await offline.waitFor({ timeout: 30000 }); await preserve(); await draft('');
      partial.offlineOriginal = await publicState(); assert.equal(partial.offlineOriginal.files[0].sha256, first.sha256);
      partial.originalUploadEndedByHostExit = true; await picture('attachment-partial-upload-host-offline');
    } else {
      partial.cut = await seed.uploadCut(); await offline.waitFor({ timeout: 30000 });
      partial.offlineOriginal = await publicState(); assert.equal(partial.offlineOriginal.files.length, 1);
      assert.equal(partial.offlineOriginal.files[0].sha256, first.sha256); await draft(''); await preserve();
      await picture('attachment-partial-upload-offline');
    }
    await mark(seed.hostExit ? 'official-file-upload-partial-consumption-and-actual-host-exit'
      : 'official-file-upload-partial-consumption-and-real-socket-cut'); await save();
    if (seed.hostExit) {
      partial.start = await seed.start(true); assert.equal(partial.start.entry, 'pnpm dsh web');
      assert.notEqual(partial.start.launchPid, partial.stop.stopped.oldLaunchPid);
    } else await seed.resume();
    if (seed.processExit) await reopen(partial);
    else await offline.waitFor({ state: 'detached', timeout: 60000 });
    partial.reconnected = await seed.uploadReconnected();
    await chip(first).getByRole('button', { name: '重新准备附件', exact: true }).waitFor();
    // 同Host重连保留原model，上传取消回调可显示error；两态都必须保留原件且只有显式准备按钮。
    partial.restoredOriginal = await source(first, seed.processExit ? 'restored' : ['restored', 'error'], true); await preserve(); await draft('');
    await chip(first).getByRole('button', { name: '重新准备附件', exact: true }).click(); await ready(first);
    partial.prepared = await seed.prepared(first.name, 2); partial.explicitPrepareClicked = true;
    await source(first, 'ready'); await picture('attachment-partial-upload-prepared');
    await mark('official-original-blob-explicit-full-upload-and-real-official-receipt'); await save();
    for (const phase of ['before-forward', 'after-receipt']) {
      const target = seed.targets[phase], file = target.file, item = { phase }; report.phases.push(item);
      if (phase === 'after-receipt') { await select(file); await ready(file); item.prepared = await seed.prepared(file.name, 1); }
      item.initial = await seed.arm(phase); await editor.fill(target.text);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      if (seed.processExit) {
        item.held = await seed.held(); assert.equal(item.held.awaitingProcessExit, true); assert.equal(item.held.socketClosed, false);
        item.preExitOriginal = await publicState(); assert.equal(item.preExitOriginal.files[0].sha256, file.sha256);
        // 提交中的原shell已暂时清空输入；持久化草稿保留提交前文字，重开后再核对编辑器恢复。
        assert.equal(item.preExitOriginal.draft, target.text); await preserve();
        await picture('attachment-' + phase + '-pending-before-app-exit');
        await endApp(item); item.cut = await seed.disconnected(); assert.equal(await pid(), '');
        item.originalRequestClosedByAppExit = true;
      } else if (seed.hostExit) {
        item.held = await seed.held(); assert.equal(item.held.awaitingHostExit, true); assert.equal(item.held.socketClosed, false);
        item.preHostOriginal = await publicState(); assert.equal(item.preHostOriginal.files[0].sha256, file.sha256);
        assert.equal(item.preHostOriginal.draft, target.text); await preserve();
        item.stop = await seed.stop(); item.cut = item.stop.disconnected;
        assert.equal(item.stop.stopped.processTreeEnded, true); assert.equal(item.stop.stopped.portClosed, true);
        assert.equal(item.stop.realHostDisconnectForwarded, true);
        await offline.waitFor({ timeout: 30000 }); await preserve(); await draft(target.text);
        item.offlineOriginal = await publicState(); assert.equal(item.offlineOriginal.files[0].sha256, file.sha256);
        item.originalRequestInterruptedByHostExit = true; await picture('attachment-' + phase + '-host-offline');
      } else {
        item.cut = await seed.disconnected(); await offline.waitFor({ timeout: 30000 });
        await draft(target.text); await preserve(); item.offlineOriginal = await publicState();
        assert.equal(item.offlineOriginal.files[0].sha256, file.sha256); await picture('attachment-' + phase + '-offline');
      }
      await mark('official-file-message-' + phase + (seed.hostExit ? '-actual-host-exit-and-original-draft' : '-real-cut-and-original-draft')); await save();
      if (seed.hostExit) {
        item.start = await seed.start(); assert.equal(item.start.entry, 'pnpm dsh web');
        assert.notEqual(item.start.launchPid, item.stop.stopped.oldLaunchPid);
      } else await seed.resume();
      if (seed.processExit) await reopen(item);
      else await offline.waitFor({ state: 'detached', timeout: 60000 });
      item.reconnected = await seed.reconnected(); await preserve();
      if (phase === 'before-forward') {
        await draft(target.text); item.uncertainOriginal = await source(file, 'uncertain');
        assert.equal(await chip(file).getByRole('button', { name: '重新准备附件', exact: true }).count(), 0);
        await chip(file).getByRole('button', { name: '移除附件 ' + file.name, exact: true }).click();
        await pending.waitFor({ state: 'detached' }); await draft(target.text);
        await select(file); await ready(file); item.reselected = await seed.prepared(file.name, 3);
        await source(file, 'ready'); await draft(target.text);
        await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.explicitReselectAndNewSend = true;
      } else {
        await draft(''); await pending.waitFor({ state: 'detached', timeout: 60000 }); item.originalReceiptClearedDraftAndAttachment = true;
        if (seed.hostExit) {
          assert.equal(item.reconnected.originalSettledWithoutReplay, true);
          await main.getByText(target.text, { exact: true }).waitFor();
          assert.equal(await main.getByText(target.text, { exact: true }).count(), 1);
          if (item.reconnected.reason.kind === 'interrupted') {
            const interrupted = main.locator('button[data-turn-process]').filter({ hasText: '已中断' });
            await interrupted.waitFor(); await interrupted.scrollIntoViewIfNeeded(); item.interruptedOriginalShownWithoutRetry = true;
          } else item.completedOriginalShownWithoutRetry = true;
          await picture('attachment-after-receipt-host-recovered');
          await editor.fill(seed.targets.followup.text);
          await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.explicitNewFollowup = true;
        }
      }
      item.settled = await seed.settled();
      const reply = main.getByRole('article', { name: '模型回复', exact: true }).getByText(item.settled.marker, { exact: true });
      await reply.waitFor({ timeout: 180000 }); await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      await draft(''); await pending.waitFor({ state: 'detached' }); await preserve();
      await reply.scrollIntoViewIfNeeded(); await picture('attachment-' + phase + '-settled');
      await mark('official-file-message-' + phase + '-one-user-message-real-attachment-read-and-original-byte-check'); await save();
    }
    report.final = await seed.final(); await preserve();
    if (seed.processExit) report.threeActualExitsAndOriginalSession = true;
    else if (seed.hostExit) { report.threeActualHostExitsAndOriginalSession = true; report.sameProcessAndSession = true; }
    else report.sameProcessAndSession = true;
    report.passed = true;
  } catch (error) { report.failure = error.message; report.failureState = await publicState().catch(() => ({ pageClosed: true })); throw error; }
  finally {
    for (const item of owned) {
      if (!await exists(item.path)) continue;
      assert.equal(await hash(item.path), item.sha256, 'Refusing cleanup of changed attachment fixture');
      await device.shell(`rm '${item.path}'`); assert.equal(await exists(item.path), false);
    }
    report.ownCopiesRemoved = true; await save();
  }
  return report;
}
