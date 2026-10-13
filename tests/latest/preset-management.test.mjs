import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RemotePresetManagement } from '../../src/remote-preset-management.mjs';

// 这里只验证客户端寿命和提交限制，真实鉴权/持久化由最新 Host→网关→Web/Android 覆盖。
function fixture() {
  let changed, finish, reject, cancelled = 0;
  const calls = [];
  const model = { lifetime: new AbortController(), transport: { capabilities: { presetProfileManagement: true, management: true } },
    connection: { state: { getSnapshot: () => 'connected' }, generation: { getSnapshot: () => ({ id: 1 }), subscribe(fn) { changed = fn; return () => {}; } } },
    client: { request(value) { calls.push(value); return { promise: new Promise((resolve, fail) => { finish = resolve; reject = fail; }), cancel() { cancelled++; } }; } } };
  return { model, calls, controller: new RemotePresetManagement(model), finish: value => finish(value), reject: error => reject(error), changed: () => changed(), cancelled: () => cancelled };
}
const view = () => ({ snapshot: randomUUID(), preset: 'standard', canCopy: true, canDelete: true });
async function read(f) { const operation = f.controller.read('standard'), result = view(); f.finish(result); await operation; return result; }

test('未授权与未协商不读取；复制只有服务器快照/新身份，删除必须明确确认', async () => {
  const f = fixture();
  try {
    f.model.transport.capabilities.management = false; await f.controller.read('standard');
    f.model.transport.capabilities.management = true; f.model.transport.capabilities.presetProfileManagement = false; await f.controller.read('standard');
    f.model.transport.capabilities.presetProfileManagement = true;
    for (const value of [null, {}, '../preset']) await f.controller.read(value);
    assert.equal(f.calls.length, 0);
    const current = await read(f);
    assert.equal(await f.controller.copy('../path', 'copy'), false);
    assert.equal(await f.controller.remove(false), false);
    assert.equal(f.calls.length, 1);
    const operation = f.controller.copy('copied', '新的模式');
    assert.deepEqual(f.calls[1], { method: 'remote.presetCopy', snapshot: current.snapshot, id: 'copied', name: '新的模式' });
    f.finish({ preset: 'copied', copied: true, deleted: false }); assert.equal(await operation, true);
    assert.equal(await f.controller.copy('another', 'Another'), false, '已消费快照不能重复提交');
  } finally { f.controller.dispose(); }
});

test('迟到读取和写入在关页、换连接、销毁后不发布，也不会自动重发', async () => {
  for (const action of ['clear', 'generation', 'dispose']) for (const writing of [false, true]) {
    const f = fixture();
    try {
      if (writing) await read(f);
      const operation = writing ? f.controller.remove(true) : f.controller.read('standard');
      const count = f.calls.length;
      action === 'generation' ? f.changed() : f.controller[action]();
      f.finish(writing ? { preset: 'standard', copied: false, deleted: true } : view());
      assert.equal(await operation, false);
      assert.deepEqual(f.controller.getSnapshot(), { busy: false, view: null, result: null, error: null });
      assert.equal(f.calls.length, count);
      assert.ok(f.cancelled() >= 1);
    } finally { f.controller.dispose(); }
  }
});

test('未知写入结果清掉快照，只能主动重新读取；不接受其他模式的响应', async () => {
  const f = fixture();
  try {
    await read(f);
    const writing = f.controller.remove(true); f.reject(Error('connection_closed_outcome_unknown'));
    assert.equal(await writing, false); assert.equal(f.controller.getSnapshot().view, null);
    assert.match(f.controller.getSnapshot().error, /尚未确认/);
    assert.equal(await f.controller.remove(true), false);
    const wrong = f.controller.read('standard'); f.finish({ ...view(), preset: 'other' }); await wrong;
    assert.equal(f.controller.getSnapshot().view, null);
    await read(f);
    const deleted = f.controller.remove(true); f.finish({ preset: 'standard', copied: false, deleted: true });
    assert.equal(await deleted, true);
  } finally { f.controller.dispose(); }
});
