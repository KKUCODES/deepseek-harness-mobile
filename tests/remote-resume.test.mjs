import test from 'node:test';
import assert from 'node:assert/strict';
import { captureRemoteResume } from '../src/remote-resume.mjs';

test('客户端重建保留附件原件，有原件的文件需重新上传，不携带旧凭据与交互', () => {
  const source = new Blob(['image']);
  const snapshot = { selected: 'chat', drafts: { chat: '草稿', other: '另一会话' },
    attachments: { chat: [
      { id: 'image', name: 'test.png', mediaType: 'image/png', kind: 'image', state: 'ready', source },
      { id: 'file', name: 'test.txt', bytes: 3, state: 'ready', receiptId: 'old-receipt', file: { attachmentId: 'old' } },
      { id: 'upload', name: 'upload.txt', state: 'uploading' },
      { id: 'unknown', state: 'uncertain', receiptId: 'old' },
      { id: 'stored', name: 'stored.txt', source: new Blob(['text']), state: 'ready', receiptId: 'old', file: { attachmentId: 'old' } },
    ] }, events: ['old-approval'], model: { old: true }, session: { running: true } };
  const saved = captureRemoteResume({ getSnapshot: () => snapshot, sending: new Set() });
  assert.deepEqual(Object.keys(saved).sort(), ['attachments', 'command', 'draftEditors', 'drafts', 'jobOutput', 'panels', 'selected', 'selectedTarget', 'selectionTrail', 'workspace']);
  assert.deepEqual(saved.drafts, snapshot.drafts);
  assert.notEqual(saved.drafts, snapshot.drafts);
  assert.equal(saved.attachments.chat[0].source, source);
  assert.equal(saved.attachments.chat[0].state, 'ready');
  assert.deepEqual(saved.attachments.chat.slice(1).map(item => item.state), ['error', 'error', 'uncertain', 'restored']);
  assert.equal(saved.attachments.chat[4].source, snapshot.attachments.chat[4].source);
  assert.ok(saved.attachments.chat.every(item => !item.receiptId && !item.file));
  assert.equal(snapshot.attachments.chat[1].state, 'ready');
});

test('重建时正在发送的附件必须核对结果，不自动作为可发送内容恢复', () => {
  const saved = captureRemoteResume({ sending: new Set(['chat']), getSnapshot: () => ({ selected: 'chat', drafts: { chat: 'sending' },
    attachments: { chat: [{ id: 'image', name: 'test.png', mediaType: 'image/png', kind: 'image', source: new Blob(), state: 'ready' }] } }) });
  assert.equal(saved.attachments.chat[0].state, 'uncertain');
  assert.ok(saved.attachments.chat[0].source instanceof Blob);
});

test('重建捕获当前命令阅读视图，已关闭窗口不恢复', () => {
  const view = { target: { sessionId: 'chat', nodeId: 'node', callId: 'call' }, full: true,
    liveOutput: true, scrollTop: 320, output: { stream: 'stderr', mode: 'history', reader: { outputId: 'original', snapshot: { offset: 65536 } } } };
  const model = { sending: new Set(), getSnapshot: () => ({ selected: 'chat', drafts: {}, attachments: {} }), captureCommand: () => view };
  assert.equal(captureRemoteResume(model).command, view);
  delete model.captureCommand;
  assert.equal(captureRemoteResume(model).command, undefined);
});
