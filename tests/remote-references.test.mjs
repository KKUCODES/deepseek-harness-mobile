import test from 'node:test';
import assert from 'node:assert/strict';
import { insertReference, loadReferenceCandidates, referenceSources } from '../src/remote-references.mjs';

function fixture() {
  const writes = [], requests = [];
  const state = { selected: 's1', connectionState: 'connected', session: { openState: 'open' }, drafts: { s1: '现有草稿' } };
  const model = { getSnapshot: () => state, connection: { generation: { getSnapshot: () => ({ id: 'g1' }) } },
    sessions: { subagentAddress: () => undefined }, draft: () => { throw new Error('Must not replace structured draft with text'); },
    inputBindings: { mounted: () => ({ appendReference: value => { writes.push(value); return true; } }) },
    transport: { capabilities: { endpoints: { calls: ['fileReferences/list', 'sessionReferenceResolver/candidates'] } } },
    remote: { fileReferences: { list: async (...args) => { requests.push(args); return { ok: true, value: [
      { path: '中文 file.txt', kind: 'file' }, { path: 'nested', kind: 'directory' }, { path: 'bad"name', kind: 'file' },
    ] }; } }, sessionReferenceResolver: { candidates: async (...args) => { requests.push(args); return { ok: true, value: [
      { sessionId: 's2', displayTitle: '历史聊天', mention: '@[canonical-host-reference]', cwd: 'Q:/project' },
    ] }; } } } };
  return { model, writes, requests, state };
}
test('原文件语法与电脑聊天 mention 保留，选择经原编辑器追加卡片', async () => {
  const { model, writes, requests } = fixture(), signal = new AbortController().signal;
  const groups = await loadReferenceCandidates(model, 's1', '中文', signal);
  assert.deepEqual(requests, [['s1', '中文', signal], ['s1', '中文', signal]]);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].items[0].mention, '@"中文 file.txt"');
  insertReference(model, 's1', groups[0].items[0], 'g1');
  insertReference(model, 's1', groups[1].items[0], 'g1');
  assert.deepEqual(writes, [
    { source: 'reference', ref: '@"中文 file.txt"', clipboardText: '@"中文 file.txt"', appearance: 'file', label: '中文 file.txt' },
    { source: 'reference', ref: '@[canonical-host-reference]', clipboardText: '@[canonical-host-reference]', appearance: 'session', label: '历史聊天' },
  ]);
  assert.throws(() => insertReference(model, 's1', groups[0].items[1], 'g1'));
});

test('输入框未就绪或正在提交时拒绝插入，不回退到纯文本重写', () => {
  const { model, writes } = fixture();
  const item = { kind: 'file', path: 'file.txt', mention: '@file.txt' };
  model.inputBindings.mounted = () => undefined;
  assert.throws(() => insertReference(model, 's1', item, 'g1'), /无法插入引用/);
  model.inputBindings.mounted = () => ({ appendReference: () => false });
  assert.throws(() => insertReference(model, 's1', item, 'g1'), /无法插入引用/);
  assert.deepEqual(writes, []);
});
test('来源独立失败与旧电脑能力不足不会伪装成成功空目录', async () => {
  const { model } = fixture();
  model.remote.fileReferences.list = async () => ({ ok: false, error: new Error('denied') });
  let groups = await loadReferenceCandidates(model, 's1', '', new AbortController().signal);
  assert.equal(groups[0].error, true); assert.equal(groups[1].items.length, 1);
  model.transport.capabilities.endpoints.calls = ['fileReferences/list'];
  assert.deepEqual(referenceSources(model), { files: true, chats: false });
  groups = await loadReferenceCandidates(model, 's1', '', new AbortController().signal);
  assert.equal(groups[1].unavailable, true);
});
test('中途取消抛弃迟到候选，换会话/断线/连接代次变化不能插入旧选择', async () => {
  const { model, state, writes } = fixture(), controller = new AbortController();
  let finish;
  model.remote.fileReferences.list = () => new Promise(resolve => { finish = resolve; });
  const loading = loadReferenceCandidates(model, 's1', '', controller.signal);
  controller.abort(); finish({ ok: true, value: [] });
  await assert.rejects(loading, { name: 'AbortError' });
  const item = { kind: 'file', mention: '@file.txt' };
  assert.throws(() => insertReference(model, 's1', item, 'old-generation'));
  state.selected = 's2'; assert.throws(() => insertReference(model, 's1', item, 'g1'));
  state.selected = 's1'; state.connectionState = 'disconnected'; assert.throws(() => insertReference(model, 's1', item, 'g1'));
  state.connectionState = 'connected'; state.session.openState = 'closed'; assert.throws(() => insertReference(model, 's1', item, 'g1'));
  state.session.openState = 'open'; state.drafts.s1 = 'a'.repeat(100000); assert.throws(() => insertReference(model, 's1', item, 'g1'));
  assert.deepEqual(writes, []);
});
