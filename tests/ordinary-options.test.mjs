import test from 'node:test';
import assert from 'node:assert/strict';
import { requestOptions, DEFAULT_REQUEST_OPTIONS } from '../src/ordinary-options.mjs';
import { encodeBackup, decodeBackup } from '../src/ordinary-backup.mjs';

test('request options accept documented limits, reject coercion and unknown API fields', () => {
  assert.deepEqual(requestOptions(), DEFAULT_REQUEST_OPTIONS);
  assert.deepEqual(requestOptions({ maxTokens: 393216, temperature: 0, topP: 0.95, reasoningEffort: 'max' }), { maxTokens: 393216, temperature: 0, topP: 0.95, reasoningEffort: 'max' });
  for (const value of [null, [], { maxTokens: 0 }, { maxTokens: 393217 }, { maxTokens: 1.5 }, { maxTokens: '200' }, { temperature: NaN }, { topP: 0.9 }, { reasoningEffort: 'none' }, { tools: [] }]) assert.throws(() => requestOptions(value), /invalid_preferences/);
});

test('backup preserves different historical request options and current preferences', () => {
  const options = requestOptions({ maxTokens: 512, temperature: 0.3 });
  const row = { id: 'options', mode: 'ordinary', title: '参数', draft: '', updatedAt: 1, model: 'deepseek-flash', thinking: false, requestOptions: options,
    turns: [{ requestId: 'r', prompt: 'hi', content: 'hello', reasoning: '', status: 'completed', model: 'deepseek-flash', thinking: false, requestOptions: requestOptions({ maxTokens: 256 }), error: null }] };
  const restored = decodeBackup(encodeBackup([row]))[0];
  assert.deepEqual(restored.requestOptions, options);
  assert.equal(restored.turns[0].requestOptions.maxTokens, 256);
});
