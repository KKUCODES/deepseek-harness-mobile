import assert from 'node:assert/strict';

export async function checkRemoteInputApi(page) {
  await page.evaluate(async () => { await window.fixture.enableInputProbe(); await window.fixture.select('one'); });
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const probe = page.getByTestId('input-probe');
  await input.fill('用户输入');
  await probe.getByTestId('probe-draft').filter({ hasText: /^用户输入$/ }).waitFor();
  await probe.getByRole('button', { name: '插件修改草稿', exact: true }).click();
  assert.equal(await input.innerText(), '用户输入 plugin');
  assert.equal(await page.evaluate(() => window.fixture.inputApiForeign()), false, '不接纳不属于本会话的附件ID');
  await page.evaluate(() => window.fixture.inputApiAttachment());
  await probe.getByTestId('probe-attachments').filter({ hasText: /^valid$/ }).waitFor();
  await probe.getByRole('button', { name: '插件移除附件', exact: true }).click();
  await page.waitForFunction(() => window.fixture.inputApiAttachments().length === 0);
  assert.equal(await probe.getByTestId('probe-attachments').innerText(), '');
  await page.evaluate(() => window.fixture.select('two')); await input.fill('另一个会话');
  await page.evaluate(() => window.fixture.inputApiOld());
  assert.equal(await input.innerText(), '另一个会话', '旧插件回调不修改或提交新会话');
  await page.evaluate(() => window.fixture.select('one'));
  assert.equal(await input.innerText(), '用户输入 plugin');
  await page.evaluate(() => window.fixture.disableInputProbe());
  await probe.waitFor({ state: 'detached' });
  assert.equal(await input.innerText(), '用户输入 plugin', '插件卸载保留草稿');
  await input.fill('/file');
  const option = page.getByRole('listbox').getByRole('option').filter({ hasText: /文件|file/i });
  await option.waitFor();
  const [picker] = await Promise.all([page.waitForEvent('filechooser'), option.click()]);
  assert.equal(picker.isMultiple(), true);
  await picker.setFiles([]);
  assert.equal(await page.evaluate(() => window.fixture.inputDraft()), '', '候选动作只消费命令而不发送消息');
  await input.fill('/file');
  const [submittedPicker] = await Promise.all([
    page.waitForEvent('filechooser'), page.evaluate(() => window.fixture.inputApiSubmit()),
  ]);
  await submittedPicker.setFiles([]);
  await page.waitForFunction(() => window.fixture.inputDraft() === '');
  assert.equal((await input.innerText()).trim(), '', '标准 submit 仲裁仍可消费命令并打开选择器');
  await input.fill('');
  return { standardInputState: true, pluginDraftWrite: true, attachmentRegistryShared: true, foreignIdsRefused: true,
    staleSessionActionsIgnored: true, unloadKeepsDraft: true, originalFileAction: true, submittedFileAction: true };
}
