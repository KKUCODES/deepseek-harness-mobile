import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdinaryNative } from '../src/ordinary-native.mjs';
import { completionMessages } from '../src/ordinary-history.mjs';
import { OrdinaryTurn } from '../src/ordinary-stream.mjs';
import { fixtureChunk, fixtureEvent } from '../src/stream-fixtures.mjs';

function bridge(handler) {
  const calls = [];
  const endpoint = { postMessage(text) {
    const request = JSON.parse(text); calls.push(request);
    void Promise.resolve().then(() => handler(request)).then(data => endpoint.onmessage({ data: JSON.stringify({ id: request.id, ...data }) }));
  } };
  return { client: new OrdinaryNative(endpoint), calls };
}

test('native adapter requires Android and only sends the defined request, with no credential', async () => {
  await assert.rejects(new OrdinaryNative(null).status(), /android_required/);
  const { client, calls } = bridge(() => ({ error: 'key_missing' }));
  const turn = new OrdinaryTurn({ mode: 'ordinary', chatId: 'one', requestId: 'req' });
  const state = await turn.run(signal => client.open({ requestId: 'req', model: 'deepseek-flash', messages: [{ role: 'user', content: 'hello' }] }, signal));
  assert.equal(state.error, 'key_missing');
  assert.deepEqual(calls.map(call => call.op), ['request.open', 'request.cancel']);
  assert.deepEqual(Object.keys(calls[0].data).sort(), ['messages', 'model', 'requestId']);
});

test('native pull adapter passes bytes to real SSE parser and closes on DONE', async () => {
  const text = fixtureEvent(fixtureChunk({ content: '原生桥合成协议验证' })) + fixtureEvent(fixtureChunk({}, 'stop')) + 'data: [DONE]\n\n';
  let read = false;
  const { client, calls } = bridge(({ op }) => {
    if (op === 'request.open') return { data: { status: 200, contentType: 'text/event-stream' } };
    if (op === 'request.read') { assert.equal(read, false); read = true; return { data: { done: false, bytes: Buffer.from(text).toString('base64') } }; }
    return { data: {} };
  });
  const turn = new OrdinaryTurn({ mode: 'ordinary', chatId: 'one', requestId: 'req' });
  const state = await turn.run(signal => client.open({ requestId: 'req', model: 'deepseek-flash', messages: [] }, signal));
  assert.equal(state.status, 'completed');
  assert.equal(state.content, '原生桥合成协议验证');
  assert.equal(calls.filter(call => call.op === 'request.cancel').length, 1);
});

test('stop during native open cancels the owner and rejects late headers', async () => {
  let reply;
  const { client, calls } = bridge(({ op }) => op === 'request.open' ? new Promise(resolve => { reply = resolve; }) : { data: {} });
  const turn = new OrdinaryTurn({ mode: 'ordinary', chatId: 'one', requestId: 'req' });
  const run = turn.run(signal => client.open({ requestId: 'req', model: 'deepseek-flash', messages: [] }, signal));
  await new Promise(resolve => setImmediate(resolve));
  turn.stop();
  reply({ data: { status: 200, contentType: 'text/event-stream' } });
  assert.equal((await run).status, 'interrupted');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(call => call.op === 'request.read').length, 0);
  assert.equal(calls.filter(call => call.op === 'request.cancel').length, 1);
});

test('history context rejects Remote and excludes incomplete turns without replay', () => {
  const chat = { mode: 'ordinary', turns: [
    { prompt: 'A', content: 'B', status: 'completed' },
    { prompt: 'C', content: 'D', status: 'interrupted' },
  ] };
  assert.deepEqual(completionMessages(chat, 'E'), [{ role: 'user', content: 'A' }, { role: 'assistant', content: 'B' }, { role: 'user', content: 'E' }]);
  assert.throws(() => completionMessages({ ...chat, mode: 'remote' }, 'E'), /wrong_chat_mode/);
  assert.throws(() => completionMessages(chat, 'x'.repeat(240001)), /context_limit/);
});
