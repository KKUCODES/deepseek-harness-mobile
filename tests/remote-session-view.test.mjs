import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteSessionView } from '../src/remote-session-view.mjs';

// 仅用于控制原引用就绪与导航竞争的时序；真实Controller路径另由remote-model.test覆盖。
function fixture() {
  const references = [], streams = new Map();
  const source = value => {
    const listeners = new Set();
    return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      emit(next) { value = next; for (const fn of listeners) fn(); }, get observers() { return listeners.size; } };
  };
  const model = {
    lifetime: new AbortController(), connection: 'connected',
    getSnapshot() { return { connectionState: this.connection }; },
    sessions: {
      list: { getSnapshot: () => ({ byId: { one: {}, two: {}, broken: {} } }) },
      subagentAddress: () => undefined,
      retain(id, options) {
        if (id === 'broken') throw new Error('cannot retain');
        const gate = Promise.withResolvers(), stream = source({ openState: 'open', title: id });
        const face = source(null), conversation = source({ title: id });
        const binding = { session: { ...stream, projections: { faceOf: () => face } }, conversation };
        streams.set(id, { stream, face, conversation });
        const reference = { sessionId: id, source: options.source, binding, ready: gate.promise, released: 0,
          release() { this.released++; }, readyNow() { gate.resolve(binding); } };
        references.push(reference); return reference;
      },
    },
    conversations: { binding: binding => ({ target: () => binding.conversation }) },
  };
  return { model, references, streams };
}

test('较晚就绪的旧会话不能覆盖新选择，取消释放后也不能恢复订阅', async () => {
  const f = fixture(), ready = [], view = new RemoteSessionView(f.model, { onReady: id => ready.push(id) });
  const first = view.select('one'), a = f.references[0];
  const second = view.select('two'), b = f.references[1];
  b.readyNow(); await second;
  a.readyNow(); await first;
  assert.equal(view.getSnapshot().selected, 'two');
  assert.equal(view.getSnapshot().session.title, 'two');
  assert.equal(a.released, 1); assert.deepEqual(ready, ['two']);
  assert.equal(f.streams.get('one').stream.observers, 0);
  const third = view.select('one'), c = f.references[2];
  view.dispose(); c.readyNow(); await third;
  assert.equal(c.released, 1); assert.equal(b.released, 1);
  assert.equal(f.streams.get('one').stream.observers, 0);
  assert.equal(view.reference, null);
  assert.deepEqual(ready, ['two']);
});

test('主聊天独占 mainView 身份，独立视图不冒充主聊天且换页释放旧引用', async () => {
  const f = fixture(), main = new RemoteSessionView(f.model, { source: 'mainView' }), aside = new RemoteSessionView(f.model);
  const first = main.select('one'); f.references[0].readyNow(); await first;
  const side = aside.select('two'); f.references[1].readyNow(); await side;
  assert.equal(f.references[0].source, 'mainView');
  assert.equal(f.references[1].source, 'controllerOperation');
  await main.select(null); assert.equal(f.references[0].released, 1);
  assert.equal(f.references[1].released, 0);
  aside.dispose(); assert.equal(f.references[1].released, 1);
});

test('读取引用失败与离线导航保留原视图；父作用域释放取消所有投影订阅', async () => {
  const f = fixture(), view = new RemoteSessionView(f.model);
  const pending = view.select('one', { trail: ['root'] });
  f.references[0].readyNow(); await pending;
  const original = view.reference;
  await assert.rejects(view.select('broken'), /暂时无法打开/);
  f.model.connection = 'disconnected';
  await assert.rejects(view.select('two'), /电脑暂时离线/);
  assert.equal(view.reference, original);
  assert.deepEqual(view.getSnapshot().selectionTrail, ['root']);
  f.streams.get('one').stream.emit({ openState: 'open', title: '实时更新' });
  assert.equal(view.getSnapshot().session.title, '实时更新');
  f.model.lifetime.abort();
  assert.equal(original.released, 1);
  assert.equal(f.streams.get('one').stream.observers, 0);
  assert.equal(f.streams.get('one').face.observers, 0);
  assert.equal(f.streams.get('one').conversation.observers, 0);
  f.streams.get('one').stream.emit({ title: '迟到' });
  assert.equal(view.getSnapshot().session.title, '实时更新');
  view.subscribe(() => {}); assert.equal(view.listeners.size, 0);
});
