import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteClient } from '../src/remote-client.mjs';
import { RemoteTransport } from '../src/remote-transport.mjs';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { IDBFactory } from 'fake-indexeddb';
import { draftBinding } from './fixtures/remote-draft-storage.mjs';

function fixture() {
  const frames = [], generation = crypto.randomUUID();
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw); if (message.data.frame) frames.push(message.data.frame);
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) }));
  } };
  const client = new RemoteClient(bridge); client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  const transport = new RemoteTransport(client);
  transport.capabilities = { pluginOperationGeneration: generation };
  transport.pluginOperations.interval = 1;
  const next = async method => {
    for (let count = 0; count < 200; count++) {
      const frame = frames.find(frame => !frame.used && frame.operation?.method === method);
      if (frame) { frame.used = true; return frame; }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    throw new Error(`No ${method}`);
  };
  const reply = (frame, value) => client.receive({ type: 'result', id: frame.id, value });
  return { client, transport, frames, generation, next, reply, close: () => { transport.dispose(); client.reset(); } };
}
const payload = { args: { spec: 'test-package', options: { requestId: crypto.randomUUID() } } };

test('原 RPC 接入短提交和结果查询，丢失响应并重连不会重复安装', async () => {
  const f = fixture();
  try {
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    const start = await f.next('remote.pluginOperationStart');
    assert.deepEqual(start.operation.payload, payload);
    f.client.reset(); // 接受写入后的响应丢失。
    f.client.receive({ type: 'ready', protocol: 1, hostOnline: true });
    const read = await f.next('remote.pluginOperationRead');
    assert.equal(read.operation.operationId, start.operation.operationId);
    assert.equal(read.operation.generation, f.generation);
    f.reply(read, { state: 'pending' });
    const result = { ok: false, error: { code: 'plugin/fixture', message: 'failure', details: {} } };
    f.reply(await f.next('remote.pluginOperationRead'), { state: 'complete', result });
    assert.deepEqual(await call, result);
    assert.equal(f.frames.filter(frame => frame.operation?.method === 'remote.pluginOperationStart').length, 1);
    assert.equal(f.frames.filter(frame => frame.operation?.method === 'remote.rpc').length, 0);
  } finally { f.close(); }
});

for (const code of ['plugin_operation_generation_changed', 'plugin_operation_missing', 'management_required']) {
  test(`查询 ${code} 明确失败，不重发写入`, async () => {
    const f = fixture();
    try {
      const call = f.transport.call('/api', 'pluginManager/installBundle', payload), rejected = assert.rejects(call, new RegExp(code));
      f.reply(await f.next('remote.pluginOperationStart'), { state: 'pending' });
      const read = await f.next('remote.pluginOperationRead');
      f.client.receive({ type: 'error', id: read.id, code }); await rejected;
      assert.equal(f.frames.filter(frame => frame.operation?.method === 'remote.pluginOperationStart').length, 1);
    } finally { f.close(); }
  });
}

test('收回权限结束查询；取消读取不调用原 cancelInstall，也不代表安装已取消', async () => {
  for (const revoke of [true, false]) {
    const f = fixture(), controller = new AbortController();
    try {
      const call = f.transport.call('/api', 'pluginManager/installBundle', payload, controller.signal);
      const rejected = assert.rejects(call);
      f.reply(await f.next('remote.pluginOperationStart'), { state: 'pending' });
      await f.next('remote.pluginOperationRead');
      if (revoke) f.client.receive({ type: 'closed', reason: 'permissions_changed' }); else controller.abort();
      await rejected;
      assert.equal(f.frames.some(frame => frame.operation?.endpoint === 'pluginManager/cancelInstall'), false);
      assert.equal(f.transport.pluginOperations.running.size, 0);
    } finally { f.close(); }
  }
});

test('电脑重启清空回执后仍展示已提交操作的未知结果，核心重建保留且绑定隔离', async () => {
  const f = fixture(); let rebuilt;
  try {
    f.transport.pluginOperations.setScope('computer-a:device-a');
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    const rejected = assert.rejects(call, /plugin_operation_generation_changed/);
    const start = await f.next('remote.pluginOperationStart');
    f.reply(start, { state: 'pending' });
    const read = await f.next('remote.pluginOperationRead');
    f.client.receive({ type: 'error', id: read.id, code: 'plugin_operation_generation_changed' });
    await rejected;
    f.transport.dispose();
    rebuilt = new RemoteTransport(f.client);
    rebuilt.pluginOperations.setScope('computer-a:device-a');
    const list = rebuilt.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: 'new-computer-run', items: [] });
    const result = await list;
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, start.operation.operationId);
    assert.equal(result.items[0].target, payload.args.spec);
    assert.equal(result.items[0].state, 'unknown');
    assert.equal(f.frames.filter(frame => frame.operation?.method === 'remote.pluginOperationStart').length, 1);
    rebuilt.pluginOperations.setScope('computer-b:device-b');
    const other = rebuilt.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: 'other-computer', items: [] });
    assert.deepEqual((await other).items, []);
  } finally { rebuilt?.dispose(); f.close(); }
});

test('列表刷新与安装完成交错，不把已确认结果误报为重启后未知', async () => {
  const f = fixture();
  try {
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    const start = await f.next('remote.pluginOperationStart'); f.reply(start, { state: 'pending' });
    const read = await f.next('remote.pluginOperationRead');
    const list = f.transport.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: f.generation, items: [{ id: start.operation.operationId,
      endpoint: start.operation.endpoint, target: payload.args.spec, state: 'pending', startedAt: Date.now() }] });
    assert.equal((await list).items[0].state, 'pending');
    f.reply(read, { state: 'complete', result: { ok: true, value: { application: 'applied' } } });
    await call;
    const afterRestart = f.transport.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: 'after-restart', items: [] });
    assert.deepEqual((await afterRestart).items, []);
  } finally { f.close(); }
});

test('本地未确认摘要不能绕过管理授权读取', async () => {
  const f = fixture();
  try {
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    const rejected = assert.rejects(call, /plugin_operation_generation_changed/);
    f.reply(await f.next('remote.pluginOperationStart'), { state: 'pending' });
    const read = await f.next('remote.pluginOperationRead');
    f.client.receive({ type: 'error', id: read.id, code: 'plugin_operation_generation_changed' }); await rejected;
    const list = f.transport.pluginOperations.list();
    const denied = assert.rejects(list, /management_required/);
    const frame = await f.next('remote.pluginOperations');
    f.client.receive({ type: 'error', id: frame.id, code: 'management_required' }); await denied;
  } finally { f.close(); }
});

test('旧列表晚于确定完成返回时，不能把操作降回进行中或结果未知', async () => {
  const f = fixture();
  try {
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    const start = await f.next('remote.pluginOperationStart'); f.reply(start, { state: 'pending' });
    const read = await f.next('remote.pluginOperationRead');
    const list = f.transport.pluginOperations.list();
    const listFrame = await f.next('remote.pluginOperations');
    f.reply(read, { state: 'complete', result: { ok: true, value: { application: 'cancelled' } } });
    await call;
    f.reply(listFrame, { generation: f.generation, items: [{ id: start.operation.operationId,
      endpoint: start.operation.endpoint, target: payload.args.spec, state: 'pending', startedAt: Date.now() }] });
    assert.equal((await list).items[0].state, 'complete');
    const after = f.transport.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: 'new-run', items: [] });
    assert.deepEqual((await after).items, []);
  } finally { f.close(); }
});

test('切换绑定后，旧电脑迟到的列表不能污染新绑定摘要', async () => {
  const f = fixture();
  try {
    f.transport.pluginOperations.setScope('old-binding');
    const list = f.transport.pluginOperations.list();
    const rejected = assert.rejects(list, /remote_generation_changed/);
    const frame = await f.next('remote.pluginOperations');
    f.transport.pluginOperations.setScope('new-binding');
    f.reply(frame, { generation: f.generation, items: [{ id: 'old-operation', state: 'pending', target: 'old-private-project', startedAt: Date.now() }] });
    await rejected;
    const current = f.transport.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: 'new-computer', items: [] });
    assert.deepEqual((await current).items, []);
  } finally { f.close(); }
});

test('手机与电脑都重启后，严格落盘的原编号恢复为未知，只有授权读取且不重发安装', async () => {
  const database = new IDBFactory(), store = await RemoteDraftStore.open(draftBinding, database, null);
  const first = fixture(); let id;
  try {
    first.transport.pluginOperations.setScope('same-binding', store);
    const call = first.transport.call('/api', 'pluginManager/installBundle', payload), rejected = assert.rejects(call);
    const start = await first.next('remote.pluginOperationStart'); id = start.operation.operationId;
    assert.equal(store.readPluginOperations()[0].id, id);
    first.reply(start, { state: 'pending' }); await first.next('remote.pluginOperationRead');
    first.transport.dispose(); await rejected; await first.transport.pluginOperations.settled();
  } finally { first.close(); store.close(); }
  const reopened = await RemoteDraftStore.open(draftBinding, database, null), next = fixture();
  try {
    next.transport.pluginOperations.setScope('same-binding', reopened);
    const list = next.transport.pluginOperations.list();
    next.reply(await next.next('remote.pluginOperations'), { generation: 'new-host', items: [] });
    assert.deepEqual((await list).items.map(item => [item.id, item.state]), [[id, 'unknown']]);
    assert.equal(next.frames.some(frame => frame.operation?.method === 'remote.pluginOperationStart'), false);
    const denied = next.transport.pluginOperations.list(), rejection = assert.rejects(denied, /management_required/);
    const frame = await next.next('remote.pluginOperations');
    next.client.receive({ type: 'error', id: frame.id, code: 'management_required' }); await rejection;
  } finally { next.close(); reopened.close(); }
});

test('摘要先严格提交再提交电脑写入，存储失败不发安装且不遗留虚假未知记录', async () => {
  const f = fixture(); let release, writes = 0;
  const store = { readPluginOperations: () => [], writePluginOperations: () => ++writes === 1
    ? new Promise(resolve => { release = resolve; }) : Promise.resolve() };
  try {
    f.transport.pluginOperations.setScope('delayed-binding', store);
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(f.frames.length, 0);
    release(); f.reply(await f.next('remote.pluginOperationStart'), { state: 'pending' });
    f.reply(await f.next('remote.pluginOperationRead'), { state: 'complete', result: { ok: true, value: {} } });
    await call;
    f.transport.pluginOperations.setScope('broken-binding', { readPluginOperations: () => [],
      writePluginOperations: () => Promise.reject(new Error('QuotaExceeded')) });
    await assert.rejects(f.transport.call('/api', 'pluginManager/installBundle', payload), /QuotaExceeded/);
    assert.equal(f.frames.filter(frame => frame.operation?.method === 'remote.pluginOperationStart').length, 1);
    assert.equal(f.transport.pluginOperations.journal.size, 0);
  } finally { f.close(); }
});

test('冷摘要重新核对电脑原回执后删除，原确认结果不被保存失败改成失败', async () => {
  const database = new IDBFactory(), store = await RemoteDraftStore.open(draftBinding, database, null), f = fixture();
  const pending = { id: crypto.randomUUID(), generation: f.generation, endpoint: 'pluginManager/installBundle',
    target: 'original-package', requestId: payload.args.options.requestId, state: 'pending', startedAt: Date.now() };
  await store.writePluginOperations([pending]);
  try {
    f.transport.pluginOperations.setScope('binding', store);
    const list = f.transport.pluginOperations.list();
    f.reply(await f.next('remote.pluginOperations'), { generation: f.generation, items: [{ ...pending, state: 'complete', ok: true }] });
    assert.equal((await list).items[0].state, 'complete'); assert.deepEqual(store.readPluginOperations(), []);
    const write = store.writePluginOperations.bind(store); let writes = 0;
    store.writePluginOperations = items => ++writes === 1 ? write(items) : Promise.reject(new Error('disk-full'));
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload);
    f.reply(await f.next('remote.pluginOperationStart'), { state: 'pending' });
    const original = { ok: true, value: { application: 'applied' } };
    f.reply(await f.next('remote.pluginOperationRead'), { state: 'complete', result: original });
    assert.deepEqual(await call, original);
  } finally { f.close(); store.close(); }
});

test('保存摘要期间切换绑定不提交旧安装；迟到保存不能返回新绑定记录', async () => {
  const f = fixture(); let release;
  try {
    f.transport.pluginOperations.setScope('old', { readPluginOperations: () => [],
      writePluginOperations: () => new Promise(resolve => { release = resolve; }) });
    const call = f.transport.call('/api', 'pluginManager/installBundle', payload), rejected = assert.rejects(call, /remote_generation_changed/);
    f.transport.pluginOperations.setScope('new'); release();
    // finally 仍写旧存储，等它实际结算后才结束生命周期。
    await new Promise(resolve => setTimeout(resolve, 0)); release(); await rejected;
    assert.equal(f.frames.length, 0);
    let finish;
    f.transport.pluginOperations.setScope('new', { writePluginOperations: () => new Promise(resolve => { finish = resolve; }) });
    const list = f.transport.pluginOperations.list(), failure = assert.rejects(list, /remote_generation_changed/);
    f.reply(await f.next('remote.pluginOperations'), { generation: f.generation, items: [] });
    await new Promise(resolve => setTimeout(resolve, 0));
    f.transport.pluginOperations.setScope('third'); finish(); await failure;
  } finally { f.close(); }
});
