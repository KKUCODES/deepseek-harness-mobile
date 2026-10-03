import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { testedAt: new Date().toISOString(), stages: [] };
const save = () => writeFile('artifacts/ordinary-replies-android.json', JSON.stringify(report, null, 2));
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const button = name => page.getByRole('button', { name, exact: true });
  const editor = () => page.getByRole('textbox', { name: '消息', exact: true });
  const rows = () => page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
    try { return await new Promise(resolve => { const r = db.transaction('chats').objectStore('chats').getAll(); r.onsuccess = () => resolve(r.result); }); } finally { db.close(); }
  });
  async function until(read, predicate) { for (let i = 0; i < 480; i++) { const value = await read(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 250)); } throw new Error('Condition timed out'); }
  const prior = await rows();
  let marker = `DSHM_REPLIES_${Date.now()}`;
  let original;
  if (await button('关闭窗口').count()) await button('关闭窗口').click();
  if (process.env.DSHM_REPLY_RESUME === '1') {
    original = prior.filter(row => row.turns[0]?.prompt.startsWith('DSHM_REPLIES_') && row.turns[0].status === 'completed').sort((a, b) => b.updatedAt - a.updatedAt)[0];
    assert.ok(original); marker = original.turns[0].prompt.split('。')[0];
    await button('打开侧边抽屉').click();
    await page.locator('.history-row').filter({ hasText: original.title }).first().click();
  } else {
  await button('新聊天').click();
  await editor().fill(`${marker}。请严格输出以下 Markdown，无其他内容：二级标题「排版测试」，然后 JavaScript 代码块内容 console.log("DSHM_CODE_OK");，最后单独一行 LaTeX 块公式 $$E=mc^2$$。`);
  await page.getByRole('button', { name: /^选择模型，当前/ }).click();
  await page.getByRole('button', { name: /^DeepSeek Pro/ }).click();
  await editor().click(); await page.getByRole('button', { name: /^选择模型，当前/ }).click();
  await button('回复设置').click();
  await page.getByLabel('输出上限（Token）', { exact: true }).fill('512');
  await page.getByLabel('回答随机性', { exact: true }).fill('0.2');
  await button('保存').click();
  await button('发送消息').click();
  const source = await until(rows, list => list.some(row => row.turns[0]?.prompt.startsWith(marker) && row.turns[0].status === 'completed'));
  original = source.find(row => row.turns[0]?.prompt.startsWith(marker));
  }
  assert.equal(original.turns[0].model, 'deepseek-v4-pro');
  assert.equal(original.turns[0].requestOptions.maxTokens, 512);
  await page.locator('.reply h2').waitFor(); await page.locator('.reply .katex').first().waitFor();
  await button('复制代码').click(); await button('已复制').waitFor();
  await button('复制回复').click(); await page.locator('.toast').filter({ hasText: '已复制' }).waitFor();
  report.stages.push({ name: 'realProOptionsMarkdownMathCopy', model: original.turns[0].model, requestOptions: original.turns[0].requestOptions, passed: true }); await save();
  await button('分享').click();
  await until(async () => (await device.shell('dumpsys activity activities')).toString(), value => /(?:topResumedActivity=|ResumedActivity:)[^\n]*ChooserActivity/.test(value));
  // 只收起本应用上方的系统分享页，避免全局 Back 误操作另一前台应用。
  await device.shell('am start --activity-clear-top --activity-single-top -n dev.dshmobile.validation/.ValidationActivity');
  report.stages.push({ name: 'nativeShareSheet', openedWithoutSending: true });
  await button('重新生成').click();
  const regenerated = (await until(rows, list => list.some(row => row.id !== original.id && row.turns[0]?.prompt.startsWith(marker) && row.turns[0].status === 'completed'))).find(row => row.id !== original.id && row.turns[0]?.prompt.startsWith(marker));
  assert.deepEqual((await rows()).find(row => row.id === original.id), original);
  assert.equal(regenerated.requestOptions.maxTokens, 512);
  await button('编辑').click();
  await page.getByRole('textbox', { name: '编辑消息', exact: true }).fill(`${marker}_EDIT 请只回复 EDIT_OK`);
  await button('发送').click();
  const edited = (await until(rows, list => list.some(row => row.turns[0]?.prompt.startsWith(`${marker}_EDIT`) && row.turns[0].status === 'completed'))).find(row => row.turns[0]?.prompt.startsWith(`${marker}_EDIT`));
  assert.equal(edited.turns[0].content.trim(), 'EDIT_OK');
  assert.deepEqual((await rows()).find(row => row.id === regenerated.id), regenerated);
  await button('从此继续新聊天').click();
  await editor().fill('DSHM_BRANCH_DRAFT');
  const branch = (await until(rows, list => list.some(row => row.draft === 'DSHM_BRANCH_DRAFT'))).find(row => row.draft === 'DSHM_BRANCH_DRAFT');
  assert.notEqual(branch.id, edited.id); assert.deepEqual(branch.turns, edited.turns);
  await button('聊天选项').click(); await button('重命名').click();
  await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(`${marker}_RENAMED`); await button('保存').click();
  await until(rows, list => list.find(row => row.id === branch.id)?.title === `${marker}_RENAMED`);
  await button('聊天选项').click(); await button('删除聊天').click(); await button('确认删除').click();
  await until(rows, list => !list.some(row => row.id === branch.id));
  const after = await rows(); for (const row of prior) assert.deepEqual(after.find(value => value.id === row.id), row);
  assert.deepEqual(after.find(row => row.id === edited.id), edited);
  report.stages.push({ name: 'regenerateEditBranchRenameDelete', originalIds: [original.id, regenerated.id, edited.id], preservedPrior: prior.length, onlyOwnNewBranchDeleted: true });
  await page.screenshot({ path: 'artifacts/ordinary-replies-android.png' });
  report.passed = true; await save(); console.log(JSON.stringify(report));
} catch (error) { report.passed = false; report.error = error.message; await save(); throw error; }
finally { await device.close(); }
