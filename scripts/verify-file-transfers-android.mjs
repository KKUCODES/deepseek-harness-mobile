import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from './android-picker-test.mjs';

// 从已有会话读取两种来源，保存到系统选择的位置；只清理本次新建且摘要匹配的验收副本。
const seed = JSON.parse(await readFile('artifacts/desktop-open-seed.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], sources: [] };
const prefix = process.argv.includes('--documents') ? 'attachment-document-transfers' : 'file-transfers';
let page;
const savedPaths = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0').filter(Boolean);
async function checkTransfer(container, source, path) {
  const expected = await readFile(path), name = path.split('/').at(-1), before = new Set(await savedPaths());
  await container.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await container.getByText('请选择保存位置…', { exact: true }).waitFor();
  let nodes = await pickerNodes(device);
  assert.ok(nodes.some(node => node.class === 'android.widget.EditText' && node.text.startsWith(name.split('.')[0])));
  await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
  await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
  await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
  nodes = await pickerNodes(device);
  if (nodes.some(node => node.text === '替换')) {
    await device.shell('input keyevent 4'); await device.shell('input keyevent 4');
    throw new Error('Refusing to replace an existing download');
  }
  await container.getByText('已保存到所选位置。', { exact: true }).waitFor();
  const added = (await savedPaths()).filter(value => !before.has(value));
  assert.equal(added.length, 1);
  const target = added[0]; assert.match(target, /^\/sdcard\/Download\/dshm-[\w.() -]+$/);
  const digest = createHash('sha256').update(expected).digest('hex');
  assert.equal((await device.shell(`sha256sum '${target}'`)).toString().split(/\s/)[0], digest);
  await container.getByRole('button', { name: '分享完整文件', exact: true }).click();
  let xml;
  for (let attempt = 0; attempt < 8; attempt++) {
    await device.shell('uiautomator dump /data/local/tmp/dshm-file-transfers.xml');
    xml = (await device.shell('cat /data/local/tmp/dshm-file-transfers.xml')).toString();
    if (xml.includes('resource-id="android:id/chooser_header"')) break;
  }
  assert.ok(xml.includes('resource-id="android:id/chooser_header"'));
  await device.screenshot({ path: `artifacts/${prefix}-${source}-android.png` });
  await device.shell('input keyevent 4');
  await container.getByText('已打开系统分享面板。', { exact: true }).waitFor();
  // 再次核对本次生成的副本后删除，不删除上传源或用户原有下载。
  assert.equal((await device.shell(`sha256sum '${target}'`)).toString().split(/\s/)[0], digest);
  await device.shell(`rm '${target}'`);
  assert.equal((await savedPaths()).includes(target), false);
  report.sources.push({ source, savedName: target.split('/').at(-1), bytes: expected.length, sha256: digest,
    systemSave: true, actualShareSheet: true, noRecipientSelected: true, testCopyRemoved: true });
}
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(25000); page.on('pageerror', error => report.errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  const existingPanel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await existingPanel.count()) await existingPanel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const attachment = 'dshm-shared-upload-20260924.txt';
  const card = button(`查看附件 ${attachment}`).first();
  await page.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
  for (let i = 0; i < 12 && !await card.count(); i++) {
    const older = button('加载更早的消息');
    if (!await older.count()) break;
    const count = await page.locator('.conversation article').count();
    await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
  }
  await card.click();
  const preview = page.getByRole('region', { name: '插件面板', exact: true });
  const expected = await readFile(`artifacts/${attachment}`, 'utf8');
  const plain = preview.locator('.remote-document-tab:not([hidden]) [data-textpreview-plain]');
  await plain.waitFor(); assert.equal(await plain.textContent(), expected);
  await checkTransfer(preview, 'attachment', `artifacts/${attachment}`);
  await preview.getByRole('button', { name: '返回聊天', exact: true }).click();
  await button('返回').click(); await menu('查看已归档聊天');
  await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.chat);
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  await page.locator('[data-presented-file]').first().getByRole('button', { name: /^在侧边栏打开/ }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.locator('[data-textpreview-plain]').waitFor();
  await checkTransfer(panel, 'workspace', seed.path);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await button('返回').click(); await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await menu('查看最近聊天'); await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: 'artifacts/file-transfers-failure-android.png' }).catch(() => {}); }
finally { await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
