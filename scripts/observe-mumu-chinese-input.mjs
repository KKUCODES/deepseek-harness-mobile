import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅记录测试会话空草稿的真实输入事件；拼音按键和候选选择由模拟器界面完成。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const report = { at: new Date().toISOString() };
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device);
let page, editor;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page);
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  editor = page.getByRole('textbox', { name: '消息', exact: true });
  assert.equal((await editor.innerText()).trim(), '');
  const measure = () => page.evaluate(() => ({ height: innerHeight, visualHeight: visualViewport.height,
    composerBottom: document.querySelector('.composer-area')?.getBoundingClientRect().bottom }));
  report.before = await measure();
  await page.evaluate(() => {
    window.dshmImeObservation = { events: [], controller: new AbortController() };
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input']) {
      // 聚焦后原编辑器可能重新挂载，使用捕获监听覆盖真实输入节点的更替。
      document.addEventListener(type, event => {
        if (event.target instanceof Element && event.target.closest('[data-testid="remote-workspace"] [contenteditable="true"]')) {
          window.dshmImeObservation.events.push({ type, data: event.data, inputType: event.inputType, composing: event.isComposing, trusted: event.isTrusted });
        }
      }, { capture: true, signal: window.dshmImeObservation.controller.signal });
    }
  });
  console.log('IME_READY_FOR_NATIVE_INPUT');
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [contenteditable="true"]')?.textContent === '你好'
    && window.dshmImeObservation.events.some(event => event.trusted && ['beforeinput', 'input'].includes(event.type)), null, { timeout: 120000 });
  report.events = await page.evaluate(() => window.dshmImeObservation.events);
  report.after = await measure();
  report.chineseCandidateCommitted = true;
  report.compositionEventsObserved = report.events.some(event => event.type === 'compositionend');
  report.keyboardReducedViewport = report.after.visualHeight < report.before.visualHeight - 100;
  report.composerAboveKeyboard = report.after.composerBottom <= report.after.visualHeight + 1;
  await page.screenshot({ path: 'artifacts/mumu-chinese-input.png' });
} catch (error) {
  report.failure = error.message.split('\n')[0];
  report.events = await page?.evaluate(() => window.dshmImeObservation?.events).catch(() => undefined);
  process.exitCode = 1;
}
finally {
  if (editor) report.draftEmpty = await editor.innerText().then(text => text.trim() === '').catch(() => false);
  if (page) await page.evaluate(() => { window.dshmImeObservation?.controller.abort(); delete window.dshmImeObservation; }).catch(() => {});
  await writeFile('artifacts/mumu-chinese-input.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
