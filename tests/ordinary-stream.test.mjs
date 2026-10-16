import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { OrdinaryTurn, readCompletionEvents } from '../src/ordinary-stream.mjs';
import { fixtureChunk as chunk, fixtureEvent as event, fixtureText, fixtureReasoning, replayResponse } from '../src/stream-fixtures.mjs';

const turn = (chatId = 'ordinary-test', requestId = 'request-test') => new OrdinaryTurn({ mode: 'ordinary', chatId, requestId });
const response = text => new Response(text, { headers: { 'content-type': 'text/event-stream' } });
const run = async text => turn().run(() => response(text));
const complete = event(chunk({ content: '正文' }, 'stop')) + event('[DONE]');

test('OpenAI standalone usage chunk after finish preserves content and still requires DONE', async () => {
  const first = chunk({ content: '正文' }, 'stop');
  const usage = { id: JSON.parse(first).id, object: 'chat.completion.chunk', choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } };
  const result = await run(event(first) + event(JSON.stringify(usage)) + event('[DONE]'));
  assert.equal(result.status, 'completed'); assert.equal(result.content, '正文');
  assert.deepEqual(result.usage, usage.usage);
  assert.equal((await run(event(JSON.stringify(usage)) + event('[DONE]'))).error, 'invalid_chunk');
});

test('UTF-8 逐字节分片，推理与正文分开，收到结束原因和 DONE 才完成', async () => {
  const request = turn();
  const states = [];
  request.subscribe(() => states.push(request.getSnapshot().status));
  const result = await request.run(() => replayResponse('complete', { delayMs: 0, packetBytes: 1 }));
  assert.equal(result.content, fixtureText);
  assert.equal(result.reasoning, fixtureReasoning);
  assert.equal(result.status, 'completed');
  assert.deepEqual([...new Set(states)], ['sending', 'streaming', 'completed']);
  assert.deepEqual(result.usage, { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 });
  assert.throws(() => { result.usage.total_tokens = 0; }, TypeError);
  await assert.rejects(request.run(() => response(complete)), /turn_already_used/);
});

test('标准 SSE 支持 BOM、CR/LF/CRLF、注释、多 data 行；EOF 未终止事件不派发', async () => {
  for (const eol of ['\r', '\n', '\r\n']) {
    const wire = '\uFEFF: keepalive' + eol + 'id: x' + eol + 'data: one' + eol + 'data: two' + eol + eol + 'data: [DONE]' + eol + eol;
    const parts = new TextEncoder().encode(wire);
    const body = new ReadableStream({ start(controller) {
      for (const byte of parts) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    } });
    const output = [];
    for await (const data of readCompletionEvents(body, new AbortController().signal)) output.push(data);
    assert.deepEqual(output, ['one\ntwo', '[DONE]']);
  }
  for (const tail of ['data: [DONE]', 'data: [DONE]\n', 'data: [DONE]\r']) {
    const partial = await run(event(chunk({ content: '保留' })) + tail);
    assert.equal(partial.status, 'interrupted');
    assert.equal(partial.error, 'stream_closed');
    assert.equal(partial.content, '保留');
  }
  assert.equal((await run(event(chunk({}, 'stop')))).status, 'interrupted');
  assert.equal((await run(event('[DONE]'))).error, 'missing_finish_reason');
});

test('区分停止原因；非法工具调用不进入 Agent，异常 payload 不泄露到错误状态', async () => {
  const cases = [
    ['stop', 'completed', null], ['length', 'completed', 'length'], ['content_filter', 'failed', 'content_filter'],
    ['aborted', 'interrupted', 'aborted'], ['insufficient_system_resource', 'interrupted', 'insufficient_system_resource'],
    ['tool_calls', 'failed', 'tools_not_supported'], ['future_reason', 'failed', 'unknown_finish_reason'],
  ];
  for (const [reason, status, error] of cases) {
    const result = await run(event(chunk({}, reason)) + event('[DONE]'));
    assert.deepEqual([result.status, result.error], [status, error]);
  }
  const invalid = [
    ['{private broken payload', 'invalid_json'], ['null', 'invalid_chunk'],
    [JSON.stringify({ error: { message: 'private detail' } }), 'provider_error'],
    [chunk({ tool_calls: [{ function: { name: 'execute' } }] }), 'tools_not_supported'],
    [chunk({ content: 123 }), 'invalid_delta'],
    [chunk({}, null, { usage: { total_tokens: -1 } }), 'invalid_usage'],
  ];
  for (const [data, expected] of invalid) {
    const result = await run(event(data));
    assert.equal(result.status, 'failed');
    assert.equal(result.error, expected);
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
  assert.equal((await run(event(chunk({ content: 'first' })) + event(chunk({}, null, { id: 'other' })))).error, 'response_id_changed');
  assert.equal((await run(event(chunk({}, 'stop')) + event(chunk({ content: 'late' })))).error, 'chunk_after_finish');
});

test('HTTP 错误、错误内容类型、异常编码、超大未终止事件均释放 body', async () => {
  for (const [status, headers, error] of [[401, {}, 'http_401'], [429, {}, 'http_429'], [200, { 'content-type': 'text/html' }, 'unexpected_content_type']]) {
    let cancelled = false;
    const body = new ReadableStream({ cancel() { cancelled = true; } });
    const result = await turn().run(() => new Response(body, { status, headers }));
    assert.equal(result.error, error);
    assert.equal(cancelled, true);
  }
  const bad = await turn().run(() => new Response(Uint8Array.of(0xff), { headers: { 'content-type': 'text/event-stream' } }));
  assert.equal(bad.error, 'invalid_utf8');
  assert.equal((await run('data: ' + 'x'.repeat(1024 * 1024 + 1))).error, 'event_too_large');
});

test('等待响应、读流、销毁均可停止；迟到响应不能写新请求且没有自动重试', { timeout: 10000 }, async () => {
  const old = turn('chat-a', 'old');
  let resolveOld;
  let cancelled = false;
  let calls = 0;
  const running = old.run(() => { calls++; return new Promise(resolve => { resolveOld = resolve; }); });
  await Promise.resolve();
  old.stop();
  assert.equal((await running).status, 'interrupted');
  const next = turn('chat-b', 'new');
  assert.equal((await next.run(() => response(complete))).content, '正文');
  resolveOld(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cancelled, true);
  assert.equal(old.getSnapshot().content, '');
  assert.equal(next.getSnapshot().chatId, 'chat-b');
  assert.equal(calls, 1);
  assert.throws(() => new OrdinaryTurn({ mode: 'remote', chatId: 'a', requestId: 'b' }), /invalid_ordinary_turn_owner/);

  const waiting = turn();
  let ended;
  const readStarted = new Promise(resolve => { ended = resolve; });
  waiting.subscribe(() => { if (waiting.getSnapshot().content) ended(); });
  const pending = waiting.run(() => replayResponse('stalled', { delayMs: 0 }));
  await readStarted;
  waiting.dispose();
  assert.equal((await pending).status, 'interrupted');
  assert.equal(waiting.getSnapshot().content, fixtureText);
});

test('真实 loopback HTTP 传输下完成和用户停止；服务端观察连接关闭（内容仍是协议夹具）', { timeout: 10000 }, async () => {
  let closed;
  const disconnected = new Promise(resolve => { closed = resolve; });
  const server = createServer((request, reply) => {
    reply.writeHead(200, { 'content-type': 'text/event-stream' });
    if (request.url === '/complete') reply.end(complete);
    else {
      reply.on('close', closed);
      reply.write(event(chunk({ content: '等待用户停止' })));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await turn().run(signal => fetch(url + '/complete', { signal }))).status, 'completed');
    const request = turn();
    request.subscribe(() => { if (request.getSnapshot().content) request.stop(); });
    assert.equal((await request.run(signal => fetch(url + '/wait', { signal }))).status, 'interrupted');
    await disconnected;
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
