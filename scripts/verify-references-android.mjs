import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

async function until(check) {
  const deadline = Date.now() + 20000;
  while (!await check()) {
    assert.ok(Date.now() < deadline, 'UI state did not settle');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 只检索与插入专用会话草稿，不发送模型消息；最终恢复草稿并删除独占创建的文件。
const run = `dshm-reference-${Date.now()}`, root = resolve('../DSH-TEST', run);
const fileName = '引用 file.txt', contents = 'DSHM_REFERENCE_PICKER_VALIDATION';
await mkdir(root); await writeFile(resolve(root, fileName), contents, { flag: 'wx' });
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [], run };
let page, draft, editor;
const text = () => editor.evaluate(element => element instanceof HTMLTextAreaElement ? element.value : element.innerText);
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) {
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  draft = await text();
  await writeFile('artifacts/reference-draft-before.json', JSON.stringify({ draft, run }, null, 2));
  const open = async () => {
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '引用文件或聊天', exact: true }).click();
  };
  await open();
  const sheet = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
  const query = sheet.getByRole('searchbox', { name: '搜索文件或聊天', exact: true });
  // 外部测试进程新建文件不会触发 DSH 的索引失效事件；显式目录查询读取实时目录。
  await query.fill(`./${run}`);
  await sheet.getByRole('button', { name: `打开目录 ./${run}`, exact: true }).click();
  const pick = sheet.getByRole('button', { name: `引用 ./${run}/${fileName}`, exact: true });
  await pick.waitFor();
  await page.screenshot({ path: 'artifacts/references-files-android.png' });
  await pick.click();
  const fileDraft = `${draft}${draft && !/\s$/u.test(draft) ? ' ' : ''}@"./${run}/${fileName}" `;
  await until(async () => await text() === fileDraft); report.fileInserted = true; report.directoryDrilled = true;
  await open();
  await query.fill('DSH Mobile 联调测试');
  const chat = sheet.getByRole('button', { name: '引用 DSH Mobile 联调测试', exact: true });
  await chat.waitFor();
  await page.screenshot({ path: 'artifacts/references-chat-android.png' });
  await chat.click();
  await until(async () => await text() !== fileDraft);
  assert.ok((await text()).startsWith(fileDraft));
  report.chatInserted = true;
  await open(); await query.fill(`no-result-${run}`);
  await until(async () => await sheet.getByText('没有找到匹配的内容', { exact: true }).count() === 2);
  report.emptyGroups = true;
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (process.argv.includes('--editor')) {
    await editor.fill(`@./${run}`);
    const suggestions = page.getByRole('listbox', { name: '触发候选建议', exact: true });
    await suggestions.getByRole('option').filter({ hasText: run }).getByRole('button', { name: '进入目录', exact: true }).click();
    await suggestions.getByRole('option').filter({ hasText: fileName }).waitFor();
    report.automaticDirectoryDrilled = true;
    await page.screenshot({ path: 'artifacts/editor-candidates-android.png' });
    await suggestions.getByRole('option').filter({ hasText: fileName }).click();
    await until(async () => await editor.locator('[data-composer-chip]').count() > 0);
    report.automaticFilePicked = true;
    await page.screenshot({ path: 'artifacts/editor-chip-android.png' });
    await editor.fill('@联调测试');
    await suggestions.getByRole('option').filter({ hasText: 'DSH Mobile 联调测试' }).click();
    await until(async () => await editor.locator('[data-composer-chip]').count() > 0);
    report.automaticChatPicked = true;
    await page.screenshot({ path: 'artifacts/editor-chat-chip-android.png' });
    // 回到列表再打开同一个专用会话，覆盖旧 binding 先释放、输入框后卸载的实际顺序。
    await editor.fill(draft);
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await until(async () => await text() === draft);
    report.sessionReopened = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
  if (page) {
    await page.screenshot({ path: 'artifacts/references-failure-android.png' }).catch(() => {});
    await writeFile('artifacts/references-failure-dom.txt', await page.locator('body').innerText()).catch(() => {});
  }
  throw error;
} finally {
  if (page && draft !== undefined) {
    const sheet = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
    if (await sheet.isVisible()) await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await editor.fill(draft); await until(async () => await text() === draft);
    await until(async () => await page.getByText('正在保存草稿…', { exact: true }).count() === 0);
    report.draftRestored = true;
  }
  assert.equal(await readFile(resolve(root, fileName), 'utf8'), contents);
  await unlink(resolve(root, fileName)); await rmdir(root); report.filesCleaned = true;
  await writeFile('artifacts/references-android.json', JSON.stringify(report, null, 2));
  await device.close();
  console.log(JSON.stringify(report));
}
