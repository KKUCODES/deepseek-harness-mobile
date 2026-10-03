import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdinarySession } from '../src/ordinary-session.mjs';
import { fixtureChunk, fixtureEvent } from '../src/stream-fixtures.mjs';

// 用受控依赖验证调度与失败语义；IndexedDB/Android 的实际入口另跑集成检查。
class History {
  rows = new Map();
  failWrites = false;
  open = async () => this;
  recover = async () => {};
  close() {}
  async create(preferences) {
    const row = { id: crypto.randomUUID(), mode: 'ordinary', title: '新聊天', draft: '', turns: [], ...preferences };
    this.rows.set(row.id, structuredClone(row)); return row;
  }
  get = async id => structuredClone(this.rows.get(id));
  async update(id, action) {
    if (this.failWrites) throw new Error('disk_full');
    const row = await this.get(id); action(row); this.rows.set(id, row); return row;
  }
  page = async () => ({ items: [...this.rows.values()].map(row => ({ id: row.id, title: row.title })), next: null });
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const history = new History();
  const calls = [];
  let output;
  const native = { status: async () => ({ configured: true }), open: async (request, signal) => {
    calls.push(request);
    return new Response(new ReadableStream({ start(controller) {
      output = controller;
      signal.addEventListener('abort', () => { try { controller.close(); } catch {} });
    } }), { headers: { 'content-type': 'text/event-stream' } });
  } };
  const session = new OrdinarySession({ history, native });
  const write = text => output.enqueue(new TextEncoder().encode(text));
  return { history, calls, session, write };
}

test('request options are snapshotted for the actual bridge and stored turn', async () => {
  const { session, calls, history, write } = setup(); await session.start();
  await session.preferences({ requestOptions: { maxTokens: 512, temperature: 0.2 } });
  await session.editDraft('参数测试');
  const id = session.getSnapshot().chat.id;
  const run = session.send(); await tick();
  assert.equal(calls[0].requestOptions.maxTokens, 512);
  await session.preferences({ requestOptions: { maxTokens: 1024 } });
  write(fixtureEvent(fixtureChunk({ content: '好' })) + fixtureEvent(fixtureChunk({}, 'stop')) + 'data: [DONE]\n\n');
  await run;
  const row = await history.get(id);
  assert.equal(row.requestOptions.maxTokens, 1024);
  assert.equal(row.turns[0].requestOptions.maxTokens, 512);
  assert.equal(row.turns[0].requestOptions.temperature, 0.2);
  await session.dispose();
});

test('rapid typing in a new chat creates one record with the latest draft', async () => {
  const { session, history } = setup(); await session.start();
  await Promise.all([session.editDraft('你'), session.editDraft('你好'), session.editDraft('你好世界')]);
  assert.equal(history.rows.size, 1);
  assert.equal(session.getSnapshot().draft, '你好世界');
  assert.equal((await history.get(session.getSnapshot().chat.id)).draft, '你好世界');
  await session.dispose();
});

test('stream belongs to original chat while navigation and next draft remain independent', async () => {
  const { session, history, calls, write } = setup(); await session.start(); await session.editDraft('第一问');
  const first = session.getSnapshot().chat.id;
  await session.preferences({ model: 'deepseek-v4-pro', thinking: true });
  const run = session.send(); await tick();
  await session.editDraft('下一问不自动发');
  await session.newChat(); await session.editDraft('另一个会话草稿');
  const second = session.getSnapshot().chat.id;
  write(fixtureEvent(fixtureChunk({ content: '回复第一问' })) + fixtureEvent(fixtureChunk({}, 'stop')) + 'data: [DONE]\n\n');
  await run;
  assert.equal(calls.length, 1); assert.equal(calls[0].thinking, true);
  assert.equal(calls[0].model, 'deepseek-v4-pro');
  assert.equal(session.getSnapshot().chat.id, second);
  assert.equal(session.getSnapshot().draft, '另一个会话草稿');
  const saved = await history.get(first);
  assert.equal(saved.draft, '下一问不自动发');
  assert.equal(saved.turns[0].content, '回复第一问');
  await session.select(first); assert.equal(session.getSnapshot().draft, '下一问不自动发');
  await session.dispose();
});

test('saving failure before send never issues a network request or loses the draft', async () => {
  const { session, history, calls } = setup(); await session.start(); await session.editDraft('保留我');
  history.failWrites = true;
  await assert.rejects(session.send(), /disk_full/);
  assert.equal(calls.length, 0); assert.equal(session.getSnapshot().draft, '保留我');
  assert.equal(session.getSnapshot().busy, false);
  await session.dispose();
});

test('stop saves an interrupted partial answer, with no retry or duplicate request', async () => {
  const { session, history, calls, write } = setup(); await session.start(); await session.editDraft('问题');
  const id = session.getSnapshot().chat.id;
  const run = session.send(); await tick();
  write(fixtureEvent(fixtureChunk({ content: '半条' }))); await tick();
  session.stop(); await run;
  assert.equal((await history.get(id)).turns[0].status, 'interrupted');
  assert.equal((await history.get(id)).turns[0].content, '半条');
  assert.equal(calls.length, 1);
  await session.dispose();
});

test('retry after a failed draft write sends the visible draft, never an older saved value', async () => {
  const { session, history, calls, write } = setup(); await session.start(); await session.editDraft('旧草稿');
  history.failWrites = true;
  await assert.rejects(session.editDraft('屏幕上的新草稿'), /disk_full/);
  history.failWrites = false;
  const run = session.send(); await tick();
  assert.equal(calls[0].messages.at(-1).content, '屏幕上的新草稿');
  write(fixtureEvent(fixtureChunk({ content: '好' })) + fixtureEvent(fixtureChunk({}, 'stop')) + 'data: [DONE]\n\n');
  await run; await session.dispose();
});

test('stop before queued preparation opens no network request and retains the draft', async () => {
  const { session, calls } = setup(); await session.start(); await session.editDraft('不要发送');
  const run = session.send(); session.stop();
  await assert.rejects(run, /stopped/);
  assert.equal(calls.length, 0); assert.equal(session.getSnapshot().draft, '不要发送');
  await session.dispose();
});

test('dispose drains the interrupted terminal write before closing history', async () => {
  const { session, history, write } = setup(); await session.start(); await session.editDraft('结束前保存');
  const id = session.getSnapshot().chat.id;
  const run = session.send(); await tick();
  write(fixtureEvent(fixtureChunk({ content: '部分内容' }))); await tick();
  let closed;
  history.close = () => { closed = structuredClone(history.rows.get(id)); };
  await session.dispose(); await run;
  assert.equal(closed.turns[0].status, 'interrupted');
  assert.equal(closed.turns[0].content, '部分内容');
  await assert.rejects(session.send(), /session_closed/);
});
