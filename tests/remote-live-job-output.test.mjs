import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteLiveJobOutput } from '../src/remote-live-job-output.mjs';

function fixture(latest = false) {
  const target = { id: 'job', sessionId: 'own', startedAt: 1 }, events = new Set(), requests = [];
  const state = { selected: 'own', session: { openState: 'open' }, connectionState: 'connected', list: { jobsBySession: { own: [target] } } };
  if (latest) { state.jobs = { rows: { own: [target] }, observed: {} }; delete state.list.jobsBySession; }
  let connection = 1;
  const model = { getSnapshot: () => state, subscribe(fn) { events.add(fn); return () => events.delete(fn); },
    transport: { capabilities: { jobControlGeneration: 'host', jobOutput: true } }, connection: { generation: { getSnapshot: () => ({ id: connection }) } },
    client: { request(operation) { const value = Promise.withResolvers(); const task = { operation, ...value, cancel() { task.cancelled = true; value.resolve(); } }; requests.push(task); return task; } } };
  return { model, target, state, requests, events, reconnect() { connection++; for (const fn of events) fn(); } };
}
function chunk(bytes, startOffset, totalBytes, status = 'running', lossy = false) {
  return { state: 'available', status, data: Buffer.from(bytes).toString('base64'), startOffset, nextOffset: startOffset + bytes.length, totalBytes, lossy };
}

test('新版环形输出坐标跳过另一通道，跨页 UTF-8 保留且未协商格式拒绝', async () => {
  const f = fixture(true); f.model.transport.capabilities.jobOutputCoordinates = 'ring';
  const reader = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history');
  const bytes = Buffer.from('中');
  try {
    const first = reader.read();
    f.requests.at(-1).resolve({ ...chunk(bytes.subarray(0, 2), 0, 8), coordinate: 'ring', nextOffset: 6, skippedBytes: 4, producerGap: false });
    await first; assert.equal(reader.snapshot.text, ''); assert.equal(reader.snapshot.offset, 6);
    const second = reader.read();
    f.requests.at(-1).resolve({ ...chunk(bytes.subarray(2), 6, 8, 'completed'), coordinate: 'ring', nextOffset: 8, skippedBytes: 1, producerGap: false });
    await second; assert.equal(reader.snapshot.text, '中'); assert.equal(reader.snapshot.phase, 'ended');
    f.model.transport.capabilities.jobOutputCoordinates = undefined;
    const invalid = reader.read();
    f.requests.at(-1).resolve({ ...chunk(Buffer.alloc(0), 8, 8), coordinate: 'ring', skippedBytes: 0, producerGap: false });
    await invalid; assert.equal(reader.snapshot.phase, 'error');
  } finally { reader.dispose(); }
});

test('新版环形输出拒绝伪造跳过量，生产者缺口仍明确展示', async () => {
  const f = fixture(true); f.model.transport.capabilities.jobOutputCoordinates = 'ring';
  const reader = new RemoteLiveJobOutput(f.model, f.target, 'stderr', 'history');
  try {
    const first = reader.read();
    f.requests.at(-1).resolve({ ...chunk(Buffer.from('tail'), 0, 4), coordinate: 'ring', skippedBytes: 0, producerGap: true });
    await first; assert.equal(reader.snapshot.gap, true); assert.equal(reader.snapshot.text, 'tail');
    const next = reader.read();
    f.requests.at(-1).resolve({ ...chunk(Buffer.from('x'), 4, 5), coordinate: 'ring', skippedBytes: 1, producerGap: false });
    await next; assert.equal(reader.snapshot.phase, 'error'); assert.equal(reader.timer, null);
  } finally { reader.dispose(); }
});

test('手机独立游标连续解码跨分片中文，分段读取完整内容', async () => {
  const f = fixture(), reader = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history');
  try {
    const bytes = Buffer.from('开始🙂中文结束'); let text = '';
    for (let offset = 0; offset < bytes.length; offset += 2) {
      const read = reader.read(); assert.equal(f.requests.at(-1).operation.fromByte, offset);
      f.requests.at(-1).resolve(chunk(bytes.subarray(offset, offset + 2), offset, bytes.length, 'completed'));
      await read; text += reader.snapshot.text;
    }
    assert.equal(text, bytes.toString()); assert.equal(reader.snapshot.phase, 'ended');
    assert.equal(f.requests[0].operation.method, 'remote.jobOutput');
  } finally { reader.dispose(); }
});

test('断线和卸载取消在途请求，迟到结果不能覆盖保留输出；不会自动重发', async () => {
  const f = fixture(), reader = new RemoteLiveJobOutput(f.model, f.target);
  reader.start(); const first = f.requests[0]; f.reconnect();
  assert.equal(first.cancelled, true); assert.equal(reader.snapshot.phase, 'error');
  first.resolve(chunk(Buffer.from('late'), 0, 4)); await Promise.resolve(); await Promise.resolve();
  assert.equal(reader.snapshot.text, ''); assert.equal(f.requests.length, 1); reader.dispose(); assert.equal(f.events.size, 0);
});

test('缺口可见，拒绝超界和伪造字节范围，错误不轮询', async () => {
  const f = fixture(), reader = new RemoteLiveJobOutput(f.model, f.target, 'stderr', 'history');
  const read = reader.read(); f.requests[0].resolve(chunk(Buffer.from('tail'), 20, 24, 'completed', true)); await read;
  assert.equal(reader.snapshot.gap, true); assert.equal(reader.snapshot.text, 'tail');
  const next = reader.read(); f.requests[1].resolve({ ...chunk(Buffer.from('x'), 24, 25), nextOffset: 26 }); await next;
  assert.equal(reader.snapshot.phase, 'error'); assert.equal(reader.timer, null); reader.dispose();
});

test('切换会话或同 id 重建任务后不可读取，旧服务明确不支持', async () => {
  const f = fixture(), reader = new RemoteLiveJobOutput(f.model, f.target);
  f.state.list.jobsBySession.own = [{ ...f.target, startedAt: 2 }]; await reader.read();
  assert.equal(f.requests.length, 0); assert.match(reader.snapshot.error, /任务已变化/); reader.dispose();
});

test('卸载重建保留阅读位置和 UTF-8 半字符，用户确认后续读，旧 Host 不可继续', async () => {
  const f = fixture(), first = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history');
  const bytes = Buffer.from('A中文🙂B');
  const read = first.read(); f.requests[0].resolve(chunk(bytes.subarray(0, 3), 0, bytes.length)); await read;
  assert.equal(first.snapshot.text, 'A');
  const saved = first.checkpoint(); first.dispose(); f.reconnect();
  const next = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history', saved);
  next.start(); assert.equal(next.snapshot.text, 'A'); assert.equal(f.requests.length, 1);
  assert.equal(next.snapshot.phase, 'paused'); assert.equal(next.snapshot.error, '');
  const retry = next.retry(); assert.equal(f.requests[1].operation.fromByte, 3);
  f.requests[1].resolve(chunk(bytes.subarray(3), 3, bytes.length, 'completed')); await retry;
  assert.equal(next.snapshot.text, '中文🙂B');
  const end = next.checkpoint(); next.dispose();
  f.model.transport.capabilities.jobControlGeneration = 'different-host';
  const stale = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history', end);
  stale.start(); await stale.retry(); assert.equal(f.requests.length, 2); assert.match(stale.snapshot.error, /任务已变化/); stale.dispose();
});

test('切页交接暂停读取而非连接错误，断线仍优先提示并禁止续读', async () => {
  const f = fixture(), first = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history');
  const reading = first.read(); f.requests[0].resolve(chunk(Buffer.from('saved'), 0, 5)); await reading;
  const saved = first.checkpoint(); first.dispose();
  const restored = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history', saved);
  try {
    restored.start();
    assert.equal(restored.snapshot.phase, 'paused'); assert.equal(restored.snapshot.error, '');
    assert.equal(restored.snapshot.text, 'saved'); assert.equal(f.requests.length, 1);
    f.state.connectionState = 'disconnected';
    for (const listener of f.events) listener();
    assert.equal(restored.snapshot.phase, 'error'); assert.match(restored.snapshot.error, /连接已断开/);
    await restored.retry(); assert.equal(f.requests.length, 1);
    assert.equal(restored.snapshot.text, 'saved');
  } finally { restored.dispose(); }
});

test('网络重连后手动重试从已确认字节续读；电脑重启代次变化不能续接旧任务', async () => {
  const f = fixture(), reader = new RemoteLiveJobOutput(f.model, f.target, 'stdout', 'history');
  reader.start(); f.requests[0].resolve(chunk(Buffer.from('first'), 0, 10));
  await Promise.resolve(); await Promise.resolve();
  f.reconnect(); assert.equal(reader.snapshot.phase, 'error');
  const retry = reader.retry();
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].operation.fromByte, 5);
  f.requests[1].resolve(chunk(Buffer.from('later'), 5, 10, 'completed')); await retry;
  assert.equal(reader.snapshot.text, 'later'); assert.equal(reader.snapshot.phase, 'ended');
  f.reconnect(); const eof = reader.retry();
  f.requests[2].resolve(chunk(Buffer.alloc(0), 10, 10, 'completed')); await eof;
  assert.equal(reader.snapshot.text, 'later');
  f.model.transport.capabilities.jobControlGeneration = 'new-host';
  f.reconnect(); await reader.retry();
  assert.equal(f.requests.length, 3); assert.match(reader.snapshot.error, /任务已变化/); reader.dispose();
});
