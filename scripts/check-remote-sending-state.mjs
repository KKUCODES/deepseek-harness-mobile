import assert from 'node:assert/strict';

/** 原 Session.prompt、原提交状态机、手机按钮和公开通知接口共同参与。 */
export async function checkRemoteSendingState(page) {
  const main = page.getByTestId('remote-workspace');
  await main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: 'one' }).first().click();
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const send = main.getByRole('button', { name: '发送消息', exact: true });
  await page.evaluate(() => {
    const model = window.preview15.model, call = model.transport.call;
    window.sendingState = { calls: 0, gate: Promise.withResolvers() };
    model.transport.call = async function (channel, endpoint, ...rest) {
      if (endpoint !== 'session/prompt') return call.call(this, channel, endpoint, ...rest);
      window.sendingState.calls++;
      await window.sendingState.gate.promise;
      return { ok: false, error: { code: 'fixture/prompt', message: '发送失败验收，请重试。' } };
    };
  });
  const draft = '保留前后台切换中的草稿';
  await input.fill(draft); await send.click();
  await page.waitForFunction(() => window.sendingState.calls === 1);
  assert.equal(await page.evaluate(() => window.preview15.model.inputBindings.mounted().shell.snapshot.phase), 'sending');
  await page.evaluate(() => {
    const model = window.preview15.model;
    model.inputBindings.forBinding(model.reference.binding).target.notify('info', '连接已检查');
  });
  await page.waitForTimeout(50);
  assert.equal(await send.isDisabled(), true, '普通提示不得解除原 sending 阶段的提交锁');
  assert.equal(await input.getAttribute('contenteditable'), 'false');
  await page.evaluate(() => {
    const model = window.preview15.model;
    model.inputBindings.forBinding(model.reference.binding).target.submit('queue');
  });
  assert.equal(await page.evaluate(() => window.sendingState.calls), 1, '公开插件入口也不能重复提交');
  await page.evaluate(() => window.sendingState.gate.resolve());
  await page.waitForFunction(() => !window.preview15.model.inputBindings.mounted().admission.getSnapshot());
  assert.equal(await input.innerText(), draft, '失败仍保留原草稿');
  await send.click();
  await page.waitForFunction(() => window.sendingState.calls === 2 && !window.preview15.model.inputBindings.mounted().admission.getSnapshot());
  assert.equal(await send.isEnabled(), true, '失败重试后不会留下无法发送的提交锁');
  return { noticesWhileSending: true, duplicateGuard: true, retry: true, draftPreserved: true };
}
