import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); const prepare = process.argv.includes('--prepare');
const report = { at: new Date().toISOString(), prepare, errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const draft = await editor.inputValue();
  let seed;
  if (prepare) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Live model request needs explicit opt-in');
    const prefix = resolve('artifacts', `file-line-${Date.now()}`).replaceAll('\\', '/');
    seed = { text: `${prefix}.txt`, markdown: `${prefix}.md`, line: 120, target: 'DSHM_FILE_LINE_TARGET_120' };
    seed.content = Array.from({ length: 180 }, (_, i) => i === 119 ? seed.target : `第 ${i + 1} 行：文件定位验收。`).join('\r\n');
    // 先记下本次发送身份；结果未知后只能运行读取阶段，不能自动重复发送。
    await writeFile('artifacts/file-line-live-seed.json', JSON.stringify(seed), { flag: 'wx' });
    await writeFile(seed.text, seed.content); await writeFile(seed.markdown, seed.content);
    const prompt = `这是 DSHM 文件定位验收。不要调用工具，不要读写文件。请只原样回复以下两个 Markdown 链接，不使用代码块：\n[DSHM 文本第120行](${seed.text}#L120)\n[DSHM Markdown第120行](${seed.markdown}#L120)`;
    await editor.fill(prompt);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true;
    try {
      await history.getByRole('button', { name: 'DSHM Markdown第120行', exact: true }).waitFor({ timeout: 120000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 120000 });
    } finally { await editor.fill(draft); }
  } else seed = JSON.parse(await readFile('artifacts/file-line-live-seed.json', 'utf8'));
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  report.entries = [];
  for (const label of ['DSHM 文本第120行', 'DSHM Markdown第120行']) {
    await history.getByRole('button', { name: label, exact: true }).last().click();
    const target = preview.locator('[data-file-line="120"]');
    await target.waitFor(); assert.equal(await target.textContent(), seed.target);
    assert.equal(await preview.locator('pre').textContent(), seed.content);
    const geometry = await target.evaluate(row => {
      const body = row.closest('.remote-file-preview-body'), b = body.getBoundingClientRect(), r = row.getBoundingClientRect();
      return { scrollTop: body.scrollTop, visible: r.top >= b.top && r.bottom <= b.bottom };
    });
    assert.equal(geometry.visible, true); assert.ok(geometry.scrollTop > 0);
    if (label.includes('Markdown')) {
      await preview.getByRole('button', { name: '阅读', exact: true }).click();
      assert.equal(await target.count(), 0);
      await preview.getByRole('button', { name: '源码', exact: true }).click(); await target.waitFor();
    }
    await page.screenshot({ path: `artifacts/file-line-${label.includes('Markdown') ? 'markdown' : 'text'}-android.png` });
    report.entries.push({ label, ...geometry, originalBytesInSource: true });
    if (!label.includes('Markdown')) {
      await writeFile(seed.text, '验收文件暂时缩短');
      try {
        await preview.getByRole('button', { name: '重新读取', exact: true }).click();
        await preview.getByText('当前文件中没有第 120 行。', { exact: true }).waitFor();
        assert.equal(await target.count(), 0); report.shortenedFile = true;
        await writeFile(seed.text, '');
        await preview.getByRole('button', { name: '重新读取', exact: true }).click();
        await preview.getByText('文件内容为空', { exact: true }).waitFor();
        await preview.getByText('当前文件中没有第 120 行。', { exact: true }).waitFor();
        report.emptyFile = true;
      } finally { await writeFile(seed.text, seed.content); }
    }
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  }
  assert.equal(await editor.inputValue(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/file-line-${prepare ? 'prepare' : 'verify'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
