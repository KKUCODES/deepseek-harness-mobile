import test from 'node:test';
import assert from 'node:assert/strict';
import { readSessionExport, downloadSessionExport } from '../src/remote-session-export.mjs';

function fixture() {
  let event, resolve, reject, canceled = false, bytes = 0;
  const calls = [], controller = new AbortController();
  const model = { transport: { capabilities: { sessionExport: true } }, client: {
    request(operation, accept) {
      assert.deepEqual(operation, { method: 'remote.sessionExport', sessionId: 'test', includeDescendants: true }); event = accept;
      return { id: 'export', promise: new Promise((yes, no) => { resolve = yes; reject = no; }), cancel() { canceled = true; } };
    },
    async call(op, data) {
      calls.push({ op, data });
      if (op === 'file.begin') return { downloadId: 'cache' };
      if (op === 'file.chunk') { bytes += Buffer.from(data.data, 'base64').length; return { bytes }; }
      if (op === 'file.save') return { saved: true };
      return {};
    },
  } };
  return { model, controller, calls, emit: value => event(value), end: value => resolve(value), fail: () => reject(new Error('connection_closed_outcome_unknown')),
    canceled: () => canceled, reader: () => readSessionExport(model, 'test', true, controller.signal),
    download: () => downloadSessionExport({ model, sessionId: 'test', includeDescendants: true, signal: controller.signal }) };
}
const metadata = { type: 'metadata', sessionId: 'test', includeDescendants: true };
const chunk = { type: 'chunk', offset: 0, data: 'UEsDBA==' };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('原生写入后才确认资源块，成功 end 后才允许保存 ZIP', async () => {
  const f = fixture(), work = f.download();
  await tick(); f.emit(metadata); f.emit(chunk); await tick();
  assert.deepEqual(f.calls.map(item => item.op), ['file.begin', 'file.chunk', 'socket.send']);
  f.end(); assert.deepEqual(await work, { saved: true, bytes: 4 });
  assert.deepEqual(f.calls.slice(-3).map(item => item.op), ['file.finish', 'file.save', 'file.abort']);
  assert.equal(f.calls[0].data.name, 'session-log.zip'); assert.equal(f.canceled(), true);
});

test('错误坐标、重复元数据、无效字节和非流响应不会保存', async () => {
  for (const frames of [[{ ...metadata, sessionId: 'other' }], [metadata, metadata], [metadata, { ...chunk, offset: 2 }],
    [metadata, { ...chunk, data: 'bad!' }], [metadata, { ...chunk, data: '' }], []]) {
    const f = fixture(), work = f.download(), rejected = assert.rejects(work, /remote_export_invalid/);
    await tick(); for (const frame of frames) f.emit(frame); f.end(); await rejected;
    assert.equal(f.calls.some(item => item.op === 'file.finish' || item.op === 'file.save'), false);
  }
  const f = fixture(), iterator = f.reader(), work = iterator.next(); f.end({ ok: true });
  await assert.rejects(work, /remote_export_invalid/);
});

test('消费暂停时不确认，取消和断线中断等待，迟到数据不能完成导出', async () => {
  const f = fixture(), iterator = f.reader(), first = iterator.next();
  f.emit(metadata); f.emit(chunk); assert.equal((await first).value.length, 4);
  assert.equal(f.calls.length, 0);
  f.controller.abort(); await assert.rejects(iterator.next(), { name: 'AbortError' }); assert.equal(f.canceled(), true);
  for (const abort of [true, false]) {
    const pending = fixture(), work = pending.download(), rejected = assert.rejects(work);
    await tick(); pending.emit(metadata); pending.emit(chunk); await tick();
    abort ? pending.controller.abort() : pending.fail(); await rejected;
    assert.equal(pending.calls.some(item => item.op === 'file.save'), false);
  }
});

test('超出信用窗口拒绝堆积，未协商能力不发请求', async () => {
  const f = fixture(), iterator = f.reader(), work = iterator.next();
  f.emit(metadata); for (let i = 0; i < 6; i++) f.emit({ ...chunk, offset: i * 4 });
  await assert.rejects(work, /remote_export_invalid/);
  const old = fixture(); old.model.transport.capabilities = {};
  await assert.rejects(old.reader().next(), /remote_export_unavailable/);
});
