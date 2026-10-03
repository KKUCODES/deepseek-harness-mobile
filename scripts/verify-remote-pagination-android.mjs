import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';
import { checkRemoteResizeFollow } from './check-remote-resize-follow.mjs';

// Read-only real history test. Never sends a prompt or reads native credentials.
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [] };
const prefix = process.env.DSHM_PAGINATION_PREFIX ?? 'remote-pagination';
assert.match(prefix, /^[a-z0-9-]+$/);
let profilingPage, profiler;
const mark = async name => profilingPage?.evaluate(name => {
  window.__paginationPhases.push({ name, at: performance.now() });
}, name);
try {
  const first = await (await androidAppWebView(device)).page();
  let page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = first.context().waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const originalChat = () => page.getByRole('button').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) });
  await heading.waitFor();
  if (await heading.innerText() === 'Remote') {
    try { await originalChat().click({ timeout: 5000 }); }
    catch (error) {
      // 冷启动可能在列表挂载前自动恢复原聊天，只有确认到达该聊天才接受。
      if (await heading.innerText() !== 'DSHM Remote 联调提示') throw error;
    }
  }
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
  // 标题先于真实会话完成挂载；此时返回会被页面的在途操作保护忽略。
  await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复' }).first().waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (process.argv.includes('--profile')) {
    profilingPage = page;
    await page.evaluate(() => { window.__paginationPhases = []; window.__paginationTimedTasks = []; });
    profiler = await page.context().newCDPSession(page);
    await profiler.send('Profiler.enable'); await profiler.send('Profiler.start');
  }
  await page.evaluate(() => {
    window.__paginationTasks = [];
    window.__paginationObserver = new PerformanceObserver(list => {
      window.__paginationTasks.push(...list.getEntries().map(entry => entry.duration));
      window.__paginationTimedTasks?.push(...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration })));
    });
    window.__paginationObserver.observe({ type: 'longtask' });
  });
  await mark('open-chat');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  const opening = performance.now();
  await originalChat().click();
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const replies = history.getByRole('article', { name: '模型回复' });
  const allReplies = history.getByRole('article', { name: '模型回复', includeHidden: true });
  await replies.first().waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.earlyBottomDistance = await history.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop);
  // 原插件异步挂载后还有 ResizeObserver → rAF；两帧不代表布局已完成。
  // 核验实际尾部条件并限定 1 秒，保留最早采样，不能用放宽距离掩盖未跟随。
  const followStart = performance.now(), historyHandle = await history.elementHandle();
  try {
    await page.waitForFunction(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 4,
      historyHandle, { timeout: 1000 });
  } finally { await historyHandle.dispose(); }
  report.followWaitMs = performance.now() - followStart;
  report.initialBottomDistance = await history.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop);
  report.openMs = performance.now() - opening;
  assert.ok(report.initialBottomDistance < 4, '进入会话仍跟随最新回复');
  const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  report.pages = [];
  while (await older.count()) {
    assert.ok(report.pages.length < 50, '历史分页必须收敛');
    await mark(`page-${report.pages.length + 1}-prepare-locators`);
    await older.scrollIntoViewIfNeeded();
    report.before = await history.evaluate(el => ({ height: el.scrollHeight, top: el.scrollTop, count: el.querySelectorAll('article').length }));
    // 用户正在看的可能是用户消息；第一个模型回复未必在屏幕内，且其内部布局可随历史补齐变化。
    const anchors = await history.evaluateHandle(el => {
      const viewport = el.getBoundingClientRect();
      return [...el.querySelectorAll('.messages [data-chat-flow-key]')].filter(row => {
        const box = row.getBoundingClientRect();
        return box.height > 0 && box.bottom > viewport.top && box.top < viewport.bottom;
      }).map(node => ({ node, y: node.getBoundingClientRect().y }));
    });
    assert.ok(await anchors.evaluate(rows => rows.length > 0), '加载前必须存在可见聊天节点作为阅读锚点');
    await mark(`page-${report.pages.length + 1}-screenshot-before`);
    await page.screenshot({ path: `artifacts/${prefix}-before-page-${report.pages.length + 1}.png` });
    await mark(`page-${report.pages.length + 1}-read-before`);
    const previousReplies = await allReplies.allTextContents();
    const loading = performance.now();
    await mark(`page-${report.pages.length + 1}-load-and-layout`);
    await older.click();
    // 最后一页可能只有元数据；加载器消失同样表示读到开头，不能要求新增聊天卡片。
    // 限定实际聊天容器，避免保留的隐藏页面或旁栏影响计数。
    const historyElement = await history.elementHandle();
    try {
      await page.waitForFunction(({ element, count }) => element.querySelectorAll('article').length > count
        || !element.querySelector('[data-history-loader]'), { element: historyElement, count: report.before.count });
    } finally { await historyElement.dispose(); }
    // Wait for the real UI update and its scheduled scroll correction.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await mark(`page-${report.pages.length + 1}-verify-locators`);
    // 补齐轮次后，原插件会将过程节点改为 hidden="until-found"；应核对仍展示的同一节点。
    const retainedAnchor = await anchors.evaluate(rows => {
      const index = rows.findIndex(({ node }) => node.isConnected && !node.hasAttribute('hidden') && node.getBoundingClientRect().height > 0);
      if (index < 0) return null;
      const { node, y } = rows[index];
      return { key: node.getAttribute('data-chat-flow-key'), shift: node.getBoundingClientRect().y - y, skipped: index };
    });
    await anchors.dispose();
    assert.ok(retainedAnchor, '必须保留至少一个实际展示的原阅读节点');
    report.after = await history.evaluate(el => ({ height: el.scrollHeight, top: el.scrollTop, count: el.querySelectorAll('article').length }));
    report.anchorShift = retainedAnchor.shift;
    // 历史补齐后原插件会收起过程；比较含折叠内容的完整窗口，不能把不可见当成丢失。
    // 专用历史允许相同回复，按顺序比较而非把重复文字当成重复身份。
    const retainedReplies = (await allReplies.allTextContents()).slice(-previousReplies.length);
    report.previousWindowPreserved = JSON.stringify(retainedReplies) === JSON.stringify(previousReplies);
    report.pages.push({ before: report.before, after: report.after, loadedMs: performance.now() - loading, anchorKey: retainedAnchor.key, collapsedAnchors: retainedAnchor.skipped, anchorShift: report.anchorShift, previousWindowPreserved: report.previousWindowPreserved });
    await mark(`page-${report.pages.length}-screenshot-after`);
    await page.screenshot({ path: `artifacts/${prefix}-android.png` });
    assert.ok(Math.abs(report.anchorShift) < 4, `History anchor moved ${report.anchorShift}px`);
    assert.equal(report.previousWindowPreserved, true);
  }
  report.reachedStart = true;
  assert.ok(report.pages.length > 0);
  report.totalReplies = await allReplies.count();
  if (process.argv.includes('--resize-follow')) report.resizeFollow = await checkRemoteResizeFollow(page, history);
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true;
  report.longTasks = await page.evaluate(() => {
    window.__paginationObserver.disconnect();
    const values = window.__paginationTasks;
    return { count: values.length, max: Math.max(0, ...values), total: values.reduce((sum, value) => sum + value, 0) };
  });
  if (profiler) report.phases = await page.evaluate(() => ({ marks: window.__paginationPhases, tasks: window.__paginationTimedTasks }));
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    await writeFile(`artifacts/${prefix}.cpuprofile`, JSON.stringify(profile));
    await profiler.detach();
    await profilingPage.evaluate(() => { delete window.__paginationPhases; delete window.__paginationTimedTasks; });
  }
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
