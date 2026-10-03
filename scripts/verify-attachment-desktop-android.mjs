import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
assert.match(process.env.DSHM_HOST_PID ?? '', /^[1-9][0-9]*$/);
const copiesRoot = join(tmpdir(), 'dshm-attachment-copies-v1', process.env.DSHM_HOST_PID);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), hostPid: process.env.DSHM_HOST_PID, errors: [] };
let page;
const copies = async () => {
  const result = [];
  for (const entry of await readdir(copiesRoot, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (!entry.isDirectory() || !/^copy-[0-7]$/.test(entry.name)) continue;
    for (const file of await readdir(join(copiesRoot, entry.name))) result.push(join(copiesRoot, entry.name, file));
  }
  return result;
};
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const testChat = page.getByRole('button', { name: /^DSHM Remote 联调提示/ });
  if (await testChat.count()) await testChat.click();
  assert.equal(await workspace.locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  await history.getByRole('article', { name: '模型回复' }).first().waitFor();
  const filename = 'dshm-shared-upload-20260924.txt', expected = await readFile(join('artifacts', filename));
  const card = history.getByRole('button', { name: `查看附件 ${filename}`, exact: true }).first();
  for (let i = 0; i < 20 && !await card.count(); i++) {
    const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
    if (!await older.count()) break;
    await older.click();
    await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find(node => node.textContent === '加载更早的消息'); return !button || !button.disabled; });
  }
  await card.click();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  await preview.locator('pre').waitFor(); assert.equal(await preview.locator('pre').textContent(), expected.toString('utf8'));
  const review = async () => {
    await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
    const group = preview.getByRole('group', { name: '确认在电脑打开', exact: true }); await group.waitFor();
    assert.match(await group.innerText(), /附件副本，不会修改聊天原件/); return group;
  };
  let before = await copies(), group = await review();
  await group.getByRole('button', { name: '取消', exact: true }).click();
  await group.waitFor({ state: 'detached' }); assert.deepEqual(await copies(), before); report.cancelNoCopy = true;
  group = await review(); await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
  await preview.getByText('已请求电脑打开文件。', { exact: true }).waitFor();
  let added = (await copies()).filter(path => !before.includes(path)); assert.equal(added.length, 1);
  assert.equal(added[0].split(/[\\/]/).at(-1), filename); assert.deepEqual(await readFile(added[0]), expected);
  report.text = { path: added[0], bytes: expected.length, sha256: createHash('sha256').update(expected).digest('hex') };
  // 只修改本次打开的独立副本，重新读取历史仍应保持原件。
  const original = await readFile(added[0]);
  try {
    await writeFile(added[0], 'DSHM_COPY_ONLY_EDIT\n');
    await preview.getByRole('button', { name: '重新读取', exact: true }).click();
    await preview.locator('pre').waitFor(); assert.equal(await preview.locator('pre').textContent(), expected.toString('utf8'));
    report.originalUnchanged = true;
  } finally { await writeFile(added[0], original); }
  await page.screenshot({ path: 'artifacts/attachment-desktop-text-android.png' });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  const imageCard = history.getByRole('button', { name: '查看附件 dshm-image-input.png', exact: true }).first();
  await imageCard.click(); await preview.locator('img').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('.remote-file-preview img'); return image?.complete && image.naturalWidth > 0; });
  before = await copies(); group = await review(); await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
  await preview.getByText('已请求电脑打开文件。', { exact: true }).waitFor();
  added = (await copies()).filter(path => !before.includes(path)); assert.equal(added.length, 1);
  const image = await readFile(added[0]); assert.equal(image.subarray(1, 4).toString(), 'PNG');
  // 与先前上传的已知测试图片原件核对，不通过页面 fetch 绕过 Blob 的 CSP。
  assert.deepEqual(image, await readFile('artifacts/dshm-image-input.png'));
  report.image = { path: added[0], bytes: image.length, sha256: createHash('sha256').update(image).digest('hex') };
  await page.screenshot({ path: 'artifacts/attachment-desktop-image-android.png' });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  const office = history.getByRole('button', { name: /^查看附件 dshm-office-attachment-\d+\.docx$/ }).last();
  await office.click(); before = await copies(); group = await review();
  assert.match(await group.innerText(), /\.docx/); await group.getByRole('button', { name: '取消', exact: true }).click();
  await group.waitFor({ state: 'detached' }); assert.deepEqual(await copies(), before); report.officePrepareCancel = true;
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
  report.returned = true; assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-2400); await page.screenshot({ path: 'artifacts/attachment-desktop-failed.png' }).catch(() => {}); }
} finally {
  await writeFile('artifacts/attachment-desktop-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
