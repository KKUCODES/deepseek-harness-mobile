import assert from 'node:assert/strict';
import { resolve } from 'node:path';

/** 真实手机确认请求在原启动入口等待，撤权后释放；不伪造响应，也不改原启动器。 */
export async function verifyLatestDesktopRevocationPage(page, workspacePath, evidence, probe, revoke) {
  const mode = process.env.DSHM_LATEST_SOURCE_CHECK === '1' ? 'source' : 'npm';
  const dialog = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, original = bridge.postMessage, operations = [];
    const observe = function(raw) {
      const operation = JSON.parse(raw).data?.frame?.operation;
      if (operation?.method === 'remote.openDesktopApp') operations.push({ sessionId: operation.sessionId });
      return original.call(this, raw);
    };
    bridge.postMessage = observe;
    window.__latestDesktopRevoke = { operations, restore() { if (bridge.postMessage === observe) bridge.postMessage = original; } };
  });
  try {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '在电脑应用中打开', exact: true }).click();
    await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).click();
    await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).waitFor();
    assert.equal(await dialog.locator('.remote-file-path').innerText(), workspacePath);
    await page.screenshot({ path: resolve(evidence, `latest-desktop-revocation-${mode}-confirm.png`) });
    const baseline = await probe.control('arm-open');
    await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
    const entered = await probe.wait(value => value.hold?.entered === true);
    assert.equal(entered.hold.phase, 'open');
    assert.equal(entered.openCalls, baseline.openCalls + 1);
    await revoke();
    await probe.wait(value => value.hold?.aborted === true);
    await probe.control('release');
    const settled = await probe.wait(value => value.hold?.nativeOpenSettled === true);
    assert.equal(settled.openCalls, baseline.openCalls + 1);
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
    await page.getByText('正在处理…', { exact: true }).waitFor({ state: 'detached' });
    assert.equal(await page.getByText('已向电脑发送打开请求。', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '确认在电脑打开', exact: true }).count(), 0);
    const operations = await page.evaluate(() => window.__latestDesktopRevoke.operations);
    assert.equal(operations.length, 1, 'Revocation must not retry the launch');
    const osObservation = await probe.verifyNoOpen();
    await page.screenshot({ path: resolve(evidence, `latest-desktop-revocation-${mode}-revoked.png`) });
    return { passed: true, nativeRequestEntered: true, callerAborted: true, originalOpenSettled: true,
      successNotShown: true, confirmationCleared: true, busyCleared: true, invalidAuthorizationShown: true, noAutomaticRetry: true,
      osObservation, operations };
  } finally {
    const state = await probe.control('status');
    if (state.hold?.entered && !state.hold.released) await probe.control('release');
    await page.evaluate(() => { window.__latestDesktopRevoke?.restore(); delete window.__latestDesktopRevoke; });
  }
}
