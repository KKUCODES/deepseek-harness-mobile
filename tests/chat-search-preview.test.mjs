import test from 'node:test';
import assert from 'node:assert/strict';
import { searchChats } from '../docs/design/ordinary-preview/chat-search.mjs';

const chats = [
  { id: '1', title: '旅行', messages: [{ text: '带上防晒和水' }, { text: '防晒放进包里' }] },
  { id: '2', title: 'DeepSeek 使用', messages: [{ text: '模型设置' }] },
];
test('空查询不列出聊天；标题和正文实时匹配且每条聊天只出现一次', () => {
  assert.deepEqual(searchChats(chats, '  '), []);
  assert.deepEqual(searchChats(chats, ' 防晒 ').map(r => r.chat.id), ['1']);
  assert.deepEqual(searchChats(chats, 'DEEPSEEK').map(r => r.chat.id), ['2']);
  assert.deepEqual(searchChats(chats, '不存在'), []);
});
test('长正文片段围绕命中位置，不丢失关键词或原聊天身份', () => {
  const chat = { id: 'long', title: '长内容', messages: [{ text: '前文'.repeat(100) + '命中内容' + '后文'.repeat(100) }] };
  const [result] = searchChats([chat], '命中内容');
  assert.equal(result.chat, chat);
  assert.ok(result.snippet.includes('命中内容'));
  assert.ok(result.snippet.startsWith('…') && result.snippet.endsWith('…'));
});
