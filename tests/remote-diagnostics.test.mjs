import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteDiagnostics, diagnosticView, diagnosticRecord, safeJavascriptFrames } from '../src/remote-diagnostics.mjs';

test('a 404 handshake reports the failed stage without inventing a proxy diagnosis', () => {
  const view = diagnosticView({ code: 'http_404', phase: 'websocket', httpStatus: 404 });
  assert.equal(view.title, '实时连接握手失败');
  assert.match(view.description, /HTTP 404/);
  assert.match(view.suggestion, /代理.*中转地址/);
  assert.doesNotMatch(view.description, /电脑离线|代理故障/);
  assert.equal(diagnosticView({ code: 'http_404', phase: 'reading', httpStatus: 404 }).title, '会话读取失败');
});

test('unknown diagnostics drop arbitrary strings, credentials and server bodies', () => {
  assert.equal(diagnosticView(null).title, '连接未完成');
  const secret = 'SENSITIVE_MARKER';
  const record = diagnosticRecord({ id: crypto.randomUUID(), at: Date.now(), code: secret, phase: secret,
    source: secret, httpStatus: secret, closeReason: secret, message: secret, url: secret,
    exceptions: [{ type: secret, frames: [secret] }], headers: secret, body: secret });
  assert.equal(record.code, 'unknown_error');
  assert.equal(record.phase, 'unknown');
  assert.equal(JSON.stringify(record).includes(secret), false);
  assert.equal(diagnosticRecord({ at: Date.now(), id: 'not-an-id' }), null);
});

test('Javascript stacks contain only own resource filenames and bounded frame positions', () => {
  const stack = 'Error: https://private.invalid/?token=SECRET\n'
    + '    at open (https://remote.dshm.invalid/assets/web/remote-main.js:12:30)\n'
    + '    at thirdParty (https://private.invalid/key.js:1:2)\n'
    + '    at local (file:///private/SECRET.js:1:2)';
  assert.deepEqual(safeJavascriptFrames(stack), ['at remote-main.js:12:30']);
  assert.equal(safeJavascriptFrames(stack.repeat(100)).length <= 18, true);
});

test('native traces project structural fields only and keep close events without fake stacks', () => {
  const record = diagnosticRecord({ id: crypto.randomUUID(), at: Date.now(), phase: 'connection', code: 'remote_closed', closeCode: 1001,
    closeReason: 'unknown-private-value', resolvedAt: Date.now(), exceptions: [{ type: 'java.net.ProtocolException', message: 'SECRET',
      frames: ['at okhttp3.internal.ws.RealWebSocket.checkUpgradeSuccess(RealWebSocket.kt:224)', 'https://SECRET'] }] });
  assert.deepEqual(record.exceptions[0].frames, ['at okhttp3.internal.ws.RealWebSocket.checkUpgradeSuccess(RealWebSocket.kt:224)']);
  assert.equal(record.closeCode, 1001);
  assert.equal(record.closeReason, undefined);
  assert.equal(JSON.stringify(record).includes('SECRET'), false);
  assert.match(diagnosticView({ code: 'network_timeout', phase: 'reading' }).title, /读取/);
  assert.equal(diagnosticView({ code: 'host_offline' }).title, '电脑暂时离线');
});

test('a delayed native read cannot overwrite a newer socket failure', async () => {
  let finish;
  const store = new RemoteDiagnostics({ call: () => new Promise(resolve => { finish = resolve; }) });
  const pending = store.refresh();
  const failure = { id: crypto.randomUUID(), at: Date.now(), code: 'http_404', phase: 'websocket' };
  store.publish([failure]);
  finish({ records: [] });
  await pending;
  assert.equal(store.records[0].id, failure.id);
});

test('in-flight request rejection preserves the native failure even after a notification error', async () => {
  const primary = { id: crypto.randomUUID(), at: Date.now(), code: 'http_404', phase: 'websocket' };
  const notification = { ...primary, id: crypto.randomUUID(), source: 'notifications', code: 'network_timeout' };
  const calls = [];
  const store = new RemoteDiagnostics({ call: async op => {
    calls.push(op); assert.equal(op, 'diagnostics.read'); return { records: [notification, primary] };
  } });
  const result = await store.capture(Error('connection_closed_outcome_unknown'), 'reading');
  assert.equal(result.id, primary.id);
  assert.deepEqual(calls, ['diagnostics.read']);
});

test('older native bridges keep a bounded fallback and recovery history', async () => {
  const store = new RemoteDiagnostics({ call: async () => { throw Error('unsupported_operation'); } });
  for (let index = 0; index < 13; index++) await store.capture(Error('network_timeout'), 'reading', false);
  assert.equal(store.records.length, 10);
  await store.recovered();
  assert.equal(store.records.every(record => record.resolvedAt > 0), true);
  assert.equal(store.records.every(record => record.code === 'network_timeout'), true);
});
