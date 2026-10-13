import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { draftStorage, draftBinding } from './fixtures/remote-draft-storage.mjs';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';

test('发送核对编号严格落盘，确认原编号原子清除对应草稿和附件，保留新增附件', async () => {
  const database = new IDBFactory(), open = () => RemoteDraftStore.open(draftBinding, database, null);
  const one = await open(), editor = { root: { type: 'root', children: [] } };
  await one.write('chat', '@file', editor);
  await one.writeAttachments('chat', ['sent', 'new'].map(id => ({ id, name: id, source: new Blob([id]), state: 'ready' })), ['sent']);
  await one.prepareSubmission('chat', 'original-request', { text: '@file', editor }, ['sent']); one.close();
  const next = await open();
  assert.equal(next.readSubmission('chat').requestId, 'original-request');
  assert.equal(await next.settleSubmission('chat', 'different-request'), null);
  assert.equal(next.read('chat'), '@file');
  assert.deepEqual(await next.settleSubmission('chat', 'original-request'), { clearedDraft: true, attachmentIds: ['sent'] });
  next.close(); const last = await open();
  assert.equal(last.read('chat'), ''); assert.equal(last.readSubmission('chat'), null);
  assert.deepEqual(last.readAttachments('chat').map(item => item.id), ['new']); last.close();
});

test('清理事务中止保留核对编号、结构化草稿和附件；新引用或新文字撤销旧清理资格', async () => {
  const database = new IDBFactory(), store = await RemoteDraftStore.open(draftBinding, database, null);
  const original = { root: { type: 'root', children: [{ type: 'reference-chip', ref: 'one' }] } };
  await store.write('chat', '@file', original);
  await store.writeAttachments('chat', [{ id: 'one', name: 'a', source: new Blob(['a']), state: 'ready' }]);
  await store.prepareSubmission('chat', 'request', { text: '@file', editor: original }, ['one']);
  const transaction = IDBDatabase.prototype.transaction;
  try {
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = transaction.apply(this, args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx;
    };
    await assert.rejects(store.settleSubmission('chat', 'request'));
    assert.equal(store.readSubmission('chat').requestId, 'request');
    assert.deepEqual(store.readEntry('chat'), { text: '@file', editor: original });
    assert.equal(store.readAttachments('chat').length, 1);
  } finally { IDBDatabase.prototype.transaction = transaction; }
  await store.write('chat', '@file', { root: { type: 'root', children: [{ type: 'reference-chip', ref: 'two' }] } });
  assert.equal(store.readSubmission('chat'), null);
  await store.prepareSubmission('chat', 'second', store.readEntry('chat'), []);
  await store.write('chat', '新文字'); assert.equal(store.readSubmission('chat'), null);
  assert.equal(await store.settleSubmission('chat', 'second'), null); assert.equal(store.read('chat'), '新文字'); store.close();
});

test('结构化草稿与文字同一事务保存，重开保留身份，纯文字覆盖清除旧结构', async () => {
  const database = new IDBFactory(), open = binding => RemoteDraftStore.open(binding, database, null);
  const editor = { root: { type: 'root', children: [{ type: 'reference-chip', source: 'file', ref: '/workspace/file', clipboardText: '@file' }] } };
  const first = await open(draftBinding);
  await first.write('chat', '@file', editor); first.close();
  const next = await open(draftBinding);
  assert.deepEqual(next.readEntry('chat'), { text: '@file', editor });
  for (const key of ['origin', 'deviceId', 'fingerprint']) {
    const other = await open({ ...draftBinding, [key]: 'other' });
    assert.deepEqual(other.readEntry('chat'), { text: '' }); other.close();
  }
  await next.write('chat', '@file');
  assert.deepEqual(next.readEntry('chat'), { text: '@file' });
  await next.write('chat', '@file', editor); await next.write('chat', ''); next.close();
  const cleared = await open(draftBinding); assert.deepEqual(cleared.readEntry('chat'), { text: '' }); cleared.close();
});

test('事务中止不能把未提交的保存或删除发布到草稿读取缓存', async () => {
  const database = new IDBFactory(), store = await RemoteDraftStore.open(draftBinding, database, null);
  await store.write('chat', '已保存');
  const transaction = IDBDatabase.prototype.transaction;
  try {
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = transaction.apply(this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
    for (const value of ['未提交', '']) {
      await assert.rejects(store.write('chat', value));
      assert.equal(store.read('chat'), '已保存');
    }
  } finally { IDBDatabase.prototype.transaction = transaction; store.close(); }
  const restored = await RemoteDraftStore.open(draftBinding, database, null);
  assert.equal(restored.read('chat'), '已保存');
  await restored.write('chat', '恢复保存'); assert.equal(restored.read('chat'), '恢复保存'); restored.close();
});

test('不识别的结构化草稿不能静默变成普通文字', () => {
  const storage = draftStorage(), store = new RemoteDraftStore(draftBinding, () => storage);
  storage.setItem(store.key('chat'), { version: 2, text: '@file', editor: {} });
  assert.throws(() => store.read('chat'), /structure_invalid/);
});

test('重建存储实例恢复原文，绑定与会话分别隔离，清空只删除当前会话', () => {
  const storage = draftStorage(), open = binding => new RemoteDraftStore(binding, () => storage);
  const first = open(draftBinding); first.write('one', '  中文\n草稿 🎈  '); first.write('two', '另一个会话');
  assert.equal(open(draftBinding).read('one'), '  中文\n草稿 🎈  ');
  for (const key of ['origin', 'deviceId', 'fingerprint']) assert.equal(open({ ...draftBinding, [key]: 'other' }).read('one'), '');
  first.write('one', ''); assert.equal(open(draftBinding).read('one'), ''); assert.equal(first.read('two'), '另一个会话');
});

test('移除绑定仅清理它的草稿，保留普通聊天、其他绑定及其他设置', () => {
  const storage = draftStorage(), one = new RemoteDraftStore(draftBinding, () => storage);
  const other = new RemoteDraftStore({ ...draftBinding, deviceId: 'two' }, () => storage);
  one.write('one', 'A'); one.write('two', 'B'); other.write('one', 'C'); storage.setItem('ordinary', 'local');
  one.clear(); assert.equal(one.read('one'), ''); assert.equal(one.read('two'), '');
  assert.equal(other.read('one'), 'C'); assert.equal(storage.getItem('ordinary'), 'local');
});

test('存储不可访问或写满不能静默成功，未配对身份不能生成共享命名空间', () => {
  assert.throws(() => new RemoteDraftStore({ paired: false }), /binding_required/);
  const unavailable = new RemoteDraftStore(draftBinding, () => { throw new Error('SecurityError'); });
  assert.throws(() => unavailable.read('one'), /SecurityError/); assert.throws(() => unavailable.write('one', 'draft'), /SecurityError/);
  const full = new RemoteDraftStore(draftBinding, () => ({ getItem() { return null; }, setItem() { throw new Error('QuotaExceeded'); } }));
  assert.throws(() => full.write('one', 'draft'), /QuotaExceeded/);
});

test('数据库严格提交、连续修改顺序、重开、发送删除与绑定清理', async () => {
  const database = new IDBFactory(), open = binding => RemoteDraftStore.open(binding, database, null);
  const one = await open(draftBinding);
  await Promise.all([one.write('chat', '旧'), one.write('chat', '新')]); one.close();
  const next = await open(draftBinding); assert.equal(next.read('chat'), '新');
  const other = await open({ ...draftBinding, deviceId: 'other' }); assert.equal(other.read('chat'), '');
  await other.write('chat', '保留'); other.close();
  await next.write('chat', ''); await next.write('second', '待移除'); await next.clear(); next.close();
  const check = await open(draftBinding), remaining = await open({ ...draftBinding, deviceId: 'other' });
  assert.equal(check.read('chat'), ''); assert.equal(check.read('second'), ''); assert.equal(remaining.read('chat'), '保留');
  check.close(); remaining.close();
});

test('旧验证包草稿迁移仅处理同一绑定，提交后清理旧值且不覆盖已有数据库记录', async () => {
  const database = new IDBFactory(), legacy = draftStorage(), old = new RemoteDraftStore(draftBinding, () => legacy);
  old.write('chat', '本机旧草稿'); legacy.setItem('unrelated', '保留');
  const migrated = await RemoteDraftStore.open(draftBinding, database, legacy);
  assert.equal(migrated.read('chat'), '本机旧草稿'); assert.equal(old.read('chat'), '');
  assert.equal(legacy.getItem('unrelated'), '保留'); await migrated.write('chat', '最新草稿'); migrated.close();
  old.write('chat', '迟到旧草稿'); const reopened = await RemoteDraftStore.open(draftBinding, database, legacy);
  assert.equal(reopened.read('chat'), '最新草稿'); assert.equal(old.read('chat'), ''); reopened.close();
});

test('图片与文件原件在数据库重开后字节一致，不保存 receipt 或电脑路径，清理覆盖文字和附件', async () => {
  const database = new IDBFactory(), one = await RemoteDraftStore.open(draftBinding, database, null);
  const items = [{ id: 'one', name: 'a.txt', bytes: 3, source: new Blob(['abc']), receiptId: 'secret-receipt', file: { absolutePath: '/private' }, state: 'ready' },
    { id: 'two', name: 'b.png', bytes: 2, source: new Blob([new Uint8Array([0, 255])]), kind: 'image', mediaType: 'image/png', state: 'ready' }];
  await one.write('chat', '正文'); await one.writeAttachments('chat', items, ['two']); one.close();
  const restored = await RemoteDraftStore.open(draftBinding, database, null), [file, image] = restored.readAttachments('chat');
  assert.equal(await file.source.text(), 'abc'); assert.equal(file.state, 'restored');
  assert.equal(file.receiptId, undefined); assert.equal(file.file, undefined);
  assert.deepEqual([...new Uint8Array(await image.source.arrayBuffer())], [0, 255]); assert.equal(image.state, 'uncertain');
  await restored.clear(); restored.close();
  const empty = await RemoteDraftStore.open(draftBinding, database, null);
  assert.equal(empty.read('chat'), ''); assert.deepEqual(empty.readAttachments('chat'), []); empty.close();
});
