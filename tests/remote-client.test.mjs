import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteClient } from '../src/remote-client.mjs';

function setup() {
  const sent = [];
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw); sent.push(message);
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) }));
  } };
  const client = new RemoteClient(bridge);
  client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  return { client, sent };
}

test('Remote 请求只能使用已有协议；断线后的写请求结果未知且不重发', async () => {
  const { client, sent } = setup();
  assert.throws(() => client.request({ method: 'shell', command: 'never' }));
  const request = client.request({ method: 'session.prompt', sessionId: 'remote-test', requestId: crypto.randomUUID(), mode: 'queue', text: 'protocol fixture' });
  client.reset();
  await assert.rejects(request.promise, /connection_closed_outcome_unknown/);
  client.receive({ type: 'result', id: request.id, value: { accepted: true } });
  assert.equal(sent.length, 1);
  assert.equal(client.requests.size, 0);
  assert.equal(client.connected, false);
});

test('主动断开和非法协议与瞬时网络关闭分开，供页面阻止自动恢复', async () => {
  const { client } = setup(), events = [];
  client.subscribe(event => events.push(event));
  await client.disconnect(); assert.equal(events.at(-1).reason, 'user_disconnect');
  client.receive({ type: 'ready', protocol: 1 });
  client.receive({ type: 'invalid' }); assert.equal(events.at(-1).reason, 'invalid_protocol');
  client.receive({ type: 'closed', reason: 'device_revoked' }); assert.equal(events.at(-1).reason, 'device_revoked');
  client.receive({ type: 'closed' }); assert.equal(events.at(-1).reason, undefined);
});

test('Remote 订阅取消后忽略迟到记录，断线释放仍保留的订阅', async () => {
  const { client, sent } = setup();
  const events = [];
  const request = client.request({ method: 'session.follow', address: { kind: 'session', sessionId: 'remote-test' } }, value => events.push(value));
  client.receive({ type: 'event', id: request.id, value: { type: 'snapshot', records: [] } });
  request.cancel();
  client.receive({ type: 'event', id: request.id, value: { type: 'event', event: 'late' } });
  await request.promise;
  assert.equal(events.length, 1);
  assert.equal(sent.at(-1).data.frame.type, 'cancel');
  assert.equal(client.requests.size, 0);
  const current = client.request({ method: 'session.list' });
  client.receive({ type: 'ready', protocol: 999 });
  await assert.rejects(current.promise, /connection_closed/);
  assert.equal(client.connected, false);
});

test('页面卸载只释放聊天连接，只有主动断开才暂停应用提醒连接', async () => {
  const { client, sent } = setup(), events = [];
  client.subscribe(event => events.push(event));
  await client.release();
  assert.equal(sent.at(-1).op, 'socket.release');
  assert.equal(events.length, 0);
  await client.disconnect();
  assert.equal(sent.at(-1).op, 'socket.disconnect');
  assert.equal(events.at(-1).reason, 'user_disconnect');
});
