// 首次续聊点击超时的受限只读诊断；不点击发送或改变审批、凭据和事件。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const seed = JSON.parse(await readFile(resolve(runtime, 'latest-live-release-nested-child-seed.json'), 'utf8'));
const failed = JSON.parse(await readFile(resolve(runtime, 'latest-live-release-nested-child-android-resume.json'), 'utf8'));
assert.equal(failed.passed, false); assert.equal(failed.phase, 'resume'); assert.equal(seed.resume.attempted, true);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
let ui;
try {
  const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.latesttest')).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/')); assert.ok(page);
  ui = await page.getByTestId('remote-workspace').evaluate(element => {
    let value;
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      value = { selected: state.selected, running: state.session?.running, selectedTarget: state.selectedTarget,
        childSession: state.session?.childSession, connection: state.connection, error: state.error,
        draft: state.drafts?.[state.selected] }; break;
    }
    return { value, inputs: [...element.querySelectorAll('[data-composer-input]')].map(node => ({ text: node.innerText, editable: node.contentEditable })),
      buttons: [...element.querySelectorAll('button')].filter(node => /发送|停止|子会话/.test(node.getAttribute('aria-label') ?? node.innerText))
        .map(node => ({ label: node.getAttribute('aria-label') ?? node.innerText, disabled: node.disabled })) };
  });
} finally { await device.close(); }
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
try {
  assert.equal(seed.home, live.state.home); assert.equal(seed.parentId, live.session.sessionId);
  const grand = await live.readChild(seed.grandId, { ancestors: [seed.middleId] });
  const after = grand.records.map(row => row.event).filter(event => event.seq > seed.resume.beforeSeq);
  const result = { passed: true, ui, grandSeq: grand.projections.asOfSeq,
    eventsAfterAttempt: after.map(event => ({ type: event.type, seq: event.seq })),
    projection: grand.projections.values.childSession, noAdmission: after.length === 0 };
  await writeFile(resolve(runtime, 'latest-live-release-nested-child-send-inspection.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(result));
} finally { await live.device.close(); }
setTimeout(() => process.exit(0), 200);
