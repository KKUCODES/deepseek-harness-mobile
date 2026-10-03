import assert from 'node:assert/strict';

export async function checkWorkspaceErrorLanguage(page) {
  const notification = '暂时无法打开提醒对应的聊天，请检查电脑连接后重试。';
  const draftError = '草稿未能保存到手机，请勿关闭 App，检查存储后重试。';
  const attachmentError = '附件草稿未能保存，请检查手机存储后重试；暂时不要关闭 App。';
  await page.evaluate(async () => { await window.fixture.select('one'); window.fixture.toolLocale('zh'); });
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('保留未发送内容');
  await page.evaluate(errors => window.fixture.workspaceErrors(errors), { error: notification, draftError, attachmentError });
  await page.getByRole('alert').filter({ hasText: notification }).waitFor();
  await page.evaluate(() => window.fixture.toolLocale('en'));
  await page.getByRole('alert').filter({ hasText: 'Could not open the chat for this notification. Check the computer connection and try again.' }).waitFor();
  await page.getByRole('alert').filter({ hasText: 'Could not save the draft on this phone. Keep the app open, check storage and try again.' }).waitFor();
  await page.getByRole('alert').filter({ hasText: 'Could not save attachment drafts. Keep the app open, check phone storage and try again.' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).innerText(), '保留未发送内容');
  await page.evaluate(() => window.fixture.workspaceErrors({ error: '外部插件原始错误：自定义协议失败', draftError: null, attachmentError: null }));
  await page.getByRole('alert').filter({ hasText: '外部插件原始错误：自定义协议失败' }).waitFor();
  await page.evaluate(errors => { window.fixture.workspaceErrors(errors); window.fixture.toolLocale('zh'); }, { error: notification, draftError, attachmentError });
  await page.getByRole('alert').filter({ hasText: notification }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), '保留未发送内容');
  return { notificationTranslated: true, draftErrorsTranslated: true, unknownErrorPreserved: true, languageSwitchPreservesDraft: true };
}
