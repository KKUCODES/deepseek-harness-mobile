import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createValidationServer } from './serve.mjs';
import { checkChatCodeBlock, codeMarkdown } from './check-chat-code-block.mjs';
import { checkChatTable, tableMarkdown } from './check-chat-table.mjs';

// 完整普通聊天页面、真实排版插件席位和本地历史；只写隔离浏览器，不调用模型或读取Key。
const alpha2 = process.argv.includes('--alpha2');
const tableMode = process.argv.includes('--table');
const title = tableMode ? '表格回归' : '代码卡回归', prefix = tableMode ? 'chat-table' : 'code-block';
const server = createValidationServer(resolve(alpha2 ? 'artifacts/official-alpha2-mobile-dist' : 'artifacts/ci/web'));
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ...(tableMode ? { isMobile: true, hasTouch: true } : {}) });
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
const report = { source: 'Production OrdinaryApp + rendering plugin; isolated synthetic local history, no model requests', errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/mobile.html`);
  await page.getByTestId('ordinary-product').waitFor();
  await page.evaluate(async ({ content, title }) => {
    const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
    try { await new Promise((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite'); tx.oncomplete = resolve; tx.onerror = reject;
      tx.objectStore('chats').put({ id: 'code-card-check', mode: 'ordinary', title, draft: '', model: 'deepseek-flash', thinking: false, updatedAt: 1,
        turns: [{ requestId: 'code-check', model: 'deepseek-flash', thinking: false, prompt: '隔离代码排版样例', content, reasoning: '', status: 'completed', error: null }] });
    }); } finally { db.close(); }
  }, { content: tableMode ? tableMarkdown : codeMarkdown, title });
  await page.reload();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  if (tableMode) report.table = await checkChatTable(page, page.locator('.reply'));
  else {
  report.codeBlock = await checkChatCodeBlock(page, page.locator('.reply .md-code-block'));
  const background = () => page.locator('.reply .md-code-block').evaluate(el => getComputedStyle(el).backgroundColor);
  const light = await background();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
  const dark = await background(); report.palette = { light, dark }; assert.notEqual(light, dark);
  }
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `artifacts/${prefix}-ordinary${alpha2 ? '-alpha2' : ''}.png` });
} catch (error) { report.failure = error.stack; throw error; }
finally { await writeFile(`artifacts/${prefix}-ordinary${alpha2 ? '-alpha2' : ''}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); server.close(); }
