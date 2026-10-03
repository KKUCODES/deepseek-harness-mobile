import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../src/ui/translations.mjs';
import { LocalSettings } from '../src/local-settings.mjs';

test('locale persists independently from chat content and preserves interpolation data', async () => {
  const disk = new Map(); const storage = { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value) };
  const settings = new LocalSettings(storage);
  await settings.bind({ namespace: 'locale' }).set('preference', 'en');
  const language = new LocalSettings(storage).bind({ namespace: 'locale' }).getSnapshot().value.preference;
  assert.equal(translate(language, '选择模型，当前 {model}', { model: 'DeepSeek Flash' }), 'Choose model, current: DeepSeek Flash');
  assert.equal(translate('zh', '移除附件 {name}', { name: '我的文件.txt' }), '移除附件 我的文件.txt');
  assert.equal(translate(language, '移除附件 {name}', { name: '我的文件.txt' }), 'Remove attachment 我的文件.txt');
  assert.equal(translate(language, '用户的原始消息'), '用户的原始消息');
});
