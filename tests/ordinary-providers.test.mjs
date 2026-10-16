import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { providerDraft, deepseekProvider, selectedModel } from '../src/ordinary-providers.mjs';
import { chatPreferences } from '../src/ordinary-models.mjs';
import { OrdinaryHistory } from '../src/ordinary-history.mjs';
import { OrdinarySession } from '../src/ordinary-session.mjs';
import { encodeBackup, decodeBackup } from '../src/ordinary-backup.mjs';
import { OrdinaryNative } from '../src/ordinary-native.mjs';
import { fixtureChunk, fixtureEvent } from '../src/stream-fixtures.mjs';

const id = 'p-11111111-1111-4111-8111-111111111111';
const custom = () => ({ id, name: '自定义 DeepSeek', baseURL: 'https://api.example.com/v1', revision: 'revision-1', configured: true,
  models: [{ id: 'deepseek-flash', label: 'Flash', vision: true, thinking: 'thinking', tokenField: 'max_tokens', sampling: false }] });
globalThis.IDBKeyRange = IDBKeyRange;

test('provider draft restricts protocol and strips credentials, extra fields and unsupported capabilities', () => {
  const input = { ...custom(), key: 'never-copy-this', authorization: 'never-copy-this' };
  const clean = providerDraft(input);
  assert.equal(JSON.stringify(clean).includes('never-copy'), false);
  assert.equal(clean.baseURL, 'https://api.example.com/v1');
  for (const baseURL of ['http://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com?key=a', 'https://api.example.com#x', 'file:///etc/passwd', 'https://api.example.com/v1/chat/completions']) {
    assert.throws(() => providerDraft({ ...input, baseURL }), /invalid_api_address|api_base_required/);
  }
  assert.throws(() => providerDraft({ ...input, models: [...input.models, input.models[0]] }), /invalid_provider/);
  assert.throws(() => providerDraft({ ...input, models: [{ ...input.models[0], thinking: 'custom-code' }] }), /invalid_provider/);
  assert.throws(() => providerDraft({ ...input, id: 'deepseek' }), /invalid_provider/);
});

test('same model names resolve under distinct providers and legacy preferences stay unchanged', () => {
  const providers = [deepseekProvider(true), custom()];
  assert.equal(selectedModel(providers, { model: 'deepseek-flash' }).label, 'DeepSeek Flash');
  assert.equal(selectedModel(providers, { provider: id, model: 'deepseek-flash' }).provider.id, id);
  assert.deepEqual(chatPreferences({ turns: [{ model: 'deepseek-v4-pro' }] }), { model: 'deepseek-v4-pro', thinking: false });
});

test('new backup version preserves provider identity while still accepting unmodified DeepSeek v1 backups', () => {
  const chat = { id: 'legacy', mode: 'ordinary', title: '旧记录', draft: '旧草稿', updatedAt: 1, turns: [] };
  const backup = JSON.parse(encodeBackup([chat]));
  assert.equal(backup.version, 2);
  backup.version = 1;
  assert.equal(decodeBackup(JSON.stringify(backup))[0].model, 'deepseek-flash');
  backup.chats[0].provider = id;
  assert.throws(() => decodeBackup(JSON.stringify(backup)), /invalid_backup/);
  delete backup.chats[0].provider;
  for (const turns of [{}, [null]]) {
    backup.chats[0].turns = turns;
    assert.throws(() => decodeBackup(JSON.stringify(backup)), /invalid_backup/);
  }
});

test('history, branches and backups keep custom model identity without exporting service configuration or Key', async () => {
  globalThis.indexedDB = new IDBFactory();
  const history = await new OrdinaryHistory().open();
  const chat = await history.create({ provider: id, model: 'vendor/model-v1', thinking: true });
  await history.update(chat.id, row => {
    row.draft = '保留草稿'; row.key = 'never-export'; row.baseURL = 'https://not-exported.invalid';
    row.turns.push({ requestId: 'r-1', provider: id, model: 'vendor/model-v1', prompt: '问题', content: '回答', reasoning: '', status: 'completed', error: null });
  });
  const before = await history.get(chat.id);
  const exported = encodeBackup([before]);
  assert.ok(!exported.includes('never-export') && !exported.includes('not-exported'));
  const restored = decodeBackup(exported)[0];
  assert.equal(restored.provider, id); assert.equal(restored.model, 'vendor/model-v1');
  assert.equal(restored.turns[0].provider, id);
  const fork = await history.fork(chat.id, 1, '分支草稿');
  assert.equal(fork.provider, id); assert.equal(fork.turns[0].content, '回答');
  assert.equal((await history.get(chat.id)).draft, '保留草稿');
  history.close();
});

test('session pins provider/revision, remembers default selection and refuses deleted configurations without losing drafts', async () => {
  globalThis.indexedDB = new IDBFactory();
  const history = new OrdinaryHistory();
  let catalog = { providers: [deepseekProvider(true), custom()], default: { provider: id, model: 'deepseek-flash' } };
  const calls = [];
  const native = { providers: async () => structuredClone(catalog), call: async (op, value) => {
    calls.push({ op, value }); if (op === 'providers.default') catalog.default = value;
    return structuredClone(catalog);
  }, open: async request => {
    calls.push({ request });
    return new Response(fixtureEvent(fixtureChunk({ content: '兼容格式回复' })) + fixtureEvent(fixtureChunk({}, 'stop')) + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
  } };
  const session = new OrdinarySession({ history, native });
  await session.start(); await session.editDraft('测试消息');
  const chatId = session.getSnapshot().chat.id;
  await session.send();
  const request = calls.find(call => call.request).request;
  assert.equal(request.provider, id); assert.equal(request.providerRevision, 'revision-1');
  assert.equal(request.model, 'deepseek-flash');
  assert.equal((await history.get(chatId)).turns[0].provider, id);
  await session.editDraft('不能丢失的草稿');
  catalog = { providers: [deepseekProvider(true)] };
  await session.refreshProviders();
  await assert.rejects(session.send(), /provider_model_missing/);
  assert.equal(session.getSnapshot().draft, '不能丢失的草稿');
  assert.equal(calls.filter(call => call.request).length, 1);
  await session.preferences({ provider: 'deepseek', model: 'deepseek-v4-pro' });
  await session.setDefaultSelection({ provider: 'deepseek', model: 'deepseek-v4-pro' });
  await session.newChat(); assert.equal(session.getSnapshot().homePreferences.model, 'deepseek-v4-pro');
  assert.equal((await history.get(chatId)).turns[0].content, '兼容格式回复');
  await session.dispose();
});

test('native transport sends provider reference but never copies an arbitrary endpoint or headers into request.open', async () => {
  const sent = [];
  const bridge = { postMessage(text) {
    const value = JSON.parse(text); sent.push(value);
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: value.id, data: value.op === 'request.open' ? { status: 401, contentType: 'application/json' } : {} }) }));
  } };
  const client = new OrdinaryNative(bridge);
  const request = { requestId: 'req-1', provider: id, providerRevision: 'revision-1', model: 'vendor/model', messages: [{ role: 'user', content: 'hi' }], baseURL: 'https://attacker.invalid', headers: { authorization: 'never-copy' } };
  const response = await client.open(request, new AbortController().signal);
  assert.equal(response.status, 401);
  const open = sent.find(value => value.op === 'request.open').data;
  assert.equal(open.provider, id); assert.equal(open.providerRevision, 'revision-1');
  assert.ok(!JSON.stringify(open).includes('attacker') && !JSON.stringify(open).includes('never-copy'));
});
