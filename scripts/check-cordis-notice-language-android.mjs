import assert from 'node:assert/strict';

/** 经正式普通设置切语言；不修改网页存储或替换待审批状态。 */
export async function checkCordisNoticeLanguage(remote, device) {
  const phone = remote.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone);
  const original = await phone.evaluate(() => document.documentElement.lang);
  const origin = await remote.evaluate(() => performance.timeOrigin);
  const editor = remote.getByRole('textbox', { name: /^(消息|Message)$/ });
  const draft = await editor.textContent();
  const change = async language => {
    await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
    const drawer = phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ });
    if (await drawer.count()) {
      await drawer.click();
      await phone.getByRole('button', { name: /^(设置|Settings)$/ }).click();
    }
    const appearance = phone.getByRole('button', { name: /^(外观与语言|Appearance and language)/ });
    if (await appearance.count()) await appearance.click();
    await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
    await phone.getByRole('dialog').getByRole('button', { name: language === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
    await phone.getByRole('dialog').waitFor({ state: 'detached' });
    await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
    await phone.getByRole('button', { name: /^(电脑连接|Computer connection)$/ }).click();
    await remote.waitForFunction(value => document.documentElement.lang === value, language === 'en' ? 'en' : 'zh-CN');
  };
  try {
    await change('en');
    const notice = remote.locator('.remote-cordis-notice');
    await notice.getByText('A plugin is waiting for your approval · 1', { exact: true }).waitFor();
    await notice.getByRole('button', { name: 'View request', exact: true }).waitFor();
    assert.equal(await remote.evaluate(() => performance.timeOrigin), origin);
    assert.equal(await editor.textContent(), draft);
    await remote.screenshot({ path: 'artifacts/cordis-notice-language-en-android.png' });
    return { englishNotice: true, englishAction: true, samePage: true, draftPreserved: true };
  } finally {
    await change(original === 'en' ? 'en' : 'zh');
    assert.equal(await remote.evaluate(() => document.documentElement.lang), original);
    // 收起普通设置，下一次正常打开应用仍回到聊天首页。
    await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
    await phone.getByRole('button', { name: /^(退出设置|Close settings)$/ }).click();
    await phone.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).click();
    await phone.getByRole('button', { name: 'Remote', exact: true }).click();
  }
}
