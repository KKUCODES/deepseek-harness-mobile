import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeBackup, decodeBackup } from '../src/ordinary-backup.mjs';
import { chatPreferences } from '../src/ordinary-models.mjs';

const chat = () => ({ id: 'chat-1', mode: 'ordinary', title: '旧聊天', draft: '未发草稿', updatedAt: 123,
  turns: [{ requestId: 'request-1', prompt: '你好', model: 'deepseek-v4-pro', status: 'completed', content: '你好！', reasoning: '', error: null }] });

test('legacy history keeps content, draft and last real model when exported', () => {
  const original = chat();
  const restored = decodeBackup(encodeBackup([original]))[0];
  assert.equal(restored.model, 'deepseek-v4-pro');
  assert.equal(restored.draft, original.draft);
  assert.equal(restored.turns[0].content, original.turns[0].content);
  assert.deepEqual(chatPreferences(original), { model: 'deepseek-v4-pro', thinking: false });
  assert.equal(original.model, undefined);
});

test('backup exports only chat fields and cannot turn an active request into an automatic replay', () => {
  const original = chat();
  original.key = 'sensitive-example'; original.remoteIdentity = 'sensitive-example';
  original.turns[0].status = 'streaming'; original.turns[0].headers = { authorization: 'sensitive-example' };
  const text = encodeBackup([original]);
  assert.equal(text.includes('sensitive-example'), false);
  assert.equal(decodeBackup(text)[0].turns[0].status, 'interrupted');
  assert.equal(original.turns[0].status, 'streaming');
});

test('import rejects foreign formats, Remote, malformed preferences and duplicate IDs before writes', () => {
  const text = encodeBackup([chat()]);
  for (const mutate of [
    value => { value.version = 999; }, value => { value.format = 'preview'; },
    value => { value.chats[0].mode = 'remote'; }, value => { value.chats[0].thinking = 'true'; },
    value => { value.chats.push(value.chats[0]); }, value => { value.chats[0].turns.push(value.chats[0].turns[0]); },
    value => { value.chats[0].turns[0].usage = { prompt_tokens: -1 }; },
  ]) {
    const value = JSON.parse(text); mutate(value);
    assert.throws(() => decodeBackup(JSON.stringify(value)), /invalid_backup/);
  }
});
