import assert from 'node:assert/strict';

/** 真实插件Conversation/Session接口与手机按钮共用同一历史窗口，只有电脑响应是合成协议。 */
export async function checkRemoteHistoryContract(page, styles) {
  const errors = [], report = { cases: [] };
  const observe = error => errors.push(error.message);
  page.on('pageerror', observe);
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const earlier = page.getByRole('button', { name: '加载更早的消息', exact: true });
  const state = () => page.evaluate(() => window.fixture.historyState());
  const snapshot = await page.evaluate(() => !!window.fixture);
  assert.ok(snapshot);
  const start = async () => {
    await page.reload();
    for (const path of styles) await page.addStyleTag({ path });
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => { window.fixture.historyTesting(true); return window.fixture.select('one'); });
    await editor.fill('历史接口回归草稿');
    assert.deepEqual((await state()).seq, [10]);
  };
  const inject = seq => page.evaluate(seq => window.fixture.historyPage({ records: [{ type: 'event',
    event: { type: 'turn/start', seq, time: 5, data: { turn: 0 } } }], hasMore: false }), seq);
  const waitRequest = count => page.waitForFunction(count => window.fixture.historyRequests() === count, count);
  const failedState = async () => {
    await page.waitForFunction(() => !window.fixture.historyState().loading && !!window.fixture.historyState().error);
    const value = await state();
    assert.deepEqual(value.seq, [10], '断层或载体失败不改已有记录');
    assert.equal(value.hasMore, true, '保留手动重试');
    assert.equal(value.error, '未能加载更早的记录，请重试。');
    assert.equal(await editor.innerText(), '历史接口回归草稿');
    assert.equal(await earlier.isEnabled(), true);
    await page.getByRole('alert').filter({ hasText: value.error }).waitFor();
    return value;
  };
  const recover = async count => {
    await earlier.click(); await waitRequest(count); await inject(9);
    await page.waitForFunction(() => !window.fixture.historyState().loading && window.fixture.historyState().seq.length === 2);
    const value = await state();
    assert.deepEqual(value.seq, [9,10]);
    assert.equal(value.error, null); assert.equal(value.hasMore, false);
    assert.equal(await editor.innerText(), '历史接口回归草稿');
    assert.equal(await page.getByRole('alert').count(), 0);
    return value;
  };
  try {
    for (const failure of ['carrier', 'discontinuous']) {
      await start();
      // 创建时立即接失败，既检查公开接口必须完成，也避免回归失败时Node提前退出。
      const pending = page.evaluate(() => window.fixture.conversationLoadOlder()).then(
        value => ({ completed: true, value }), error => ({ completed: false, error: error.message }));
      await waitRequest(1);
      if (failure === 'carrier') await page.evaluate(() => window.fixture.historyReply(false));
      else await inject(5);
      assert.deepEqual(await pending, { completed: true, value: undefined }, '公开loadOlder保持官方失败行为');
      const failed = await failedState();
      assert.equal(failed.request.beforeSeq, 10);
      report.cases.push({ entry: 'await conversation.loadOlder', failure, retained: failed.seq, recovered: (await recover(2)).seq });
    }

    await start();
    await page.evaluate(() => window.fixture.conversationProbe());
    await page.getByRole('button', { name: '插件加载更早历史', exact: true }).click();
    await waitRequest(1); await inject(5);
    await failedState();
    // 给浏览器一个完整任务处理未接Promise；不能只检查点击返回就认定没有未处理拒绝。
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.deepEqual(errors, [], '插件忽略返回Promise也不新增未处理异常');
    report.cases.push({ entry: 'actual plugin button ignores promise', recovered: (await recover(2)).seq });

    await start();
    const strict = page.evaluate(() => window.fixture.historyStrictOlder()).then(
      () => ({ rejected: false }), error => ({ rejected: true, message: error.message }));
    await waitRequest(1); await inject(5);
    const rejection = await strict;
    assert.equal(rejection.rejected, true);
    assert.match(rejection.message, /remote_history_page_discontinuous/);
    await failedState();
    report.cases.push({ entry: 'strict internal older still rejects', recovered: (await recover(2)).seq });

    await start();
    await earlier.click(); await waitRequest(1); await inject(5);
    await failedState();
    report.cases.push({ entry: 'actual phone history button', recovered: (await recover(2)).seq });

    await start();
    const through = page.evaluate(() => window.fixture.historyLoadThrough(0)).then(
      value => ({ completed: true, value }), error => ({ completed: false, error: error.message }));
    await waitRequest(1);
    await page.evaluate(() => window.fixture.historyPage({ records: [0,2].map(seq => ({ type:'event', event:{type:'turn/start',seq,time:seq,data:{turn:0}} })), hasMore:false }));
    assert.deepEqual(await through, { completed:true, value:undefined });
    await failedState();
    report.cases.push({ entry: 'public Session.loadThrough', recovered: (await recover(2)).seq });
    assert.deepEqual(errors, []);
    return { ...report, errors };
  } finally { page.off('pageerror', observe); }
}
