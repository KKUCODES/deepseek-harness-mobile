import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const reportUrl = new URL('../artifacts/remote-product-performance.json', import.meta.url);
const title = 'DSHM Remote 联调提示';
const probe = `(() => {
  const data = { lcp: null, cls: 0, tasks: [] };
  const observers = [];
  for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (type === 'largest-contentful-paint') data.lcp = entry.startTime;
        if (type === 'layout-shift' && !entry.hadRecentInput) data.cls += entry.value;
        if (type === 'longtask') data.tasks.push({ start: entry.startTime, duration: entry.duration });
      }
    });
    observer.observe({ type, buffered: true }); observers.push(observer);
  }
  window.__dshmRemotePerformance = {
    read: () => ({ ...data, tasks: [...data.tasks], at: performance.now(),
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      visibility: document.visibilityState }),
    stop: () => { for (const observer of observers) observer.disconnect(); delete window.__dshmRemotePerformance; }
  };
})();`;

/** 接收已经连接的实际 Android 页面；仅重读列表和固定测试聊天，不发消息或改设置。 */
export async function measureRemoteAndroid(page, onProgress = () => {}) {
  assert.equal(page.url(), 'https://remote.dshm.invalid/assets/web/remote.html');
  assert.ok((await page.locator('.remote-heading strong').allTextContents()).includes(title));
  const input = page.locator('[contenteditable=true]');
  const draft = await input.textContent();
  assert.equal(draft, '', '只在专用测试聊天的空草稿下测量');
  assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
  const cdp = await page.context().newCDPSession(page);
  const report = { at: new Date().toISOString(), scope: 'actual-MuMu-Remote-reload-and-existing-chat',
    method: '3 warm page reloads through real local gateway/DSH; existing binding, plugins and history. Not Activity cold start, model latency, physical phone or Lighthouse TBT.',
    errors: [], runs: [], restored: false };
  const onError = error => report.errors.push(error.message);
  page.on('pageerror', onError);
  let identifier;
  try {
    report.browser = await cdp.send('Browser.getVersion');
    await cdp.send('Page.enable');
    report.apkSha256 = createHash('sha256').update(await readFile(new URL('../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url))).digest('hex');
    ({ identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: probe }));
    for (let index = 0; index < 3; index++) {
      await page.reload();
      await page.getByText('已连接电脑', { exact: true }).waitFor({ timeout: 30000 });
      await page.getByText(title, { exact: true }).waitFor();
      const listReadyMs = await page.evaluate(() => performance.now());
      // 两秒观察窗用于收集首屏后插件布局，不把它称为标准 TBT。
      await page.waitForTimeout(2000);
      const home = await page.evaluate(() => window.__dshmRemotePerformance.read());
      const clickedAt = await page.evaluate(() => performance.now());
      await page.getByText(title, { exact: true }).click();
      await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
      await input.waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const chatReadyMs = await page.evaluate(() => performance.now());
      await page.waitForTimeout(2000);
      const chat = await page.evaluate(() => window.__dshmRemotePerformance.read());
      const replies = await page.getByRole('article', { name: '模型回复', exact: true }).count();
      assert.ok(home.fcp > 0 && home.lcp > 0 && replies > 0);
      assert.equal(home.visibility, 'visible'); assert.equal(chat.visibility, 'visible');
      assert.equal(await input.textContent(), draft);
      const run = { run: index + 1, listReadyMs, chatOpenMs: chatReadyMs - clickedAt, replies,
        home, chat, maxLongTaskMs: Math.max(0, ...chat.tasks.map(task => task.duration)),
        longTaskOver50ms: chat.tasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0) };
      report.runs.push(run); onProgress(run);
      await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
    }
    report.restored = (await page.locator('.remote-heading strong').allTextContents()).includes(title) && await input.textContent() === draft;
    assert.equal(report.restored, true); assert.deepEqual(report.errors, []);
    report.metrics = {};
    for (const [name, get] of Object.entries({ fcpMs: r => r.home.fcp, lcpMs: r => r.home.lcp,
      cls: r => r.home.cls, listReadyMs: r => r.listReadyMs, chatOpenMs: r => r.chatOpenMs,
      maxLongTaskMs: r => r.maxLongTaskMs, longTaskOver50ms: r => r.longTaskOver50ms })) {
      const values = report.runs.map(get).sort((a, b) => a - b);
      report.metrics[name] = { median: values[1], worst: values[2] };
    }
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    page.off('pageerror', onError);
    if (identifier) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    await page.evaluate(() => window.__dshmRemotePerformance?.stop()).catch(() => {});
    await cdp.detach();
    await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
