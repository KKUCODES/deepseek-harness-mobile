import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RemoteModelProbe } from '../src/remote-model-probe.mjs';

const target = { baseURL: 'http://127.0.0.1:12345/v1', api: 'openai-completions', authentication: { mode: 'none' } };
function fixture() {
  const calls = [], native = [], state = { generation: 1, connected: true, delayed: null };
  const model = { lifetime: new AbortController(), transport: { capabilities: { management: true, providerModelProbe: true } },
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => state.connected ? 'connected' : 'disconnected' } },
    client: { request(operation) {
      calls.push(operation);
      const value = operation.method === 'remote.modelProbePrepare' ? { snapshot: randomUUID(), expiresAt: Date.now() + 300000, ...target } : { rows: [{ id: 'candidate' }] };
      return { promise: state.delayed ? state.delayed : Promise.resolve(value), cancel() {} };
    }, async call(op, data) { native.push({ op, data }); return state.delayed ?? { rows: [{ id: 'candidate' }] }; } },
  };
  return { model, state, calls, native, service: new RemoteModelProbe(model) };
}
test('准备后确认执行，禁止变更对象与重复执行', async () => {
  const f = fixture(), view = await f.service.prepare(target);
  assert.deepEqual(await f.service.execute(view), { rows: [{ id: 'candidate' }] });
  assert.deepEqual(Object.keys(f.calls[1]).sort(), ['confirmed', 'method', 'mode', 'snapshot']);
  await assert.rejects(f.service.execute(view)); assert.equal(f.calls.length, 2);
  const next = await f.service.prepare(target);
  await assert.rejects(f.service.execute({ ...next })); assert.equal(f.calls.length, 3);
});
test('临时Key只走原生目标调用，页面不能传入Key或headers', async () => {
  const f = fixture();
  await f.service.temporary({ baseURL: target.baseURL, api: target.api });
  assert.deepEqual(f.native, [{ op: 'modelProbe.temporary', data: { baseURL: target.baseURL, api: target.api } }]);
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.service.temporary({ ...target, apiKey: 'forbidden' }));
  await assert.rejects(f.service.temporary({ ...target, headers: {} }));
  assert.equal(f.native.length, 1);
});
test('断线或权限收回拒绝迟到结果，旧能力不发请求', async () => {
  const f = fixture(); let finish;
  f.state.delayed = new Promise(resolve => { finish = resolve; });
  const pending = f.service.temporary({ baseURL: target.baseURL, api: target.api });
  f.state.generation++; finish({ rows: [] }); await assert.rejects(pending);
  f.model.transport.capabilities.providerModelProbe = false;
  await assert.rejects(f.service.prepare(target)); assert.equal(f.calls.length, 0);
});
test('取消临时窗口发原生cancel且不采纳返回候选', async () => {
  const f = fixture(); let finish;
  f.state.delayed = new Promise(resolve => { finish = resolve; });
  const controller = new AbortController();
  const pending = f.service.temporary({ baseURL: target.baseURL, api: target.api }, controller.signal);
  controller.abort(); finish({ cancelled: true }); await assert.rejects(pending);
  assert.equal(f.native.at(-1).op, 'modelProbe.cancel');
});
