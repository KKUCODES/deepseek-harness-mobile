import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 只向用户已批准的专用测试会话发一条消息；保留原草稿，结束时停止本轮测试。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const serial = process.env.DSHM_ANDROID_SERIAL;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device);
const title = 'DSHM Remote 联调提示';
const report = { at: new Date().toISOString(), marker: `DSHM_LIVE_HISTORY_${Date.now()}`, errors: [], pages: [] };
const prompt = `这是 DSHM 实时历史分页验收。不调用任何工具，不读写文件，不继续此前任务。第一行单独输出 ${report.marker}，然后从1到500逐行输出序号及一句15字左右的中文风景描写，不要省略。我会在生成期间翻阅历史并点击停止。`;
let page, input, draft, profileSession, submitted = false;
const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, '先打开正式Remote页面'); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  assert.equal(await heading.innerText(), title);
  input = page.getByRole('textbox', { name: '消息', exact: true });
  draft = await input.inputValue();
  assert.equal(await page.getByRole('button', { name: '加入队列', exact: true }).count(), 0, '不打断已有运行');
  assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
  assert.equal(await page.locator('.remote-pending-files').count(), 0, '不发送原附件');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const replies = history.getByRole('article', { name: '模型回复' });
  await replies.first().waitFor(); await flush();
  const initialCount = await replies.count();
  if (process.env.DSHM_PROFILE === '1') {
    profileSession = await page.context().newCDPSession(page);
    await profileSession.send('Profiler.enable');
    await profileSession.send('Profiler.start');
  }
  await page.evaluate(() => {
    const original = [...document.querySelectorAll('.conversation article')];
    const data = { longTasks: [], maxTimerGap: 0, ticks: 0, addedArticles: 0, removedArticles: 0, visibility: [{ at: performance.now(), state: document.visibilityState }] };
    const visibility = () => data.visibility.push({ at: performance.now(), state: document.visibilityState });
    document.addEventListener('visibilitychange', visibility);
    let last = performance.now();
    const timer = setInterval(() => { const now = performance.now(); data.maxTimerGap = Math.max(data.maxTimerGap, now - last); last = now; data.ticks++; }, 100);
    const performanceObserver = new PerformanceObserver(list => data.longTasks.push(...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration }))));
    performanceObserver.observe({ type: 'longtask' });
    const mutations = new MutationObserver(records => {
      for (const record of records) for (const [field, nodes] of [['addedArticles', record.addedNodes], ['removedArticles', record.removedNodes]]) {
        for (const node of nodes) if (node.nodeType === 1) data[field] += Number(node.matches('article')) + node.querySelectorAll('article').length;
      }
    });
    mutations.observe(document.querySelector('.conversation'), { childList: true, subtree: true });
    window.__liveHistoryProbe = () => {
      clearInterval(timer); performanceObserver.disconnect(); mutations.disconnect(); document.removeEventListener('visibilitychange', visibility); delete window.__liveHistoryProbe;
      return { ...data, retainedOriginalArticles: original.filter(node => node.isConnected).length, originalArticles: original.length };
    };
  });
  await input.fill(prompt);
  // 点击后的结果未知也不能重发；清理只在同会话有本条原文时停止。
  submitted = true;
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  console.log(JSON.stringify({ phase: 'submitted', marker: report.marker }));
  await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ timeout: 60000 });
  await page.waitForFunction(({ count, marker }) => {
    const rows = [...document.querySelectorAll('.conversation article')];
    return rows.length > count && rows.at(-1).innerText.includes(marker) && rows.at(-1).innerText.length > marker.length + 80;
  }, { count: initialCount, marker: report.marker }, { timeout: 90000 });
  await input.fill(draft);
  const ongoing = () => page.getByRole('button', { name: draft.trim() ? '加入队列' : '停止生成', exact: true });
  assert.equal(await ongoing().count(), 1);
  const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
  while (await older.count()) {
    assert.ok(report.pages.length < 10);
    console.log(JSON.stringify({ phase: 'page-start', at: new Date().toISOString(), number: report.pages.length + 1 }));
    assert.equal(await ongoing().count(), 1, '必须在真实生成中翻页');
    await older.scrollIntoViewIfNeeded(); await flush();
    // 相同文本可出现在多轮测试回复中；阅读锚点绑定原 DOM，不能按子串找另一条。
    const before = await replies.allTextContents(), anchor = await replies.first().elementHandle();
    const anchorY = await anchor.evaluate(el => el.getBoundingClientRect().y);
    const liveBefore = await replies.last().innerText();
    await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, before.length);
    await flush();
    const original = anchor; assert.equal(await original.evaluate(el => el.isConnected), true);
    const after = await replies.allTextContents(), anchorShift = await original.evaluate(el => el.getBoundingClientRect().y) - anchorY;
    // 最后一条正在生成；其余已存在的回复应逐字、逐序保留。
    assert.deepEqual(after.slice(-before.length, -1), before.slice(0, -1));
    assert.ok(Math.abs(anchorShift) < 4, `分页导致阅读位置移动 ${anchorShift}px`);
    const readingY = await original.evaluate(el => el.getBoundingClientRect().y);
    await page.waitForFunction(length => [...document.querySelectorAll('.conversation article')].at(-1).innerText.length > length + 50, liveBefore.length, { timeout: 15000 });
    await flush();
    const liveAfter = await replies.last().innerText();
    const growthShift = await original.evaluate(el => el.getBoundingClientRect().y) - readingY;
    const distanceToBottom = await history.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight);
    assert.ok(Math.abs(growthShift) < 4, `尾部输出抢走阅读位置 ${growthShift}px`);
    assert.ok(distanceToBottom > 500, '向前阅读期间没有被带回底部');
    assert.equal(await input.inputValue(), draft);
    report.pages.push({ beforeCount: before.length, afterCount: after.length, anchorShift, growthShift, liveBefore: liveBefore.length, liveAfter: liveAfter.length, distanceToBottom });
    await anchor.dispose();
    console.log(JSON.stringify({ phase: 'page', ...report.pages.at(-1) }));
  }
  report.reachedStart = true;
  assert.ok(report.pages.length > 0);
  await page.screenshot({ path: 'artifacts/live-history-reading-android.png' });
  assert.equal(await history.getByText(prompt, { exact: true }).count(), 1, '只发一条测试消息');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
} finally {
  if (page && draft !== undefined) {
    try {
      assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), title);
      if (submitted && await page.getByRole('region', { name: '聊天内容', exact: true }).getByText(prompt, { exact: true }).count() === 1) {
        await input.fill('');
        const stop = page.getByRole('button', { name: '停止生成', exact: true });
        if (await stop.count()) { await stop.click(); await stop.waitFor({ state: 'detached', timeout: 60000 }); report.stopped = true; }
        const last = page.getByRole('article', { name: '模型回复' }).last();
        report.finalReply = await last.innerText();
        report.markerPresent = report.finalReply.includes(report.marker);
      }
      await input.fill(draft); assert.equal(await input.inputValue(), draft);
      report.draftRestored = true;
      report.probe = await page.evaluate(() => window.__liveHistoryProbe?.());
      if (profileSession) {
        const { profile } = await profileSession.send('Profiler.stop');
        await writeFile('artifacts/live-history-android.cpuprofile', JSON.stringify(profile));
        await profileSession.detach(); profileSession = null;
      }
      await page.screenshot({ path: 'artifacts/live-history-final-android.png' });
    } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  }
  await writeFile('artifacts/live-history-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, finalReply: report.finalReply ? `${report.finalReply.length} characters` : undefined }));
  await device.close();
}
