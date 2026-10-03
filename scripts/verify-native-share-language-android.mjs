import assert from 'node:assert/strict';

// 只读取专用会话已有 PDF；打开系统面板后取消，不选择接收者或写入电脑文件。
export async function verifyNativeShareLanguage(page, device, changeLanguage, checks) {
  const link = page.getByRole('article', { name: 'Assistant response', exact: true })
    .getByRole('button', { name: 'PDF 验证文件', exact: true }).last();
  for (let count = 0; !await link.count() && count < 50; count++) {
    const older = page.getByRole('button', { name: 'Load earlier messages', exact: true });
    if (!await older.count()) break;
    await older.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Load earlier messages' && button.disabled));
  }
  await link.click();
  let dialog = page.getByRole('dialog', { name: 'File preview', exact: true });
  await dialog.getByRole('img', { name: 'PDF page 1', exact: true }).waitFor();
  const origin = await page.evaluate(() => performance.timeOrigin);
  for (const language of ['en', 'zh']) {
    if (language === 'zh') await changeLanguage('zh');
    dialog = page.getByRole('dialog', { name: language === 'en' ? 'File preview' : '文件预览', exact: true });
    const title = language === 'en' ? 'Share complete file' : '分享完整文件';
    await dialog.getByRole('button', { name: title, exact: true }).click();
    let xml = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      await device.shell('uiautomator dump /data/local/tmp/dshm-share-language.xml');
      xml = (await device.shell('cat /data/local/tmp/dshm-share-language.xml')).toString();
      if (xml.includes('resource-id="android:id/chooser_header"') && /package="(?:android|com.android.intentresolver)"/.test(xml)) break;
    }
    assert.ok(/package="(?:android|com.android.intentresolver)"/.test(xml), 'Native sharesheet must be foreground, not the matching web button');
    assert.ok(xml.includes('resource-id="android:id/chooser_header"'), 'Actual Android chooser structure');
    // Android 的 ACTION_SEND 不显示 createChooser 的 title；系统文案随系统语言。
    assert.ok(xml.includes('text="DSHM 分享验收"'), 'File share has actual receivers');
    await device.screenshot({ path: `artifacts/share-language-${language}.png` });
    await device.shell('input keyevent 4');
    await dialog.getByRole('status').filter({ hasText: language === 'en' ? 'System share sheet opened.' : '已打开系统分享面板。' }).waitFor();
    assert.equal(await dialog.getByText(/^(已发送|已分享)$/).count(), 0);
    assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
    checks.push({ language, appButton: title, customTitleDisplayed: xml.includes(`text="${title}"`), systemChooser: true, canceledWithoutRecipient: true, samePage: true });
  }
  await dialog.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  await changeLanguage('en');
}
