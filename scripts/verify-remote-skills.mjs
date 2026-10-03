import assert from 'node:assert/strict';

/** 正式 Android 页面读取电脑真实目录；测试技能由专用工作区临时提供。 */
export async function verifyRemoteSkills(page, history) {
  const name = process.env.DSHM_SKILL_NAME;
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const original = await input.inputValue();
  const sheet = page.getByRole('dialog', { name: '选择技能', exact: true });
  const open = async () => {
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择技能', exact: true }).click();
    await sheet.getByRole('button', { name: '重新读取技能', exact: true }).waitFor();
    assert.equal(await sheet.getByRole('alert').count(), 0);
  };
  await open();
  const catalog = await sheet.locator('.remote-skill-pick').allTextContents();
  assert.ok(catalog.length, '真实电脑目录应非空');
  if (process.env.DSHM_SKILL_ABSENT) assert.equal(await sheet.getByRole('button', { name: `使用技能 ${process.env.DSHM_SKILL_ABSENT}`, exact: true }).count(), 0);
  const layout = await sheet.locator('.remote-skill-pick').evaluateAll(buttons => buttons.map(button => {
    const bounds = button.getBoundingClientRect();
    return { name: button.getAttribute('aria-label'), height: bounds.height,
      contained: [...button.children].every(child => { const box = child.getBoundingClientRect(); return box.top >= bounds.top && box.bottom <= bounds.bottom + 1; }) };
  }));
  assert.ok(layout.every(item => item.contained), '技能说明不能溢出按钮或覆盖下一项');
  const searchHeight = await sheet.getByRole('searchbox', { name: '搜索技能', exact: true }).evaluate(element => element.getBoundingClientRect().height);
  assert.ok(searchHeight >= 40 && searchHeight <= 50);
  await page.screenshot({ path: 'artifacts/remote-skills-android.png' });
  if (!name) {
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await input.inputValue(), original);
    return { catalog, layout, searchHeight, draftPreserved: true, sent: false };
  }
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  assert.equal(original, '', '不可覆盖现有草稿');
  await sheet.getByRole('searchbox', { name: '搜索技能', exact: true }).fill(name);
  const pick = sheet.getByRole('button', { name: `使用技能 ${name}`, exact: true });
  await pick.waitFor();
  await sheet.getByRole('button', { name: `查看技能 ${name}`, exact: true }).click();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  await preview.getByText('DSHM_SKILL_BODY_20260924_7E42', { exact: false }).waitFor();
  await page.screenshot({ path: 'artifacts/remote-skill-source-android.png' });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  const draft = '按此技能的正文要求回复，不调用其他工具。';
  await input.fill(draft);
  await open();
  await sheet.getByRole('searchbox', { name: '搜索技能', exact: true }).fill(name);
  await pick.click();
  await sheet.waitFor({ state: 'detached' });
  assert.equal(await input.inputValue(), `/${name} ${draft}`);
  const responses = history.getByRole('article', { name: '模型回复' });
  const before = await responses.count();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('textarea[aria-label="消息"]')?.value);
  const response = responses.nth(before);
  await response.getByText('DSHM_SKILL_BODY_20260924_7E42', { exact: true }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor({ timeout: 90000 });
  const reply = await response.innerText();
  await page.screenshot({ path: 'artifacts/remote-skill-reply-android.png' });
  return { catalog, layout, searchHeight, name, sourcePreview: true, draftPreserved: true, sent: true, reply };
}
