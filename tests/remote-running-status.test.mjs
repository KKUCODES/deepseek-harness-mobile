import assert from 'node:assert/strict';
import test from 'node:test';
import { runningTurnStartTime } from '../src/remote-running-status.mjs';

test('运行时钟取当前开放轮次的电脑事件时间，已结束的轮次不继续计时', () => {
  const timeline = { turns: new Map([[1, { status: 'closed', start: { time: 1000 } }], [2, { status: 'open', start: { time: 5000 } }]]) };
  assert.equal(runningTurnStartTime(timeline), 5000);
  timeline.turns.set(2, { status: 'closed', start: { time: 5000 } });
  assert.equal(runningTurnStartTime(timeline), undefined);
});

test('窗口缺失开轮边界或时间无效时不编造起点', () => {
  for (const timeline of [undefined, { turns: new Map([[1, { status: 'open' }]]) }, { turns: new Map([[1, { status: 'open', start: { time: NaN } }]]) }])
    assert.equal(runningTurnStartTime(timeline), undefined);
  assert.equal(runningTurnStartTime({ turns: new Map([[1, { status: 'open', start: { time: 0 } }]]) }), 0);
});
