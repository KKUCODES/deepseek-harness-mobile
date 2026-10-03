import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读已有专用会话，通过最终回复中的文件名进入 DSHM 预览。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, 'Set DSHM_ANDROID_SERIAL');
const report = { at: new Date().toISOString(), errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true }), draft = await editor.inputValue();
  if (process.argv.includes('--prepare')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const seed = { path: resolve('artifacts', `file-mention-${Date.now()}.txt`).replaceAll('\\', '/'), content: 'DSHM_FILE_MENTION_VERIFIED' };
    await writeFile('artifacts/file-mentions-live-seed.json', JSON.stringify(seed), { flag: 'wx' });
    const prompt = `这是 DSHM 文件引用验收。请只调用一次 write 工具，在 ${seed.path} 新建 UTF-8 文本，内容为 ${seed.content}。成功后只回复该文件的完整绝对路径，用一对反引号包裹作为行内代码，不使用 Markdown 链接。不操作其他文件，不执行命令。`;
    await editor.fill(prompt);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true;
    try {
      await page.locator('article.reply code button[title]').filter({ hasText: seed.path }).waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 15000 });
    } finally { await editor.fill(draft); }
  }
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  for (let i = 0; i < 15 && await older.count(); i++) {
    await older.click();
    await page.waitForFunction(() => !document.querySelector('[data-history-loader]')?.disabled);
  }
  assert.equal(await older.count(), 0);
  const mentions = page.locator('article.reply code button[title]');
  report.mentions = await mentions.evaluateAll(items => items.map(item => ({ path: item.title, label: item.getAttribute('aria-label') })));
  assert.ok(report.mentions.length > 0, '真实历史应包含已确认文件的正文引用');
  if (!process.argv.includes('--inspect')) {
    const seed = JSON.parse(await readFile('artifacts/file-mentions-live-seed.json', 'utf8'));
    const target = seed.path;
    assert.ok(target && report.mentions.some(item => item.path === target), '指定已观察到的真实引用路径');
    const button = mentions.filter({ hasText: target.split(/[\\/]/).at(-1) }).filter({ visible: true }).first();
    assert.equal(await button.getAttribute('title'), target);
    await button.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/file-mentions-link-android.png' });
    await button.click();
    const file = page.getByRole('dialog', { name: '文件预览', exact: true });
    await file.locator('pre').waitFor();
    report.preview = { path: target, textLength: (await file.locator('pre').innerText()).length };
    assert.ok(report.preview.textLength > 0);
    assert.equal((await file.locator('pre').innerText()).trim(), seed.content);
    assert.equal((await readFile(seed.path, 'utf8')).trim(), seed.content);
    await page.screenshot({ path: 'artifacts/file-mentions-preview-android.png' });
    await file.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  }
  assert.equal(await editor.inputValue(), draft); report.draftPreserved = true;
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  report.currentPermission = await permissions.getByText(/^当前权限：/).innerText();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(report.currentPermission, '当前权限：仅可查看');
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/file-mentions-${process.argv.includes('--inspect') ? 'inspect' : 'verify'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
