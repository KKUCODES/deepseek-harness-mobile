import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAttachment, userContent } from '../src/ordinary-attachments.mjs';
import { completionMessages } from '../src/ordinary-history.mjs';

const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const image = { id: 'photo', name: 'sample.png', size: bytes.length, source: 'photo', kind: 'image', mime: 'image/png', data: `data:image/png;base64,${bytes.toString('base64')}` };
const document = { id: 'text', name: '笔记.txt', source: 'file', kind: 'text', size: 6, text: '你好' };

test('attachment text is sent as actual content and images use verified Chat Completions blocks', () => {
  assert.equal(userContent('总结', [document], 'deepseek-v4-pro'), '总结\n\n附件：笔记.txt\n你好');
  assert.deepEqual(userContent('描述', [image], 'deepseek-flash'), [{ type: 'text', text: '描述' }, { type: 'image_url', image_url: { url: image.data } }]);
  assert.throws(() => userContent('描述', [image], 'deepseek-v4-pro'), /model_no_vision/);
});

test('historical images cannot silently disappear when switching to a text-only model', () => {
  const chat = { mode: 'ordinary', model: 'deepseek-v4-pro', turns: [{ prompt: '描述', attachments: [image], content: '图片回复', status: 'completed' }] };
  assert.throws(() => completionMessages(chat, '继续'), /model_no_vision/);
  assert.equal(completionMessages(chat, '继续', [], 'deepseek-flash')[0].content[1].image_url.url, image.data);
});

test('unknown destinations, forged MIME, duplicate IDs and oversized text are rejected', () => {
  assert.throws(() => cleanAttachment({ ...image, data: 'https://example.test/image.png' }), /invalid_attachment/);
  assert.throws(() => cleanAttachment({ ...image, mime: 'image/jpeg', data: image.data.replace('image/png', 'image/jpeg') }), /invalid_attachment/);
  assert.throws(() => userContent('', [image, image], 'deepseek-flash'), /invalid_attachment/);
  assert.throws(() => userContent('x'.repeat(99999), [document], 'deepseek-flash'), /context_limit/);
});
