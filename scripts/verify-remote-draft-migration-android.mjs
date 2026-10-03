import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), title: `DSHM 草稿迁移 ${randomUUID().slice(0, 8)}`, errors: [] };
const abortCheck = process.argv.includes('--abort-check');
const output = abortCheck ? 'artifacts/remote-draft-abort-android' : 'artifacts/remote-draft-migration-android';
const marker = `旧版中文草稿 ${randomUUID()}\n第二行 🎈`, latest = `${marker}\n新版编辑`;
let key;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'), heading = main.locator('.remote-heading strong');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const menu = async name => {
    if (!await main.getByRole('button', { name, exact: true }).isVisible())
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const originalDraft = await input.textContent();
  await menu('新建聊天');
  const workspace = page.getByRole('dialog', { name: '选择工作区', exact: true });
  await workspace.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
  await workspace.waitFor({ state: 'hidden' });
  await menu('重命名聊天');
  const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
  await rename.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
  await rename.getByRole('button', { name: '保存名称', exact: true }).click();
  await heading.getByText(report.title, { exact: true }).waitFor(); report.created = true;
  // 空会话不进入电脑持久历史；先通过真实模型完成一轮，再验证重开后的草稿。
  await input.fill('这是专用草稿迁移测试。不要调用工具，只回复 DSHM_DRAFT_READY。');
  await main.getByRole('button', { name: '发送消息', exact: true }).click();
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_DRAFT_READY' }).waitFor({ timeout: 60000 });
  await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
  report.realReply = true;

  // 用正式编辑器生成键，再通过唯一测试文字定位；不读取绑定凭据或其他会话正文。
  await input.fill(marker);
  for (let attempt = 0; attempt < 100 && !key; attempt++) {
    key = await page.evaluate(marker => new Promise((resolve, reject) => {
      const request = indexedDB.open('dshm.remote.drafts.v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('drafts', 'readonly');
        const cursor = tx.objectStore('drafts').openCursor(); let found;
        cursor.onsuccess = () => { const row = cursor.result; if (!row) return;
          if (row.value === marker || row.value?.text === marker) found = row.key;
          row.continue(); };
        tx.oncomplete = () => { db.close(); resolve(found); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), marker);
    if (!key) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(typeof key, 'string');
  const stored = () => page.evaluate(key => new Promise((resolve, reject) => {
    const request = indexedDB.open('dshm.remote.drafts.v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('drafts', 'readonly'), read = tx.objectStore('drafts').get(key);
      tx.oncomplete = () => { db.close(); resolve(read.result ?? null); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), key);
  if (abortCheck) {
    const committed = await stored();
    // 只中止下一个真实草稿事务，立即恢复原方法；不替换产品保存函数或远端数据。
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = original.apply(this, args);
        if (this.name === 'dshm.remote.drafts.v1' && args[1] === 'readwrite') {
          IDBDatabase.prototype.transaction = original;
          queueMicrotask(() => tx.abort());
        }
        return tx;
      };
    });
    await input.fill('DSHM_DRAFT_ABORT_UNCOMMITTED');
    await main.getByText('草稿未能保存到手机，请勿关闭 App，检查存储后重试。', { exact: true }).waitFor();
    assert.deepEqual(await stored(), committed); report.failedSavePreservedDatabase = true;
    await main.getByRole('button', { name: '重试保存草稿', exact: true }).click();
    await main.getByText('草稿未能保存到手机，请勿关闭 App，检查存储后重试。', { exact: true }).waitFor({ state: 'hidden' });
    const retried = await stored(); assert.equal(retried.text ?? retried, 'DSHM_DRAFT_ABORT_UNCOMMITTED');
    report.retryCommitted = true;
    // 重试按钮触发原编辑器受控值回填；等这次渲染完成再发起下一次输入。
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await input.click(); await input.press('ControlOrMeta+A'); await input.press('Backspace');
  for (let attempt = 0; attempt < 100 && await stored() !== null; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await stored(), null);
  const reload = async () => {
    await page.reload(); await main.waitFor({ timeout: 60000 });
    if (!await heading.getByText(report.title, { exact: true }).isVisible())
      await main.getByRole('button', { name: new RegExp(`^${report.title}`) }).click();
    await heading.getByText(report.title, { exact: true }).waitFor();
  };
  // 源码确认的旧 localStorage 纯文字格式；只写本测试会话，不模拟安装成功。
  await page.evaluate(({ key, marker }) => { if (localStorage.getItem(key) !== null) throw Error('legacy key occupied'); localStorage.setItem(key, marker); }, { key, marker });
  await reload();
  await input.filter({ hasText: marker.split('\n')[0] }).waitFor();
  assert.equal((await input.locator(':scope > p').allTextContents()).join('\n'), marker);
  const migrated = await stored();
  assert.equal(typeof migrated === 'string' ? migrated : migrated?.text, marker);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
  report.legacyRestored = true; report.legacyRemovedAfterCommit = true;
  await input.fill(latest);
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await stored(); if ((typeof value === 'string' ? value : value?.text) === latest) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const before = await stored(); assert.equal(typeof before === 'string' ? before : before?.text, latest);
  await page.evaluate(({ key, marker }) => localStorage.setItem(key, marker), { key, marker });
  await reload(); assert.equal((await input.locator(':scope > p').allTextContents()).join('\n'), latest);
  assert.deepEqual(await stored(), before);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
  report.newerPreserved = true;
  await page.screenshot({ path: `${output}.png` });
  await input.click(); await input.press('ControlOrMeta+A'); await input.press('Backspace');
  for (let attempt = 0; attempt < 100 && await stored() !== null; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await stored(), null);
  await menu('归档聊天'); report.archived = true;
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  assert.equal(await input.textContent(), originalDraft); report.originalDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`${output}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
