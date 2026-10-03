import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadRemoteFile, shareRemoteFile, downloadError } from '../src/remote-download.mjs';

function fixture() {
  const calls = [], received = [], controller = new AbortController();
  let bytes = 0;
  const client = { async call(op, data) {
    calls.push({ op, data });
    if (op === 'file.begin') return { downloadId: 'download-1' };
    if (op === 'file.chunk') { assert.equal(data.offset, bytes); const chunk = Buffer.from(data.data, 'base64'); received.push(chunk); bytes += chunk.length; return { bytes }; }
    if (op === 'file.save') return { saved: true };
    if (op === 'file.share') return { opened: true };
    return {};
  } };
  const files = { async *read(sessionId, path, signal, options) {
    assert.equal(sessionId, 'session-original'); assert.equal(path, 'C:/work/test.bin'); assert.equal(signal, controller.signal);
    assert.equal(options.maxBytes, 256 * 1024 * 1024);
    yield Uint8Array.from([0, 255, 1]); yield Uint8Array.from([2, 3]);
  } };
  const run = () => downloadRemoteFile({ files, client, sessionId: 'session-original', path: 'C:/work/test.bin', signal: controller.signal });
  return { calls, received, controller, client, files, run };
}

test('按原会话重新读取完整二进制，逐块确认后才允许系统保存', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { saved: true, bytes: 5 });
  assert.deepEqual(Buffer.concat(f.received), Buffer.from([0, 255, 1, 2, 3]));
  assert.deepEqual(f.calls.map(v => v.op), ['file.begin', 'file.chunk', 'file.chunk', 'file.finish', 'file.save', 'file.abort']);
  assert.equal(f.calls[0].data.name, 'test.bin');
  assert.equal(f.calls[3].data.bytes, 5);
});

test('分享重新读完整字节并检查版本，只确认系统面板打开；失败和取消不交付', async () => {
  const run = f => shareRemoteFile({ files: f.files, client: f.client, sessionId: 'session-original', path: 'C:/work/test.bin', signal: f.controller.signal });
  const f = fixture();
  assert.deepEqual(await run(f), { opened: true, bytes: 5 });
  assert.deepEqual(f.calls.map(v => v.op), ['file.begin', 'file.chunk', 'file.chunk', 'file.finish', 'file.share', 'file.abort']);
  const changed = fixture();
  changed.files.read = async function* () { yield Uint8Array.from([7]); throw new Error('remote_file_changed'); };
  await assert.rejects(run(changed), /remote_file_changed/);
  assert.equal(changed.calls.some(v => v.op === 'file.share'), false);
  const canceled = fixture(), call = canceled.client.call;
  canceled.client.call = async (op, data) => { const result = await call(op, data); if (op === 'file.finish') canceled.controller.abort(); return result; };
  await assert.rejects(run(canceled), error => error.name === 'AbortError');
  assert.equal(canceled.calls.some(v => v.op === 'file.share'), false);
  const failed = fixture(), original = failed.client.call;
  failed.client.call = async (op, data) => op === 'file.share' ? { saved: true } : original(op, data);
  await assert.rejects(run(failed), /download_failed/);
});

test('最终版本校验失败不能弹出保存，清理已写暂存', async () => {
  const f = fixture();
  f.files.read = async function* () { yield Uint8Array.from([7]); throw new Error('remote_file_changed'); };
  await assert.rejects(f.run(), /remote_file_changed/);
  assert.deepEqual(f.calls.map(v => v.op), ['file.begin', 'file.chunk', 'file.abort']);
});

test('取消时阻断后续块和保存；系统取消也不会宣称成功', async () => {
  const f = fixture(), call = f.client.call;
  f.client.call = async (op, data) => { const value = await call(op, data); if (op === 'file.chunk') f.controller.abort(); return value; };
  await assert.rejects(f.run(), error => error.name === 'AbortError');
  assert.equal(f.calls.some(v => v.op === 'file.finish' || v.op === 'file.save'), false);
  const canceled = fixture(), original = canceled.client.call;
  canceled.client.call = async (op, data) => { if (op === 'file.save') throw new Error('download_canceled'); return original(op, data); };
  await assert.rejects(canceled.run(), /download_canceled/);
  assert.equal(canceled.calls.at(-1).op, 'file.abort');
});

test('原生块确认不匹配时拒绝完成；空文件无块但仍完整保存', async () => {
  const f = fixture(), call = f.client.call;
  f.client.call = async (op, data) => op === 'file.chunk' ? { bytes: 999 } : call(op, data);
  await assert.rejects(f.run(), /download_incomplete/);
  assert.equal(f.calls.some(v => v.op === 'file.save'), false);
  const empty = fixture(); empty.files.read = async function* () { yield new Uint8Array(); };
  assert.deepEqual(await empty.run(), { saved: true, bytes: 0 });
  assert.deepEqual(empty.calls.map(v => v.op), ['file.begin', 'file.finish', 'file.save', 'file.abort']);
});

test('原生已确认保存或打开面板后，迟到取消不抹去已发生的交付', async () => {
  for (const share of [false, true]) {
    const f = fixture(), original = f.client.call;
    f.client.call = async (op, data) => {
      const result = await original(op, data);
      if (op === (share ? 'file.share' : 'file.save')) f.controller.abort();
      return result;
    };
    const result = share ? await shareRemoteFile({ files: f.files, client: f.client, sessionId: 'session-original', path: 'C:/work/test.bin', signal: f.controller.signal }) : await f.run();
    assert.deepEqual(result, share ? { opened: true, bytes: 5 } : { saved: true, bytes: 5 });
  }
});

test('完整字节已读完但原生finish等待时断线，恢复不能交付旧暂存', async () => {
  for (const share of [false, true]) {
    const f = fixture(), call = f.client.call, connection = new AbortController();
    f.files.scopedSignal = signal => AbortSignal.any([signal, connection.signal]);
    f.files.read = async function* () { yield Uint8Array.of(1, 2); };
    f.client.call = async (op, data) => { const value = await call(op, data); if (op === 'file.finish') connection.abort(); return value; };
    const run = share ? shareRemoteFile({ files: f.files, client: f.client, sessionId: 's', path: 'a', signal: f.controller.signal }) : f.run();
    await assert.rejects(run, /remote_file_connection_changed/);
    assert.equal(f.calls.some(call => ['file.save', 'file.share'].includes(call.op)), false);
    assert.equal(f.calls.at(-1).op, 'file.abort');
  }
});

test('目标半成品删除失败不被迟到取消或断线掩盖，也不自动重试保存', async () => {
  for (const mode of ['active', 'cancel', 'disconnect']) {
    const f = fixture(), call = f.client.call, connection = new AbortController();
    f.files.scopedSignal = signal => AbortSignal.any([signal, connection.signal]);
    f.files.read = async function* () { yield Uint8Array.of(1, 2); };
    f.client.call = async (op, data) => {
      const value = await call(op, data);
      if (op !== 'file.save') return value;
      if (mode === 'cancel') f.controller.abort();
      if (mode === 'disconnect') connection.abort();
      throw new Error('download_cleanup_failed');
    };
    await assert.rejects(f.run(), error => {
      assert.equal(error.message, 'download_cleanup_failed');
      assert.equal(downloadError(error), '保存未完成，目标位置可能留有不完整文件，请检查后重新下载。');
      return true;
    });
    assert.equal(f.calls.filter(item => item.op === 'file.save').length, 1);
    assert.equal(f.calls.at(-1).op, 'file.abort');
  }
});
