import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { moveWorkspaceDraft } from '../src/remote-workspace-drafts.mjs';
import { draftBinding } from './fixtures/remote-draft-storage.mjs';

async function fixture() {
  const database = new IDBFactory();
  const store = await RemoteDraftStore.open(draftBinding, database, null);
  const editor = { root: { type: 'root', children: [{ type: 'reference-chip', clipboardText: '@test' }] } };
  const attachment = { id: 'source-file', name: 'test.txt', bytes: 5, source: new Blob(['hello']), receiptId: 'old-session-receipt', state: 'ready' };
  await store.write('from', '@test', editor); await store.writeAttachments('from', [attachment]);
  let state = { drafts: { from: '@test', to: '' }, draftEditors: { from: editor }, attachments: { from: [attachment], to: [] } };
  let released = 0;
  const states = { from: { blank: true, running: false, pendingSubmissions: [] }, to: { blank: true, running: false, pendingSubmissions: [] } };
  const bindings = Object.fromEntries(Object.keys(states).map(id => [id, { session: { getSnapshot: () => states[id] } }]));
  const uploaded = [];
  const model = {
    draftStore: store, draftTransfers: new Set(), sending: new Set(), draftVersions: new Map(), attachmentDraftVersions: new Map(),
    lifetime: new AbortController(), getSnapshot: () => state, publish: patch => { state = { ...state, ...patch }; }, restoreDraft: () => ({}),
    sessions: { binding: id => bindings[id], retain: id => ({ ready: Promise.resolve(bindings[id]), release: () => released++ }) },
    async prepareAttachment(id, sessionId) {
      const item = state.attachments[sessionId].find(item => item.id === id);
      assert.equal(item.receiptId, undefined); uploaded.push({ id, sessionId, bytes: await item.source.text() });
    },
  };
  return { model, states, database, store, uploaded, released: () => released, editor };
}

test('工作区交接原子移动文字、引用及原件，新会话重新上传且不继承 receipt', async () => {
  const f = await fixture();
  await moveWorkspaceDraft(f.model, 'from', 'to', () => true);
  assert.deepEqual(f.model.getSnapshot().drafts, { from: '', to: '@test' });
  assert.deepEqual(f.model.getSnapshot().draftEditors.to, f.editor);
  assert.deepEqual(f.uploaded.map(item => [item.sessionId, item.bytes]), [['to', 'hello']]);
  assert.notEqual(f.uploaded[0].id, 'source-file');
  assert.equal(f.released(), 1); assert.equal(f.model.draftTransfers.size, 0);
  f.store.close();
  const restored = await RemoteDraftStore.open(draftBinding, f.database, null);
  assert.equal(restored.read('from'), ''); assert.deepEqual(restored.readAttachments('from'), []);
  assert.deepEqual(restored.readEntry('to'), { text: '@test', editor: f.editor });
  const [file] = restored.readAttachments('to'); assert.equal(await file.source.text(), 'hello'); assert.equal(file.receiptId, undefined);
  restored.close();
});

test('真实交接入口固定文件引用来源并原子保存新投影', async () => {
  const f = await fixture();
  const editor = { root: { type: 'root', children: [{ type: 'reference-chip', source: 'reference', appearance: 'file', ref: '@same.txt', clipboardText: '@same.txt' }] } };
  const draft = { text: '@same.txt', editor };
  await f.store.write('from', draft.text, editor);
  f.model.publish({ drafts: { from: draft.text, to: '' }, draftEditors: { from: editor } });
  f.model.sessions.list = { getSnapshot: () => ({ byId: { from: { cwd: '/source' }, to: { cwd: '/target' } } }) };
  const input = { captureDraft: () => draft, projectDraft: e => e.root.children[0].clipboardText, shell: { setDraft() {} } };
  f.model.inputBindings = { mounted: id => id === 'from' ? input : undefined };
  await moveWorkspaceDraft(f.model, 'from', 'to', () => true);
  assert.equal(f.store.read('to'), '@/source/same.txt');
  assert.equal(f.store.readEntry('to').editor.root.children[0].ref, '@/source/same.txt');
  assert.equal(f.store.read('from'), '');
  assert.equal(editor.root.children[0].ref, '@same.txt');
  f.store.close();
});

for (const variant of ['target-draft', 'source-running', 'target-running', 'uploading', 'uncertain', 'saving']) {
  test(`拒绝 ${variant} 时保留源草稿与附件`, async () => {
    const f = await fixture(), state = f.model.getSnapshot();
    if (variant === 'target-draft') state.drafts.to = '不可覆盖';
    if (variant === 'source-running') f.states.from.running = true;
    if (variant === 'target-running') f.states.to.running = true;
    if (variant === 'uploading' || variant === 'uncertain') state.attachments.from[0].state = variant;
    if (variant === 'saving') state.draftSaving = { from: true };
    await assert.rejects(moveWorkspaceDraft(f.model, 'from', 'to', () => true));
    assert.equal(f.store.read('from'), '@test'); assert.equal(f.store.read('to'), '');
    assert.equal(f.model.getSnapshot().attachments.from[0].id, 'source-file'); assert.equal(f.model.draftTransfers.size, 0);
    f.store.close();
  });
}

test('本地事务写入期间导航过期，回滚全部记录且内存保持原值', async () => {
  const f = await fixture(); let checks = 0;
  await assert.rejects(moveWorkspaceDraft(f.model, 'from', 'to', () => ++checks < 3));
  assert.equal(f.store.read('from'), '@test'); assert.equal(f.store.read('to'), '');
  assert.equal(f.model.getSnapshot().drafts.from, '@test'); assert.equal(f.model.draftTransfers.size, 0);
  f.store.close();
  const restored = await RemoteDraftStore.open(draftBinding, f.database, null);
  assert.equal(restored.read('from'), '@test'); assert.equal(restored.read('to'), '');
  assert.equal(restored.readAttachments('from').length, 1); assert.equal(restored.readAttachments('to').length, 0); restored.close();
});

test('交接落盘后上传失败，原件保留在目标，锁释放且不自动发送', async () => {
  const f = await fixture(); f.model.prepareAttachment = async () => { throw new Error('offline'); };
  await assert.rejects(moveWorkspaceDraft(f.model, 'from', 'to', () => true), /offline/);
  assert.equal(f.store.read('to'), '@test'); assert.equal(await f.store.readAttachments('to')[0].source.text(), 'hello');
  assert.equal(f.model.draftTransfers.size, 0); f.store.close();
});

test('并行编辑和目标开始运行都会使未提交交接失效', async () => {
  for (const change of [f => f.model.draftVersions.set('from', 1), f => { f.states.to.running = true; }]) {
    const f = await fixture(), retain = f.model.sessions.retain;
    f.model.sessions.retain = id => { const ref = retain(id); change(f); return ref; };
    await assert.rejects(moveWorkspaceDraft(f.model, 'from', 'to', () => true));
    assert.equal(f.store.read('from'), '@test'); assert.equal(f.store.read('to'), ''); assert.equal(f.model.draftTransfers.size, 0);
    f.store.close();
  }
});

test('存储失败提供可读提示，保留原件且释放两边锁', async () => {
  const f = await fixture(); f.model.draftStore.move = () => Promise.reject(new Error('QuotaExceeded'));
  await assert.rejects(moveWorkspaceDraft(f.model, 'from', 'to', () => true), /内容仍保留在原聊天/);
  assert.equal(f.store.read('from'), '@test'); assert.equal(f.model.getSnapshot().attachments.from.length, 1);
  assert.equal(f.model.draftTransfers.size, 0); f.store.close();
});
