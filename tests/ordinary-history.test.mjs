import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { OrdinaryHistory } from '../src/ordinary-history.mjs';
import { decodeBackup, encodeBackup } from '../src/ordinary-backup.mjs';

globalThis.IDBKeyRange = IDBKeyRange;
function fresh() { globalThis.indexedDB = new IDBFactory(); }
const completed = { requestId: 'r1', model: 'deepseek-flash', prompt: '旧问题', content: '旧回复', reasoning: '', status: 'completed', error: null };

test('v1 migration adds a real cursor index without rewriting history, draft or request ownership', async () => {
  fresh();
  await new Promise((resolve, reject) => {
    const open = indexedDB.open('dshm-ordinary-history-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('chats', { keyPath: 'id' });
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction('chats', 'readwrite');
      tx.objectStore('chats').put({ id: 'legacy', mode: 'ordinary', title: '旧标题', draft: '旧草稿', updatedAt: 10, turns: [completed] });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = reject;
    }; open.onerror = reject;
  });
  const history = await new OrdinaryHistory().open();
  const row = await history.get('legacy');
  assert.equal(row.draft, '旧草稿'); assert.deepEqual(row.turns, [completed]);
  assert.equal(row.model, 'deepseek-flash');
  assert.equal((await history.page()).items[0].title, '旧标题');
  history.close();
});

test('paged history handles equal timestamps without skipping or duplicating chats; search scans bodies', async () => {
  fresh(); const history = await new OrdinaryHistory().open();
  const rows = Array.from({ length: 6 }, (_, index) => ({ id: `c${index}`, mode: 'ordinary', title: `标题${index}`, draft: '', updatedAt: 100,
    turns: [{ ...completed, content: index % 2 ? '可搜索正文' : '其他' }] }));
  await history.import(encodeBackup(rows));
  const first = await history.page({ limit: 2 });
  const second = await history.page({ limit: 2, before: first.next });
  const third = await history.page({ limit: 2, before: second.next });
  assert.deepEqual([...first.items, ...second.items, ...third.items].map(row => row.id), ['c5', 'c4', 'c3', 'c2', 'c1', 'c0']);
  assert.equal(third.next, null);
  assert.deepEqual((await history.page({ query: '搜索正文' })).items.map(row => row.id), ['c5', 'c3', 'c1']);
  history.close();
});

test('branch and rename preserve original; recovery never replays a previously active request', async () => {
  fresh(); const history = await new OrdinaryHistory().open(); const source = await history.create();
  await history.update(source.id, row => { row.turns = [completed, { ...completed, requestId: 'r2', status: 'streaming', content: '半条' }]; });
  await assert.rejects(history.fork(source.id, 2), /invalid_branch/);
  assert.equal(await history.recover(), 1);
  const fork = await history.fork(source.id, 1, '改后的提问');
  await history.rename(fork.id, '独立分支');
  const original = await history.get(source.id);
  assert.equal(original.turns.length, 2); assert.equal(original.turns[1].error, 'app_restarted');
  assert.equal(original.title, '新聊天');
  assert.equal((await history.get(fork.id)).draft, '改后的提问');
  assert.equal((await history.get(fork.id)).title, '独立分支');
  assert.equal(await history.recover(), 0); history.close();
});

test('backup reimport deduplicates and a late conflict atomically rolls back preceding inserts', async () => {
  fresh(); const history = await new OrdinaryHistory().open(); const original = await history.create();
  const backup = await history.export();
  assert.deepEqual(await history.import(backup), { imported: 0, skipped: 1 });
  const rows = decodeBackup(backup);
  const added = { ...rows[0], id: 'new-chat' };
  const conflict = { ...rows[0], title: '冲突' };
  await assert.rejects(history.import(encodeBackup([added, conflict])), /backup_conflict/);
  assert.deepEqual((await history.list()).map(row => row.id), [original.id]);
  assert.throws(() => history.import('{bad'), /invalid_backup/);
  history.close();
});
