import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteFiles, FILE_CHUNK_BYTES, PREVIEW_BYTES } from '../src/remote-files.mjs';

function fixture(bytes, change = () => {}) {
  const calls = [], signal = new AbortController().signal;
  const stat = { absolutePath: 'C:\\project\\中文.txt', version: 'v1', bytes: bytes.length };
  const files = new RemoteFiles(async (endpoint, args, receivedSignal) => {
    calls.push({ endpoint, args }); assert.equal(receivedSignal, signal);
    const range = args.range;
    const value = endpoint.endsWith('/stat') ? { ...stat } : { ...stat, offset: range.offset,
      data: bytes.subarray(range.offset, range.offset + range.length).toString('base64'), eof: range.offset + range.length >= bytes.length };
    change(value, endpoint, calls);
    return { ok: true, value };
  });
  return { files, calls, signal };
}

test('原字节窗跨块解码中文，保持原会话与完整换行，首尾校验版本', async () => {
  const text = `${'x'.repeat(FILE_CHUNK_BYTES - 1)}中文\r\n末尾\n`;
  const f = fixture(Buffer.from(text));
  assert.equal(await f.files.text('session-A', '中文.txt', f.signal), text);
  assert.deepEqual(f.calls.map(call => call.endpoint), ['workspaceFiles/stat', 'workspaceFiles/readBytes', 'workspaceFiles/readBytes', 'workspaceFiles/stat']);
  assert.deepEqual(f.calls[1].args, { workspaceFileScopeId: 'session-A', path: '中文.txt', range: { offset: 0, length: FILE_CHUNK_BYTES } });
});

test('读取中与读完后发生版本变化均拒绝发布完整内容', async () => {
  for (const point of ['chunk', 'final']) {
    const f = fixture(Buffer.from('original'), (value, endpoint, calls) => {
      if (point === 'chunk' ? endpoint.endsWith('/readBytes') : calls.length === 3) value.version = 'v2';
    });
    await assert.rejects(f.files.text('session-A', 'file', f.signal), /remote_file_changed/);
  }
});

test('拒绝错误偏移、无进展、提前 eof、损坏 base64 和超出窗大小的结果', async () => {
  const mutations = [v => { v.offset = 2; }, v => { v.data = ''; v.eof = false; }, v => { v.eof = false; }, v => { v.data = 'bad!'; }, v => { v.data = Buffer.alloc(FILE_CHUNK_BYTES + 1).toString('base64'); }];
  for (const mutate of mutations) {
    const f = fixture(Buffer.from('hello'), (v, endpoint) => { if (endpoint.endsWith('/readBytes')) mutate(v); });
    await assert.rejects(f.files.text('s', 'p', f.signal), /remote_file_(invalid|changed)/);
  }
});

test('过大预览不读取正文；二进制与损坏 UTF-8 不伪装为文字', async () => {
  const large = fixture(Buffer.alloc(PREVIEW_BYTES + 1));
  await assert.rejects(large.files.text('s', 'p', large.signal), /remote_file_preview_too_large/);
  assert.equal(large.calls.length, 1);
  for (const data of [Buffer.from([0, 1]), Buffer.from([0xff])]) {
    const f = fixture(data);
    await assert.rejects(f.files.text('s', 'p', f.signal), /remote_file_not_text/);
  }
});

test('权限/删除错误原样上抛；取消后迟到数据不能形成成功结果', async () => {
  const denied = new Error('denied'); denied.code = 'fs/access-denied';
  const reader = new RemoteFiles(async () => ({ ok: false, error: denied }));
  await assert.rejects(reader.text('s', 'p', new AbortController().signal), error => error === denied);
  let finish;
  const controller = new AbortController();
  const pending = new RemoteFiles(() => new Promise(resolve => { finish = resolve; }));
  const task = pending.text('s', 'p', controller.signal);
  controller.abort(); finish({ ok: true, value: {} });
  await assert.rejects(task, error => error.name === 'AbortError');
});

test('空文件仍执行读权限检查并返回空文本', async () => {
  const f = fixture(Buffer.alloc(0));
  assert.equal(await f.files.text('s', 'p', f.signal), '');
  assert.equal(f.calls.filter(call => call.endpoint.endsWith('/readBytes')).length, 1);
});

test('读者暂停期间连接换代，旧读取不能在新连接继续拼接；新的读取可成功', async () => {
  let connection = new AbortController();
  const data = Buffer.alloc(FILE_CHUNK_BYTES + 1, 42), calls = [];
  const info = { absolutePath: '/work/a.bin', version: 'unchanged', bytes: data.length };
  const files = new RemoteFiles(async (endpoint, args) => {
    calls.push(endpoint);
    return { ok: true, value: endpoint.endsWith('/stat') ? info : { ...info, offset: args.range.offset,
      data: data.subarray(args.range.offset, args.range.offset + args.range.length).toString('base64'),
      eof: args.range.offset + args.range.length >= data.length } };
  }, signal => AbortSignal.any([signal, connection.signal]));
  const signal = new AbortController().signal, reader = files.read('session', 'a.bin', signal);
  assert.equal((await reader.next()).value.length, FILE_CHUNK_BYTES);
  connection.abort(); connection = new AbortController();
  await assert.rejects(reader.next(), error => error.name === 'AbortError');
  assert.equal(calls.length, 2, '旧读取不得在新连接发第二块或尾部stat');
  assert.deepEqual(await files.bytes('session', 'a.bin', signal), new Uint8Array(data));
});

test('HTML 文档的字节与目录来自同一版本，收集依赖后必须再次核对主文档', async () => {
  const bytes = Buffer.from('<h1>preview</h1>');
  const f = fixture(bytes);
  const document = await f.files.document('s', 'view.html', f.signal);
  assert.deepEqual(document.data, new Uint8Array(bytes));
  assert.equal(document.absolutePath, 'C:\\project\\中文.txt');
  assert.equal(document.version, 'v1');
  await f.files.assertVersion('s', 'view.html', document, f.signal);

  // 目录快照之后、正文读取之前替换文件，不能拼接旧目录和新正文。
  const replaced = fixture(bytes, (value, _endpoint, calls) => { if (calls.length > 1) value.version = 'v2'; });
  await assert.rejects(replaced.files.document('s', 'view.html', replaced.signal), /remote_file_changed/);
  let dependencyRead = false;
  const changed = fixture(bytes, value => { if (dependencyRead) value.version = 'v2'; });
  const initial = await changed.files.document('s', 'view.html', changed.signal);
  dependencyRead = true;
  await assert.rejects(changed.files.assertVersion('s', 'view.html', initial, changed.signal), /remote_file_changed/);
});

test('图片完整字节保持二进制，发布前仍核对版本并执行预览上限', async () => {
  const data = Buffer.alloc(FILE_CHUNK_BYTES + 11);
  for (let i = 0; i < data.length; i++) data[i] = i % 256;
  const f = fixture(data);
  assert.deepEqual(await f.files.bytes('s', 'p.png', f.signal), new Uint8Array(data));
  const changed = fixture(data, (value, endpoint, calls) => { if (endpoint.endsWith('/stat') && calls.length > 1) value.version = 'v2'; });
  await assert.rejects(changed.files.bytes('s', 'p.png', changed.signal), /remote_file_changed/);
  const large = fixture(data);
  await assert.rejects(large.files.bytes('s', 'p.png', large.signal, { maxBytes: 12 }), /remote_file_preview_too_large/);
  assert.equal(large.calls.length, 1);
});
