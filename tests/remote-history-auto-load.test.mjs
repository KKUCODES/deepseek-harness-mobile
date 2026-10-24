import test from 'node:test';
import assert from 'node:assert/strict';
import { observeHistoryTop } from '../src/remote-history-auto-load.mjs';

function fixture() {
  const frames = new Map(), view = new EventTarget(); let frameId = 0;
  view.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  view.cancelAnimationFrame = id => frames.delete(id);
  const container = Object.assign(new EventTarget(), { scrollTop: 0, ownerDocument: { defaultView: view } });
  let calls = 0, allowed = true, complete;
  const observer = observeHistoryTop(container, { canLoad: () => allowed, load: () => { calls++; return new Promise(resolve => { complete = resolve; }); } });
  const event = (type, data = {}) => container.dispatchEvent(Object.assign(new Event(type), data));
  const tick = async () => {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  };
  const finish = async () => { complete(); await tick(); await tick(); await tick(); };
  return { container, event, tick, finish, stop: observer.dispose, reset: observer.reset, calls: () => calls, allowed: value => { allowed = value; } };
}

test('初始、程序滚动和向下滚动不读取；接近顶部的向上意图只读取一次', async () => {
  const f = fixture();
  f.event('scroll'); await f.tick(); assert.equal(f.calls(), 0);
  f.event('wheel', { deltaY: 10 }); await f.tick(); assert.equal(f.calls(), 0);
  f.container.scrollTop = 180; f.event('wheel', { deltaY: -30 }); await f.tick(); assert.equal(f.calls(), 0);
  f.container.scrollTop = 100;
  for (let i = 0; i < 20; i++) f.event('wheel', { deltaY: -30 });
  await f.tick(); assert.equal(f.calls(), 1);
  for (let i = 0; i < 20; i++) { f.event('wheel', { deltaY: -30 }); f.event('scroll'); }
  await f.finish(); assert.equal(f.calls(), 1);
  // 锚点校正后仍在顶端也不连读；继续向上才读取下一批。
  f.event('scroll'); await f.tick(); assert.equal(f.calls(), 1);
  f.event('wheel', { deltaY: -20 }); await f.tick(); assert.equal(f.calls(), 2);
  await f.finish(); f.stop();
});

test('触摸上拉历史、键盘及鼠标拖动滚动条均可触发；编辑框方向键不触发', async () => {
  const f = fixture();
  f.event('touchstart', { touches: [{ clientY: 100 }] });
  f.event('touchmove', { touches: [{ clientY: 150 }] }); await f.tick(); assert.equal(f.calls(), 1);
  await f.finish();
  f.event('touchmove', { touches: [{ clientY: 180 }] }); await f.tick(); assert.equal(f.calls(), 1, '同一次触摸不因快速回执而连读');
  f.event('touchmove', { touches: [{ clientY: 80 }] }); await f.tick(); assert.equal(f.calls(), 1);
  f.event('touchend');
  f.event('keydown', { key: 'Home' }); await f.tick(); assert.equal(f.calls(), 2); await f.finish();
  f.container.closest = () => true;
  f.event('keydown', { key: 'ArrowUp' }); await f.tick(); assert.equal(f.calls(), 2);
  delete f.container.closest;
  f.container.scrollTop = 100; f.event('scroll');
  f.event('pointerdown', { pointerType: 'mouse' }); f.container.scrollTop = 60; f.event('scroll');
  await f.tick(); assert.equal(f.calls(), 3); await f.finish(); f.stop();
});

test('离线、忙碌、加载失败或无更多时不排队；卸载后旧请求完成不能重新监听', async () => {
  const f = fixture(); f.allowed(false);
  f.event('wheel', { deltaY: -30 }); await f.tick(); assert.equal(f.calls(), 0);
  f.allowed(true); f.event('scroll'); await f.tick(); assert.equal(f.calls(), 0);
  f.event('wheel', { deltaY: -30 }); await f.tick(); assert.equal(f.calls(), 1);
  f.stop(); await f.finish(); f.event('wheel', { deltaY: -30 }); await f.tick(); assert.equal(f.calls(), 1);
});

test('上划后的惯性滚动到阈值触发，手动翻页重置和反向滚动会撤销旧意图', async () => {
  const f = fixture(); f.container.scrollTop = 500; f.event('scroll');
  f.event('touchstart', { touches: [{ clientY: 100 }] });
  f.event('touchmove', { touches: [{ clientY: 140 }] }); await f.tick(); assert.equal(f.calls(), 0);
  f.event('touchend'); f.container.scrollTop = 120; f.event('scroll'); await f.tick();
  assert.equal(f.calls(), 1); await f.finish();
  f.container.scrollTop = 500; f.event('scroll'); f.event('wheel', { deltaY: -80 }); await f.tick();
  f.reset(); f.container.scrollTop = 0; f.event('scroll'); await f.tick(); assert.equal(f.calls(), 1);
  f.event('wheel', { deltaY: -80 }); f.event('wheel', { deltaY: 80 }); await f.tick(); assert.equal(f.calls(), 1);
  f.stop();
});
