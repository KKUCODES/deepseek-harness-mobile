import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

/** 大量合成记录仍经过原 Session 投影和真实 RemoteWorkspace，不写电脑历史或调用模型。 */
export async function checkRemoteHistoryScale(page) {
  page.setDefaultTimeout(30000);
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(() => window.fixture.select('one'));
  await page.addStyleTag({ path: 'src/ui/mobile.css' });
  await page.addStyleTag({ path: 'src/ui/remote-product.css' });
  await page.addStyleTag({ path: 'artifacts/tests/remote-rendering/test.css' });
  // 计数真实滚动容器的写入；不改 setter 语义，捕获每批事件重复强制布局。
  await page.getByRole('region', { name: '聊天内容', exact: true }).evaluate(element => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    window.__historyScaleScrollWrites = 0;
    Object.defineProperty(element, 'scrollTop', {
      configurable: true,
      get() { return descriptor.get.call(this); },
      set(value) { window.__historyScaleScrollWrites++; descriptor.set.call(this, value); },
    });
  });
  const turns = 1000;
  const profiler = process.argv.includes('--profile') ? await page.context().newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Performance.enable');
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
  }
  const started = performance.now();
  await page.evaluate(async turns => {
    window.__workspaceRenders = 0;
    window.__mainFactoryRenders = 0;
    window.__historyScaleTasks = [];
    new PerformanceObserver(list => {
      window.__historyScaleTasks.push(...list.getEntries().map(entry => ({ at: entry.startTime, duration: entry.duration })));
    }).observe({ type: 'longtask' });
    const body = Array.from({ length: 4 }, (_, index) => `第 ${index + 1} 段说明：保留既有会话、工具审批和草稿；新回复到达时仍能翻阅历史。\n\n`).join('')
      + '```ts\nconst result = await session.loadOlder();\nconsole.log(result);\n```\n\n| 功能 | 状态 |\n| --- | --- |\n| 同步 | 完成 |\n| 输入 | 保留 |';
    for (let turn = 1; turn <= turns; turn++) {
      window.fixture.emitTurn('one', turn, (turn - 1) * 5, `SCALE_REPLY_${turn}\n\n${body}`);
      if (turn % 20 === 0) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  }, turns);
  const chat = page.getByRole('region', { name: '聊天内容', exact: true });
  await chat.getByText(`SCALE_REPLY_${turns}`, { exact: true }).waitFor({ state: 'attached' });
  const loadedMs = performance.now() - started;
  let metrics;
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    metrics = (await profiler.send('Performance.getMetrics')).metrics;
    await writeFile('artifacts/remote-history-scale.cpuprofile', JSON.stringify(profile));
    await profiler.detach();
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const followWrites = await page.evaluate(() => window.__historyScaleScrollWrites);
  const workspaceRenders = await page.evaluate(() => window.__workspaceRenders);
  const factoryRenders = await page.evaluate(() => window.__mainFactoryRenders);
  const distanceFromBottom = await chat.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop);
  assert.ok(distanceFromBottom < 2, '尾部跟随最终回复');
  const before = await page.evaluate(() => structuredClone(window.__messageRenders));
  assert.equal(Object.values(before).filter(item => item.kind === 'assistant-step').length, turns);
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  await editor.fill(''); await editor.focus();
  await page.evaluate(() => {
    window.__historyScaleInput = [];
    document.querySelector('[data-composer-input]').addEventListener('input', () => {
      const at = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => window.__historyScaleInput.push(performance.now() - at)));
    });
  });
  await editor.pressSequentially('long-history-input-keeps-working', { delay: 35 });
  await page.waitForFunction(() => window.__historyScaleInput.length >= 25);
  assert.equal(await editor.innerText(), 'long-history-input-keeps-working');
  const afterInput = await page.evaluate(() => window.__messageRenders);
  for (const [key, item] of Object.entries(before)) assert.equal(afterInput[key].count, item.count, '输入不重画历史');
  await chat.evaluate(element => { element.scrollTop = element.scrollHeight * 0.45; });
  const reading = await chat.evaluate(element => ({ top: element.scrollTop, height: element.clientHeight, scrollHeight: element.scrollHeight }));
  assert.ok(reading.top > reading.height);
  const liveStarted = performance.now();
  await page.evaluate(turns => window.fixture.emitTurn('one', turns + 1, turns * 5, 'SCALE_NEW_REPLY'), turns);
  await chat.getByText('SCALE_NEW_REPLY', { exact: true }).waitFor({ state: 'attached' });
  const updateMs = performance.now() - liveStarted;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(Math.abs(await chat.evaluate(element => element.scrollTop) - reading.top) < 2, '历史阅读位置保持');
  const afterUpdate = await page.evaluate(() => window.__messageRenders);
  for (const [key, item] of Object.entries(before)) assert.equal(afterUpdate[key].count, item.count, '新回复不重画历史');
  const samples = await page.evaluate(() => window.__historyScaleInput);
  samples.sort((a, b) => a - b);
  const report = { environment: 'Headless desktop Edge, 375×667; synthetic 1000-turn protocol replay, not MuMu or model throughput',
    turns, loadedMs, updateMs, metrics, workspaceRenders, factoryRenders, followWrites, distanceFromBottom, inputToTwoFrames: { count: samples.length, median: samples[Math.floor(samples.length / 2)], p95: samples[Math.ceil(samples.length * .95) - 1], max: samples.at(-1) },
    longTasks: await page.evaluate(() => ({ count: window.__historyScaleTasks.length, max: Math.max(0, ...window.__historyScaleTasks.map(task => task.duration)) })),
    reading, inputNoHistoricalRenders: true, updateNoHistoricalRenders: true, readingPositionPreserved: true };
  await page.screenshot({ path: 'artifacts/remote-history-scale-web.png' });
  await writeFile('artifacts/remote-history-scale-measurement.json', JSON.stringify(report, null, 2));
  assert.ok(workspaceRenders < turns / 2, `同一批事件不应逐条重画聊天页面，实际渲染 ${workspaceRenders} 次`);
  assert.ok(factoryRenders < turns / 2, `消息内容变化不应逐条重画会话工厂，实际渲染 ${factoryRenders} 次`);
  assert.ok(followWrites < turns / 2, `同一帧的事件应合并滚动，实际写入 ${followWrites} 次`);
  return report;
}
