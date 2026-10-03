import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 复用已归档的电脑打开联调记录，不创建聊天或请求模型。
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
  await button('返回').click();
  await menu('查看已归档聊天');
  await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.chat);
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), seed.chat);
  await page.locator('[data-presented-file]').first().getByRole('button', { name: /^在侧边栏打开/ }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.locator('[data-textpreview-plain]').getByText(original.trim(), { exact: true }).waitFor();
  await panel.getByRole('button', { name: '在电脑文件夹中显示', exact: true }).click();
  const confirm = panel.getByRole('group', { name: '确认在电脑文件夹中显示', exact: true });
  await confirm.waitFor(); report.confirmation = await confirm.innerText();
  assert.ok(report.confirmation.includes(seed.path.split('/').at(-1)));
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await confirm.count(), 0); report.cancelled = true;
  await panel.getByRole('button', { name: '在电脑文件夹中显示', exact: true }).click();
  await confirm.getByRole('button', { name: '确认在电脑文件夹中显示', exact: true }).click();
  await panel.getByText('已请求电脑在文件夹中显示。', { exact: true }).waitFor();
  report.hostAccepted = true;
  await page.screenshot({ path: 'artifacts/reveal-android.png' });
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await button('返回').click();
  await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await menu('查看最近聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  assert.equal(await readFile(seed.path, 'utf8'), original);
  report.draftPreserved = true; report.fileUnchanged = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: 'artifacts/reveal-failure-android.png' }).catch(() => {}); }
finally { await writeFile('artifacts/reveal-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
