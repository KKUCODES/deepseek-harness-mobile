import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 分阶段保存发送意图；观察失败后只观察现有请求，不能重发模型消息。
const phase = process.argv[2];
assert.ok(['source', 'source-observe', 'send', 'observe', 'cleanup'].includes(phase));
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const prefix = 'artifacts/reference-send', seedPath = `${prefix}-seed.json`;
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
let page;
const save = seed => writeFile(seedPath, JSON.stringify(seed, null, 2));
async function until(check, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    assert.ok(Date.now() < deadline, 'UI state did not settle');
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor();
  const heading = workspace.locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  const responses = page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复', exact: true });
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  let seed;
  if (phase === 'source') {
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    const run = `dshm-refsend-${Date.now()}`;
    seed = { run, sourceTitle: `DSHM 引用来源 ${Date.now()}`, draft: await editor.innerText(),
      root: resolve('../DSH-TEST', run), fileName: '中文 reference.txt',
      fileToken: `FILE_${randomBytes(12).toString('hex')}`, chatToken: `CHAT_${randomBytes(12).toString('hex')}` };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await mkdir(seed.root); await writeFile(resolve(seed.root, seed.fileName), seed.fileToken, { flag: 'wx' });
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.sourceTitle);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await until(async () => await heading.innerText() === seed.sourceTitle);
    await editor.fill(`这是专用引用来源测试。验收标记为 ${seed.chatToken}。请只原样回复该标记，不调用工具、不读取或修改文件。`);
    seed.sourceSendAttempted = true; await save(seed);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sourceSent = true; await save(seed); report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(dirname(seed.root), resolve('../DSH-TEST'));
    if (phase === 'source-observe') {
      assert.equal(seed.sourceSent, true); assert.equal(await heading.innerText(), seed.sourceTitle);
      await responses.last().filter({ hasText: seed.chatToken }).waitFor({ timeout: 45000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 45000 });
      report.reply = await responses.last().innerText(); assert.ok(report.reply.includes(seed.chatToken));
      seed.sourceVerified = true; await save(seed);
      await page.getByRole('button', { name: '返回', exact: true }).click();
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      assert.equal(await editor.innerText(), seed.draft); report.originalDraftPreserved = true;
    } else if (phase === 'send') {
      assert.equal(seed.sourceVerified, true); assert.equal(seed.targetSendAttempted, undefined);
      assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      assert.equal(await editor.innerText(), seed.draft);
      await editor.fill('这是 DSHM 引用实际发送验收。请用 read 工具仅读取下面引用的测试文件，并从下面引用的聊天快照中找到验收标记。最终只分两行原样返回：文件中的完整标记、引用聊天中的完整验收标记。不要读其他文件，不执行命令，不修改文件或设置。');
      const sheet = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
      const pick = async (query, label) => {
        await page.getByRole('button', { name: '添加附件', exact: true }).click();
        await page.getByRole('button', { name: '引用文件或聊天', exact: true }).click();
        await sheet.getByRole('searchbox', { name: '搜索文件或聊天', exact: true }).fill(query);
        await sheet.getByRole('button', { name: label, exact: true }).click();
      };
      await pick(`${seed.run}/`, `引用 ${seed.run}/${seed.fileName}`);
      await pick(seed.sourceTitle, `引用 ${seed.sourceTitle}`);
      seed.message = await editor.innerText();
      assert.ok(seed.message.includes(`@"${seed.run}/${seed.fileName}"`));
      assert.ok(seed.message.includes('dsh-session:'));
      assert.ok(!seed.message.includes(seed.fileToken) && !seed.message.includes(seed.chatToken));
      seed.targetSendAttempted = true; await save(seed);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.targetSent = true; await save(seed);
      await until(async () => await editor.innerText() === '');
      await editor.fill(seed.draft); report.sent = true;
    } else if (phase === 'observe') {
      assert.equal(seed.targetSent, true); assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      await responses.last().filter({ hasText: seed.fileToken }).waitFor({ timeout: 45000 });
      await responses.last().filter({ hasText: seed.chatToken }).waitFor({ timeout: 45000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 45000 });
      report.reply = await responses.last().innerText();
      assert.ok(report.reply.includes(seed.fileToken) && report.reply.includes(seed.chatToken));
      assert.equal(await editor.innerText(), seed.draft); report.draftPreserved = true;
      assert.equal(await readFile(resolve(seed.root, seed.fileName), 'utf8'), seed.fileToken);
      await page.screenshot({ path: `${prefix}-android.png` });
      seed.targetVerified = true; await save(seed); report.unpromptedTokensRead = true;
      await menu('会话权限');
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      report.permission = await permissions.getByText(/^当前权限：/).innerText();
      assert.equal(report.permission, '当前权限：仅可查看');
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } else {
      assert.ok(seed.targetVerified || (seed.sourceSent && !seed.targetSendAttempted), '仅清理已验收或尚未发送引用的来源测试');
      assert.equal(seed.cleaned, undefined);
      assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      if (await heading.innerText() !== seed.sourceTitle) {
        assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.getByRole('button', { name: new RegExp(`^${seed.sourceTitle}`) }).click();
      }
      assert.equal(await heading.innerText(), seed.sourceTitle);
      await menu('归档聊天');
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      assert.equal(await editor.innerText(), seed.draft);
      assert.equal(await readFile(resolve(seed.root, seed.fileName), 'utf8'), seed.fileToken);
      await unlink(resolve(seed.root, seed.fileName)); await rmdir(seed.root);
      seed.cleaned = true; await save(seed); report.sourceArchived = true; report.fileRemoved = true; report.draftPreserved = true;
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) await writeFile(`${prefix}-${phase}-failure-dom.txt`, (await page.locator('body').innerText()).slice(-24000)).catch(() => {});
} finally {
  await writeFile(`${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
