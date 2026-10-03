import assert from 'node:assert/strict';

export async function checkSessionExportStatus(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); window.fixture.exportConnection('connected'); });
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '导出会话日志', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  const save = dialog.getByRole('button', { name: '导出并保存', exact: true });
  const children = dialog.getByRole('checkbox', { name: '包含子会话', exact: true });
  const upgrade = dialog.getByText('请更新电脑远程插件和网关后导出日志。', { exact: true });
  await save.waitFor(); assert.equal(await save.isEnabled(), true);
  await children.check();
  for (const [state, retained] of [['disconnected', false], ['connecting', false], ['disconnected', true]]) {
    await page.evaluate(([state, retained]) => window.fixture.exportConnection(state, true, retained), [state, retained]);
    await dialog.getByText(state === 'connecting' ? '正在连接电脑…' : '电脑连接已断开，重新连接后可继续操作。', { exact: true }).waitFor();
    assert.equal(await upgrade.count(), 0);
    assert.equal(await save.isDisabled(), true);
    assert.equal(await children.isChecked(), true);
  }
  await page.evaluate(() => window.fixture.exportConnection('connected', false));
  await upgrade.waitFor(); assert.equal(await save.isDisabled(), true);
  await page.evaluate(() => window.fixture.exportConnection('connected', true));
  await upgrade.waitFor({ state: 'detached' });
  assert.equal(await save.isEnabled(), true); assert.equal(await children.isChecked(), true);
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  return { disconnected: true, connecting: true, staleCapabilitiesDisabled: true, unsupported: true, recovered: true, optionsPreserved: true };
}
