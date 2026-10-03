import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只操作已上传的专用联调附件；不新建会话、上传或发送模型消息。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
assert.match(process.env.DSHM_HOST_PID ?? '', /^[1-9][0-9]*$/);
const extension = process.env.DSHM_OFFICE_EXTENSION ?? 'docx';
assert.ok(['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'].includes(extension));
const attachmentLabel = new RegExp(`^查看附件 dshm-office-attachment-\\d+\\.${extension}$`);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), hostPid: process.env.DSHM_HOST_PID, extension, errors: [] };
const root = join(tmpdir(), 'dshm-attachment-copies-v1', process.env.DSHM_HOST_PID);
const copies = async () => {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    if (!entry.isDirectory() || !/^copy-[0-7]$/.test(entry.name)) continue;
    for (const name of await readdir(join(root, entry.name))) paths.push(join(root, entry.name, name));
  }
  return paths;
};
let page, preview;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  await history.getByRole('article', { name: '模型回复' }).first().waitFor();
  const card = history.getByRole('button', { name: attachmentLabel }).last();
  for (let i = 0; i < 20 && !await card.count(); i++) {
    const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
    if (!await older.count()) break;
    await older.click();
    await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find(node => node.textContent === '加载更早的消息'); return !button || !button.disabled; });
  }
  const label = await card.getAttribute('aria-label');
  assert.match(label, attachmentLabel);
  const name = label.slice('查看附件 '.length), expected = await readFile(join('artifacts', name));
  await card.click(); preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  const before = await copies();
  await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
  const group = preview.getByRole('group', { name: '确认在电脑打开', exact: true });
  await group.waitFor(); assert.match(await group.innerText(), /附件副本，不会修改聊天原件/);
  await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
  await preview.locator('.remote-desktop-open button').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('.remote-desktop-open button')?.disabled);
  report.notice = await preview.locator('.remote-desktop-open [role="status"]').innerText();
  const added = (await copies()).filter(path => !before.includes(path));
  assert.equal(added.length, 1); assert.deepEqual(await readFile(added[0]), expected);
  report.copy = { path: added[0], bytes: expected.length, sha256: createHash('sha256').update(expected).digest('hex') };
  // 协议成功仅证明系统接受请求；默认办公软件窗口另行取证。
  report.requestAccepted = report.notice === '已请求电脑打开文件。';
  await page.screenshot({ path: `artifacts/office-desktop-${extension}-android.png` });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
  report.returned = true; assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
} finally {
  await writeFile(`artifacts/office-desktop-${extension}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
