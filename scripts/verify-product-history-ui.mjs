import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createValidationServer } from './serve.mjs';
const server = createValidationServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  // 隔离浏览器数据目录中的分页夹具；不向用户设备、真实聊天或模型写入。
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/mobile.html`);
  await page.getByTestId('ordinary-product').waitFor();
  await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
    try { await new Promise((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite'); tx.oncomplete = resolve; tx.onerror = reject;
      for (let i = 0; i < 85; i++) tx.objectStore('chats').add({ id: `pagination-${i}`, mode: 'ordinary', title: `分页测试 ${i}`, draft: '', model: 'deepseek-flash', thinking: false, updatedAt: i + 1,
        turns: Array.from({ length: i === 84 ? 65 : 1 }, (_, n) => ({ requestId: `turn-${i}-${n}`, model: 'deepseek-flash', thinking: false, prompt: `问题 ${n}`, content: `分页匹配 回复 ${n}`, reasoning: '', status: 'completed', error: null })) });
    }); } finally { db.close(); }
  });
  await page.reload(); const b = name => page.getByRole('button', { name, exact: true });
  await b('打开侧边抽屉').click(); assert.equal(await page.locator('.history-row').count(), 40);
  await b('加载更多').click(); await page.waitForFunction(() => document.querySelectorAll('.history-row').length === 80);
  await b('加载更多').click(); await page.waitForFunction(() => document.querySelectorAll('.history-row').length === 85);
  await b('分页测试 84').click(); assert.equal(await page.locator('.reply').count(), 30);
  await b('加载更早的消息').click(); await page.waitForFunction(() => document.querySelectorAll('.reply').length === 60);
  await b('加载更早的消息').click(); await page.waitForFunction(() => document.querySelectorAll('.reply').length === 65);
  await b('打开侧边抽屉').click(); await b('搜索聊天').click(); await page.getByRole('textbox', { name: '搜索聊天', exact: true }).fill('分页匹配');
  await page.waitForFunction(() => document.querySelectorAll('.chat-search-result').length === 40); await b('加载更多').click();
  await page.waitForFunction(() => document.querySelectorAll('.chat-search-result').length === 80); await b('加载更多').click();
  await page.waitForFunction(() => document.querySelectorAll('.chat-search-result').length === 85);
  await b('关闭搜索').click(); await b('设置').click(); await page.getByRole('button', { name: /^本地数据/ }).click();
  assert.match(await page.locator('.settings-storage').innerText(), /85 条聊天 · 149 轮消息/);
  await b('清空本地聊天').click(); await b('取消').click(); assert.match(await page.locator('.settings-storage').innerText(), /85 条聊天/);
  await b('清空本地聊天').click(); await b('确认清空').click(); await page.waitForFunction(() => document.querySelector('.settings-storage').textContent.includes('0 条聊天'));
  await b('返回设置首页').click(); await b('退出设置').click(); await b('打开侧边抽屉').click();
  assert.equal(await page.locator('.history-row').count(), 0);
  const report = { passed: true, environment: 'Isolated Edge 375x667 product UI; synthetic pagination fixtures, no real model or phone data', chats: 85, longChatTurns: 65, historySearchPagination: true, stats: true, clearCancelAndConfirm: true };
  await writeFile('artifacts/ordinary-history-ui.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); server.close(); }
