import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取已归档的真实交付记录；不请求模型、不改变文件或归档状态。
const seed = JSON.parse(await readFile('artifacts/desktop-open-seed.json', 'utf8'));
const original = await readFile(seed.path, 'utf8');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], file: seed.path };
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  await button('返回').click(); await menu('查看已归档聊天');
  await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.chat);
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  const card = page.locator('[data-presented-file]').filter({ hasText: seed.path.split('/').at(-1) }).first();
  await card.waitFor(); assert.equal(await page.getByRole('button', { name: /^查看交付文件：/ }).count(), 0);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/deliverables-android.png' });
  report.originalCard = await card.innerText();
  await card.getByRole('button', { name: /^在侧边栏打开/ }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.locator('[data-textpreview-plain]').getByText(original.trim(), { exact: true }).waitFor();
  assert.equal(await panel.getByRole('button', { name: '在电脑文件夹中显示', exact: true }).count(), 1);
  report.originalPreview = true;
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  for (const [action, confirmation] of [['用默认应用打开', '确认在电脑打开'], ['在文件资源管理器中显示', '确认在电脑文件夹中显示']]) {
    await card.getByRole('button', { name: /的更多文件操作$/ }).click();
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    const group = page.getByRole('group', { name: confirmation, exact: true });
    await group.waitFor(); assert.ok((await group.innerText()).includes(seed.path.split('/').at(-1)));
    await group.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(await group.count(), 0);
  }
  report.desktopActionsCancelled = true;
  const collapsed = page.locator('[data-turn-process][aria-expanded="false"]');
  report.collapsedProcesses = await collapsed.count();
  // 仅展开阅读既有过程，不发送命令或创建交付记录。
  while (await collapsed.count()) await collapsed.first().click();
  const present = page.locator('[data-tool="present"]');
  report.originalPresentRows = await present.count();
  assert.ok(report.originalPresentRows > 0);
  await present.first().waitFor({ state: 'visible' });
  await present.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/deliverables-tool-android.png' });
  const expanded = page.locator('[data-turn-process][aria-expanded="true"]');
  for (let i = 0; i < report.collapsedProcesses; i++) await expanded.first().click();
  await button('返回').click();
  await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await menu('查看最近聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  assert.equal(await readFile(seed.path, 'utf8'), original);
  report.draftPreserved = true; report.fileUnchanged = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: 'artifacts/deliverables-failure-android.png' }).catch(() => {}); }
finally { await writeFile('artifacts/deliverables-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
