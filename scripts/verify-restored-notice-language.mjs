import assert from 'node:assert/strict';

/** 只切换手机语言并恢复；不修改提醒分类，不提交模型消息。 */
export async function verifyRestoredNoticeLanguage(device, key, context) {
  assert.match(key, /^[\w.|:-]+$/);
  const read = async () => (await device.shell(`cmd notification get '${key}'`)).toString();
  const pending = text => text.match(/contentIntent=PendingIntent\{[^:]+: (PendingIntentRecord\{.+)/)?.[1];
  const before = await read(); assert.match(before, /有问题等待你回答/); assert.ok(pending(before));
  await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  // 冷启动后的 Remote 已附加调试连接，沿用同一个上下文，避免再次附加等待。
  let phone;
  const openedBy = Date.now() + 15000;
  do {
    phone = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
    if (phone) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < openedBy);
  assert.ok(phone);
  phone.setDefaultTimeout(15000);
  console.log('restored-language: open settings');
  assert.equal(await phone.evaluate(() => document.documentElement.lang), 'zh-CN');
  await phone.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await phone.getByRole('button', { name: '设置', exact: true }).click();
  await phone.getByRole('button', { name: /^外观与语言/ }).click();
  async function change(language) {
    await phone.getByRole('button', { name: /^(语言|Language)/ }).click();
    await phone.getByRole('dialog').getByRole('button', { name: language === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
    await phone.getByRole('dialog').waitFor({ state: 'detached' });
    await phone.waitForFunction(value => document.documentElement.lang === value, language === 'en' ? 'en' : 'zh-CN');
  }
  const result = { translatedInPlace: false, pendingIntentPreserved: false, languageRestored: false };
  try {
    for (const language of ['en', 'zh']) {
      console.log(`restored-language: ${language}`);
      await change(language);
      const expected = language === 'en' ? 'A question needs your answer' : '有问题等待你回答';
      let text; const deadline = Date.now() + 7000;
      do { text = await read(); if (text.includes(expected)) break; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < deadline);
      assert.ok(text.includes(expected), `Restored notification must update to ${language}`);
      assert.equal(pending(text), pending(before));
      await device.shell('cmd statusbar expand-notifications');
      await device.shell('uiautomator dump /data/local/tmp/dshm-restored-language.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-restored-language.xml')).toString();
      assert.ok(xml.includes(`text="${expected}"`));
      await device.screenshot({ path: `artifacts/notification-restored-language-${language}.png` });
      await device.shell('cmd statusbar collapse');
    }
    result.translatedInPlace = true; result.pendingIntentPreserved = true;
    return result;
  } finally {
    await device.shell('cmd statusbar collapse');
    if (await phone.evaluate(() => document.documentElement.lang) !== 'zh-CN') await change('zh');
    result.languageRestored = true;
    await phone.getByRole('button', { name: '返回设置首页', exact: true }).click();
    await phone.getByRole('button', { name: '退出设置', exact: true }).click();
    await device.shell('rm -f /data/local/tmp/dshm-restored-language.xml');
  }
}
