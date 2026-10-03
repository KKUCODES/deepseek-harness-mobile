import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅操作之前建立的两条 DSH-TEST 工作流验收会话；各阶段之间由调用方重启 App。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'verify', 'clean'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const oldMenu = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
  if (await oldMenu.count()) await oldMenu.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  if (await editor.count()) {
    const allowed = ['DSHM Remote 联调提示', ...await Promise.all(['parallel', 'failure'].map(async type => JSON.parse(await readFile(`artifacts/workflow-${type}-seed.json`, 'utf8')).chat))];
    assert.ok(allowed.includes(await workspace.locator('.remote-heading').innerText())); await button('返回').click();
  }
  await button('Remote 选项').click();
  if (await button('查看已归档聊天').count()) await button('查看已归档聊天').click();
  else await button('关闭窗口').click();
  let seed;
  if (phase === 'prepare') {
    const one = JSON.parse(await readFile('artifacts/workflow-parallel-seed.json', 'utf8'));
    const two = JSON.parse(await readFile('artifacts/workflow-failure-seed.json', 'utf8'));
    seed = { chats: [one.chat, two.chat], marker: `DSHM_DRAFT_SENT_${Date.now()}`, counts: [] };
    seed.drafts = ['  中文草稿\n换行与表情 🎈  ', `这是 DSHM 草稿恢复联调。不要调用工具，只回复 ${seed.marker}。`];
  } else seed = JSON.parse(await readFile('artifacts/remote-draft-seed.json', 'utf8'));
  for (const [index, chat] of seed.chats.entries()) {
    await button(new RegExp(`^${chat}`)).click();
    assert.equal(await workspace.locator('.remote-heading').innerText(), chat);
    await page.locator('[data-workflow-run]').waitFor();
    await editor.waitFor();
    if (phase === 'prepare') {
      seed.counts.push(await page.getByRole('article', { name: '模型回复' }).count());
      await editor.fill(seed.drafts[index]); assert.equal(await editor.inputValue(), seed.drafts[index]);
      await page.getByText('正在保存草稿…', { exact: true }).waitFor({ state: 'detached' });
    } else if (phase === 'verify') {
      assert.equal(await editor.inputValue(), seed.drafts[index]);
      assert.equal(await page.getByRole('article', { name: '模型回复' }).count(), seed.counts[index]);
      if (index === 0) { await editor.fill(''); await page.getByText('正在保存草稿…', { exact: true }).waitFor({ state: 'detached' }); }
      else {
        await button('发送消息').click();
        await page.waitForFunction(() => document.querySelector('textarea[aria-label="消息"]')?.value === '');
        await page.getByRole('article', { name: '模型回复' }).getByText(seed.marker, { exact: true }).waitFor({ timeout: 60000 });
        await button('停止生成').waitFor({ state: 'detached', timeout: 60000 }); report.sentAndCleared = true;
      }
    } else assert.equal(await editor.inputValue(), '');
    assert.equal(await page.getByText('草稿未能保存到手机，请勿关闭 App，检查存储后重试。', { exact: true }).count(), 0);
    await page.screenshot({ path: `artifacts/remote-draft-${phase}-${index}-android.png` });
    await button('返回').click();
  }
  if (phase === 'prepare') await writeFile('artifacts/remote-draft-seed.json', JSON.stringify(seed, null, 2));
  await menu('查看最近聊天'); await button(/^DSHM Remote 联调提示/).click(); report.returned = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/remote-draft-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
