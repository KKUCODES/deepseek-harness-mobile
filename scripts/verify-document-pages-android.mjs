import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const parent = resolve('../DSH-TEST'), root = resolve(parent, 'dshm-document-pages-20260926');
assert.ok(root.startsWith(parent + sep));
const text = '第一行🙂\n\n第三行\n最后一行\n';
const contents = { '正文.txt': text, 'escaped.txt': '"'.repeat(1100000) };
if (process.argv.includes('--prepare')) {
  // 独立目录只创建一次，拒绝覆盖可能属于其他工作的现有文件。
  await mkdir(root);
  for (const [name, content] of Object.entries(contents)) await writeFile(resolve(root, name), content, { flag: 'wx' });
  console.log(JSON.stringify({ prepared: root }));
} else {
  const cleanup = process.argv.includes('--cleanup');
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), errors: [], resources: [] };
  let page;
  try {
    const first = await (await androidAppWebView(device)).page(), context = first.context();
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page, 'Open the existing Remote app'); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    await page.getByTestId('remote-workspace').waitFor();
    if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
    const editor = page.getByRole('textbox', { name: '消息', exact: true });
    const draft = await editor.innerText(), probe = page.getByTestId('live-document-pages');
    if (cleanup) {
      await probe.waitFor({ state: 'detached' }); report.pluginUnloaded = true;
      // 核对内容没有被其他进程修改后，才删除本次生成的独立文件夹。
      for (const [name, content] of Object.entries(contents)) assert.equal(await readFile(resolve(root, name), 'utf8'), content);
      await rm(root, { recursive: true }); report.filesRemoved = true;
    } else {
      await probe.getByRole('button', { name: '读取测试文件', exact: true }).click();
      await probe.getByTestId('document-page-result').filter({ hasText: /^\{/ }).waitFor();
      const result = JSON.parse(await probe.getByTestId('document-page-result').innerText());
      report.result = result;
      assert.equal(result.error, undefined, JSON.stringify(result));
      // 原 Remote 返回 RemoteResult 信封；客户端不能把 ok:false 当作成功的文件页。
      for (const key of ['first', 'last', 'defaults', 'recovered']) {
        assert.equal(result[key]?.ok, true, JSON.stringify(result[key]));
        result[key] = result[key].value;
      }
      assert.deepEqual([result.first.offset, result.first.text, result.first.lines, result.first.eof], [1, '第一行🙂\n', 2, false]);
      assert.deepEqual([result.last.offset, result.last.text, result.last.lines, result.last.eof], [3, '第三行\n最后一行', 2, true]);
      assert.equal(result.first.version, result.last.version);
      assert.equal(result.first.bytes, Buffer.byteLength(text));
      assert.equal(result.defaults.text, text.slice(0, -1)); assert.equal(result.defaults.eof, true);
      assert.equal(result.oversized.code, 'workspace-file/too-large');
      assert.equal(result.oversized.details.limit, 2 * 1024 * 1024);
      assert.deepEqual(result.recovered, result.last);
      report.result = result; report.sameConnectionRecovered = true;
      await page.screenshot({ path: 'artifacts/document-pages-android.png' });
    }
    assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  } catch (error) {
    report.failure = error.message;
    if (page) await page.screenshot({ path: 'artifacts/document-pages-failure-android.png' }).catch(() => {});
    throw error;
  } finally {
    await writeFile(`artifacts/document-pages-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); await device.close();
  }
}
