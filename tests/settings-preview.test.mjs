import test from 'node:test';
import assert from 'node:assert/strict';
import { backupExample, exportPreviewHistory, parsePreviewHistory, mergePreviewHistory, notificationPreview } from '../docs/design/ordinary-preview/settings-demo.mjs';
import { createPreviewServer } from '../scripts/preview-server.mjs';

test('history export whitelists fields and import ignores unrelated secret fields', () => {
  const chat = { ...backupExample.chats[0], token: 'not-a-real-token', key: 'not-a-real-key', draft: 'not exported' };
  const text = exportPreviewHistory([chat]);
  assert.ok(!text.includes('not-a-real'));
  assert.ok(!text.includes('not exported'));
  const parsed = parsePreviewHistory(JSON.stringify({ ...backupExample, key: 'ignored', chats: [chat] }));
  assert.equal(parsed[0].key, undefined);
  assert.equal(parsed[0].token, undefined);
  assert.deepEqual(parsed[0].messages, chat.messages);
});
test('corrupt, incompatible or partial data never produces a partial import', () => {
  assert.throws(() => parsePreviewHistory('{invalid'), /JSON/);
  assert.throws(() => parsePreviewHistory(JSON.stringify({ ...backupExample, version: 99 })), /版本/);
  assert.throws(() => parsePreviewHistory(JSON.stringify({ ...backupExample, chats: [...backupExample.chats, { id: 'broken' }] })), /不完整/);
  assert.throws(() => parsePreviewHistory(JSON.stringify({ ...backupExample, chats: [...backupExample.chats, ...backupExample.chats] })), /重复/);
});
test('reimport skips existing IDs and preserves existing messages', () => {
  const incoming = parsePreviewHistory(JSON.stringify(backupExample));
  const initial = [{ id: 'local', title: '本地聊天', messages: [] }];
  const first = mergePreviewHistory(initial, incoming);
  assert.equal(first.added, 1);
  const second = mergePreviewHistory(first.chats, [{ ...incoming[0], title: '不得覆盖' }]);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 1);
  assert.equal(second.chats[0].title, incoming[0].title);
});
test('notification preview obeys lifecycle, permission, connection and per-type switch', () => {
  const base = { lifecycle: 'background', permission: true, online: true, enabled: true };
  assert.equal(notificationPreview(base).kind, 'system');
  assert.equal(notificationPreview({ ...base, lifecycle: 'killed' }).kind, 'none');
  assert.equal(notificationPreview({ ...base, online: false }).kind, 'none');
  assert.equal(notificationPreview({ ...base, permission: false }).kind, 'none');
  assert.equal(notificationPreview({ ...base, enabled: false }).kind, 'none');
  assert.equal(notificationPreview({ ...base, lifecycle: 'current' }).kind, 'inline');
  assert.equal(notificationPreview({ ...base, lifecycle: 'foreground', permission: false }).kind, 'banner');
});

test('preview download returns the current validated backup as an HTTP attachment', async t => {
  const server = createPreviewServer(1);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/preview-history-export`;
  const chats = [{ ...backupExample.chats[0], group: '昨天' }];
  const history = exportPreviewHistory(chats);
  const response = await fetch(url, { method: 'POST', body: new URLSearchParams({ history }) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), JSON.parse(history));
  const invalid = await fetch(url, { method: 'POST', body: new URLSearchParams({ history: '{invalid' }) });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('content-disposition'), null);
});
