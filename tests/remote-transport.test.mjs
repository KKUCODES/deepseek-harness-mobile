import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteClient } from '../src/remote-client.mjs';
import { RemoteTransport } from '../src/remote-transport.mjs';
import { downloadRemoteFile } from '../src/remote-download.mjs';

function fixture() {
  const frames = [];
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw); if (message.data.frame) frames.push(message.data.frame);
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) }));
  } };
  const client = new RemoteClient(bridge);
  client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  const resources = [];
  const transport = new RemoteTransport(client, { fetchResource: async url => { resources.push(url); return new Response('script'); }, loadScript: async url => resources.push(url) });
  const reply = value => client.receive({ type: 'result', id: frames.at(-1).id, value });
  return { client, frames, resources, transport, reply, bridge };
}
async function negotiated() {
  const f = fixture(), negotiation = f.transport.negotiate();
  f.reply({ transport: 2, dshVersion: '0.1.6-alpha.2' }); await negotiation;
  return f;
}

test('载体重连后的订阅抢在能力确认前，不应使正在进行的确认失效', async () => {
  const f = await negotiated();
  f.client.receive({ type: 'closed' });
  f.client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  const generation = f.transport.generation, lifetime = f.transport.lifetime.signal;
  const negotiation = f.transport.negotiate();
  // RemoteApp 确认能力与原 Gateway 恢复只读订阅是两个真实调用入口。
  const stream = f.transport.stream('/api', '$events', { args: {} }, new AbortController().signal);
  await assert.rejects(stream.next(), /remote_not_connected/);
  f.reply({ transport: 2, dshVersion: '0.1.6-alpha.2' });
  await negotiation;
  assert.equal(f.transport.generation, generation);
  assert.equal(lifetime.aborted, false);
  assert.equal(f.transport.capabilities.dshVersion, '0.1.6-alpha.2');
  assert.equal(f.transport.hostOffline, false);
  assert.equal(f.frames.filter(frame => frame.operation.method === 'remote.stream').length, 0);
  f.transport.dispose();
});

for (const operation of ['subscription', 'rpc']) test(`电脑离线但手机socket仍在线时取消原生保存等待（${operation}）`, async () => {
  const f = await negotiated(), caller = new AbortController(), streamSignal = new AbortController();
  const native = [], saving = Promise.withResolvers();
  let saveId, bytes = 0;
  const original = f.bridge.postMessage;
  const respond = (id, data = {}, error) => queueMicrotask(() => f.bridge.onmessage({ data: JSON.stringify({ id, data, error }) }));
  f.bridge.postMessage = raw => {
    const message = JSON.parse(raw);
    if (!message.op.startsWith('file.')) return original(raw);
    native.push(message.op);
    if (message.op === 'file.save') { saveId = message.id; saving.resolve(); return; }
    if (message.op === 'file.abort' && saveId) { respond(saveId, {}, 'download_canceled'); saveId = undefined; }
    if (message.op === 'file.chunk') bytes += Buffer.from(message.data.data, 'base64').length;
    respond(message.id, message.op === 'file.begin' ? { downloadId: 'download-1' } : message.op === 'file.chunk' ? { bytes } : {});
  };
  const scope = f.transport.lifetime.signal;
  const files = { scopedSignal: signal => AbortSignal.any([signal, f.transport.lifetime.signal]),
    async *read() { yield Uint8Array.of(1, 2, 3); } };
  const outcome = downloadRemoteFile({ files, client: f.client, sessionId: 's', path: 'a.txt', signal: caller.signal })
    .then(value => ({ value }), error => ({ error }));
  let delayed;
  try {
    const pending = operation === 'subscription'
      ? f.transport.stream('/api', 'session/follow', { args: {} }, streamSignal.signal).next()
      : f.transport.call('/api', 'session/list', { args: {} });
    const id = f.frames.at(-1).id;
    delayed = f.transport.call('/api', 'session/list', { args: {} }).then(value => ({ value }), error => ({ error }));
    const delayedId = f.frames.at(-1).id;
    await saving.promise;
    assert.equal(native.at(-1), 'file.save');
    f.client.receive({ type: 'error', id, code: 'host_disconnected_outcome_unknown' });
    await assert.rejects(pending, /host_disconnected_outcome_unknown/);
    assert.equal(f.client.connected, true);
    assert.equal(scope.aborted, true);
    assert.equal((await outcome).error.message, 'remote_file_connection_changed');
    assert.equal(native.filter(op => op === 'file.save').length, 1);
    assert.ok(native.includes('file.abort'));
    const generation = f.transport.generation;
    const again = f.transport.call('/api', 'session/list', { args: {} });
    f.client.receive({ type: 'error', id: f.frames.at(-1).id, code: 'host_offline' });
    await assert.rejects(again, /host_offline/);
    assert.equal(f.transport.generation, generation);
    const recovered = f.transport.negotiate();
    f.reply({ transport: 2, dshVersion: '0.1.6-alpha.2' }); await recovered;
    assert.equal(f.transport.lifetime.signal.aborted, false);
    const recoveredScope = f.transport.lifetime.signal;
    f.client.receive({ type: 'error', id: delayedId, code: 'host_disconnected_outcome_unknown' });
    assert.equal((await delayed).error.message, 'host_disconnected_outcome_unknown');
    assert.equal(recoveredScope.aborted, false);
    assert.equal(f.transport.generation, generation);
    const disconnectedAgain = f.transport.call('/api', 'session/list', { args: {} });
    f.client.receive({ type: 'error', id: f.frames.at(-1).id, code: 'host_offline' });
    await assert.rejects(disconnectedAgain, /host_offline/);
    assert.equal(recoveredScope.aborted, true);
    assert.equal(f.transport.generation, generation + 1);
  } finally {
    caller.abort(); await outcome; streamSignal.abort(); f.client.reset(); await delayed; f.transport.dispose();
    assert.equal(f.client.pending.size, 0);
  }
});

test('通信版本和DSH版本不兼容分别拒绝，不能发布能力', async () => {
  for (const [value, code] of [
    [{ transport: 1, dshVersion: '0.1.6-alpha.2' }, 'unsupported_remote_version'],
    [{ transport: 2, dshVersion: 'unknown-version' }, 'unsupported_dsh_version'],
  ]) {
    const f = fixture();
    try {
      const request = f.transport.negotiate(); f.reply(value);
      await assert.rejects(request, error => error.message === code);
      assert.equal(f.transport.capabilities, undefined);
      await assert.rejects(f.transport.call('/api', 'session/list', {}), /remote_not_connected/);
      assert.equal(f.frames.length, 1);
    } finally { f.transport.dispose(); }
  }
});

test('原 DSH RPC 保留参数和结果，不伪装电脑本地连接', async () => {
  const f = await negotiated(), payload = { args: { request: { workspaceId: 'existing' } } };
  assert.equal(f.transport.hooks.ownsHost, false);
  const call = f.transport.hooks.rpc.call('/api', 'session/create', payload);
  assert.deepEqual(f.frames.at(-1).operation, { method: 'remote.rpc', endpoint: 'session/create', payload });
  f.reply({ ok: false, error: { code: 'workspace/not-found', message: 'missing', details: {} } });
  assert.equal((await call).error.code, 'workspace/not-found');
  await assert.rejects(f.transport.hooks.rpc.call('/local-admin', 'read', {}), /unsupported_remote_channel/);
});

for (const version of ['0.2.1-alpha.1', '0.2.1-alpha.2']) test(`${version}文件Client恢复原生字节，自有range下载与旧版保持base64，损坏附件拒绝`, async () => {
  const f = await negotiated();
  try {
    f.transport.capabilities.dshVersion = version;
    const bytes = Buffer.from('中文 🐳\0');
    const value = { absolutePath: '/work/a', version: 'v1', offset: 0, eof: true, bytes: bytes.length, data: bytes.toString('base64') };
    for (const native of [true, false]) {
      const payload = { args: { workspaceFileScopeId: 's', path: 'a', ...(native ? { options: { range: { offset: 0, length: 65536 } } } : { range: { offset: 0, length: 65536 } }) } };
      const call = f.transport.call('/api', 'workspaceFiles/readBytes', payload);
      f.reply({ ok: true, value });
      const result = await call;
      assert.deepEqual(result.value.data, native ? new Uint8Array(bytes) : value.data);
      assert.deepEqual(value.data, bytes.toString('base64'));
    }
    for (const data of ['bad', 'Zh==', Buffer.alloc(65537).toString('base64'), null]) {
      const call = f.transport.call('/api', 'workspaceFiles/readBytes', { args: { options: { range: { offset: 0, length: 1 } } } });
      f.reply({ ok: true, value: { ...value, data } });
      await assert.rejects(call, /invalid_remote_result/);
    }
    f.transport.capabilities.dshVersion = '0.1.6-alpha.2';
    const call = f.transport.call('/api', 'workspaceFiles/readBytes', { args: { options: {} } });
    f.reply({ ok: true, value });
    assert.equal((await call).value.data, value.data);
  } finally { f.transport.dispose(); }
});

test('主聊天和子会话提交将Android GMT转为UTC，保留其他时区和原请求', async () => {
  const f = await negotiated();
  try {
    for (const endpoint of ['session/prompt', 'subagents/prompt', 'session/create']) {
      for (const zone of ['GMT', '+00:00', '-00:00', '+08:00', 'UTC', 'Asia/Shanghai', 'America/New_York', 'CST', undefined]) {
        const payload = { args: { request: { clientTimeZone: zone, content: [{ type: 'text', text: 'hello' }] } } };
        const call = f.transport.call('/api', endpoint, payload);
        const actual = f.frames.at(-1).operation.payload.args.request;
        f.reply({ ok: true, value: {} }); await call;
        assert.equal(actual.clientTimeZone, endpoint !== 'session/create' && ['GMT', '+00:00', '-00:00'].includes(zone) ? 'UTC' : zone);
        assert.deepEqual(actual.content, payload.args.request.content);
        assert.equal(payload.args.request.clientTimeZone, zone);
      }
    }
  } finally { f.transport.dispose(); }
});

test('旧电脑不支持子会话图片通道时在发送前拒绝，不退回大帧 RPC', async () => {
  const f = await negotiated(); f.transport.capabilities.channels = ['prompt'];
  const before = f.frames.length;
  await assert.rejects(f.transport.call('/api', 'subagents/prompt', { args: { request: { content: [{ type: 'image' }] } } }), /向子会话发送图片/);
  assert.equal(f.frames.length, before);
  f.transport.dispose();
});

test('事件保持原始内容；断开之后报告未知结果，不自动重放', async () => {
  const f = await negotiated(), controller = new AbortController();
  const stream = f.transport.hooks.rpc.open('/api', '$events', { args: {} }, controller.signal);
  const initial = stream.next(), id = f.frames.at(-1).id;
  f.client.receive({ type: 'event', id, value: { type: 'ready', clientId: 'original' } });
  assert.deepEqual((await initial).value, { type: 'ready', clientId: 'original' });
  const next = stream.next();
  f.client.reset(); await assert.rejects(next, error => error.message === 'connection_closed_outcome_unknown' && error.dshRemoteStreamFailure?.kind === 'carrier');
  assert.equal(f.frames.filter(frame => frame.type === 'request').length, 2);
});

test('只将明确的 Host 断线标记为可恢复订阅，业务拒绝和写入保持失败', async () => {
  for (const code of ['host_offline', 'host_disconnected_outcome_unknown', 'device_revoked', 'remote_operation_denied', 'response_too_large']) {
    const f = await negotiated(), controller = new AbortController();
    try {
      const stream = f.transport.stream('/api', 'session/follow', { args: {} }, controller.signal);
      const next = stream.next();
      f.client.receive({ type: 'error', id: f.frames.at(-1).id, code });
      await assert.rejects(next, error => {
        assert.equal(error.message, code);
        assert.equal(error.dshRemoteStreamFailure?.kind, code.startsWith('host_') ? 'carrier' : undefined);
        return true;
      });
      const call = f.transport.call('/api', 'session/prompt', { args: {} });
      f.client.receive({ type: 'error', id: f.frames.at(-1).id, code });
      await assert.rejects(call, error => error.message === code && !error.dshRemoteStreamFailure);
      assert.equal(f.frames.filter(frame => frame.type === 'request').length, 3, '适配层不自行重试');
    } finally { f.transport.dispose(); }
  }
});

test('资源限于隔离 origin 的插件路径；认证字节交给原生层', async () => {
  const f = await negotiated();
  await f.transport.hooks.loadBundle('/plugins/known/client.js?rev=a');
  assert.equal(await (await f.transport.hooks.fetch('/plugins/known/chunk.js?rev=a')).text(), 'script');
  for (const url of ['/api/dsh-mobile', 'https://evil.example/plugins/a', '/plugins/../secret']) assert.throws(() => f.transport.hooks.fetch(url), /remote_resource_denied/);
  assert.throws(() => f.transport.hooks.fetch('/plugins/a', { method: 'POST' }), /remote_resource_denied/);
  assert.equal(f.resources.length, 2);
});

test('RPC 取消向 Host 取消在途请求，但不调用 session.cancel', async () => {
  const f = await negotiated(), controller = new AbortController();
  const pending = f.transport.hooks.rpc.call('/api', 'session/list', { args: {} }, controller.signal);
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.frames.at(-1).type, 'cancel');
  assert.equal(f.frames.some(frame => frame.operation?.method === 'session.cancel'), false);
});

test('断线或新连接清除上一代协商结果，旧资源与旧协商不能跨代复用', async () => {
  const f = await negotiated();
  f.client.receive({ type: 'closed' });
  assert.throws(() => f.transport.loadBundle('/plugins/a'), /remote_not_negotiated/);
  await assert.rejects(f.transport.call('/api', 'session/prompt', {}), /remote_not_connected/);
  await assert.rejects(f.transport.stream('/api', '$events', {}, new AbortController().signal).next(), error => error.dshRemoteStreamFailure?.kind === 'carrier');
  f.client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  const pending = f.transport.negotiate();
  f.reply({ transport: 2, dshVersion: '0.1.6-alpha.2' });
  // 回复已排入微任务，但生效之前连接代次被替换。
  f.client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  await assert.rejects(pending, /remote_generation_changed/);
  f.transport.dispose();
  assert.equal(f.client.listeners.size, 0);
});

test('Host世代取消后的迟到能力不能覆盖当前协商结果', async () => {
  const f = await negotiated(), controller = new AbortController();
  const original = f.transport.capabilities;
  const pending = f.transport.negotiate({ signal: controller.signal });
  const oldId = f.frames.at(-1).id;
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  f.client.receive({ type: 'result', id: oldId, value: { transport: 2, dshVersion: '0.1.6-alpha.2', jobControlGeneration: 'old-host' } });
  assert.equal(f.transport.capabilities, original);
  const current = f.transport.negotiate();
  f.reply({ transport: 2, dshVersion: '0.1.6-alpha.2', jobControlGeneration: 'new-host' }); await current;
  assert.equal(f.transport.capabilities.jobControlGeneration, 'new-host');
  f.transport.dispose();
});
