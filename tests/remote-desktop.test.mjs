import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopRequest, workspaceDesktopRequest, attachmentDesktopRequest, canOpenDesktopFile } from '../src/remote-desktop.mjs';

function fixture() {
  const calls = []; let finish, cancelled = false;
  const model = { transport: { capabilities: { desktopOpen: true } }, getSnapshot: () => ({ selected: 'chat' }), client: {
    request(operation) { calls.push(operation); return { promise: new Promise(resolve => { finish = resolve; }), cancel() { cancelled = true; } }; },
  } };
  return { model, calls, finish: value => finish(value), cancelled: () => cancelled };
}

test('历史附件独立协商并只传原引用，确认绑定完整身份而非显示路径', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const file = { sessionId: 'chat', path: 'C:/ignored.txt', attachment: { kind: 'file', attachmentId: 'original', name: 'report.txt' } };
  f.model.transport.capabilities.desktopOpenWorkspace = true;
  assert.equal(canOpenDesktopFile(f.model, file), false);
  f.model.transport.capabilities.desktopOpenAttachment = true;
  assert.equal(canOpenDesktopFile(f.model, file), true);
  const preparing = attachmentDesktopRequest(f.model, file, null, signal);
  assert.deepEqual(f.calls[0], { method: 'remote.prepareDesktopAttachment', sessionId: 'chat', ...file.attachment });
  const snapshot = '65716e33-68b6-4e0d-8c70-0d1ad0ca4e56';
  f.finish({ name: 'pc', available: true, fileManager: null, snapshot, fileName: 'report.txt', attachmentCopy: true });
  const prepared = await preparing;
  for (const attachment of [{ ...file.attachment, attachmentId: 'other' }, { ...file.attachment, name: 'other.txt' }, { kind: 'image', attachmentId: 'original' }])
    await assert.rejects(attachmentDesktopRequest(f.model, { ...file, attachment }, prepared, signal), /stale/);
  const opening = attachmentDesktopRequest(f.model, { ...file, path: 'display only' }, prepared, signal);
  assert.deepEqual(f.calls[1], { method: 'remote.openDesktopAttachment', sessionId: 'chat', snapshot, confirmed: true });
  f.finish({ opened: true }); await opening;
});

test('历史图片准备不传文件路径；关闭忽略迟到成功，旧主机和跨聊天不打开', async () => {
  const f = fixture(), controller = new AbortController();
  const file = { sessionId: 'chat', path: 'image.png', attachment: { kind: 'image', attachmentId: 'picture' } };
  await assert.rejects(attachmentDesktopRequest(f.model, file, null, controller.signal), /unavailable/);
  f.model.transport.capabilities.desktopOpenAttachment = true;
  await assert.rejects(attachmentDesktopRequest(f.model, { ...file, sessionId: 'other' }, null, controller.signal), /stale/);
  const preparing = attachmentDesktopRequest(f.model, file, null, controller.signal);
  assert.deepEqual(f.calls[0], { method: 'remote.prepareDesktopAttachment', sessionId: 'chat', kind: 'image', attachmentId: 'picture' });
  controller.abort(); f.finish({}); await assert.rejects(preparing, { name: 'AbortError' });
  assert.equal(f.cancelled(), true); assert.equal(f.calls.length, 1);
});
test('读取目的地不打开，确认后只发送当前会话原坐标，忽略任意显示路径', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const reading = desktopRequest(f.model, null, signal);
  assert.deepEqual(f.calls, [{ method: 'remote.desktop' }]);
  f.finish({ name: 'my-pc', available: true, fileManager: 'explorer' }); await reading;
  const opening = desktopRequest(f.model, { source: 'changes', sessionId: 'chat', seq: 4, index: 2, path: 'ignored' }, signal);
  assert.deepEqual(f.calls[1], { method: 'remote.openFile', source: 'changes', sessionId: 'chat', seq: 4, index: 2, confirmed: true });
  f.finish({ opened: true }); await opening;
});

test('文件夹显示需单独能力和交付坐标，不能把动作降级为打开', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const coordinates = { source: 'presented', sessionId: 'chat', seq: 4, index: 2, action: 'reveal' };
  await assert.rejects(desktopRequest(f.model, coordinates, signal), /unavailable/);
  f.model.transport.capabilities.desktopReveal = true;
  await assert.rejects(desktopRequest(f.model, { ...coordinates, source: 'changes' }, signal), /unavailable/);
  await assert.rejects(desktopRequest(f.model, { ...coordinates, action: 'execute' }, signal), /stale/);
  assert.equal(f.calls.length, 0);
  const revealing = desktopRequest(f.model, coordinates, signal);
  assert.deepEqual(f.calls[0], { method: 'remote.openFile', ...coordinates, confirmed: true });
  f.finish({ opened: true }); await revealing;
});

test('正文与工具文件先准备确认，打开只携带快照且附件不降级为路径', async () => {
  const f = fixture(), signal = new AbortController().signal;
  f.model.transport.capabilities.desktopOpenWorkspace = true;
  const file = { sessionId: 'chat', path: 'report.txt' };
  assert.equal(canOpenDesktopFile(f.model, file), true);
  assert.equal(canOpenDesktopFile(f.model, { ...file, attachment: {} }), false);
  const preparing = workspaceDesktopRequest(f.model, file, null, signal);
  assert.deepEqual(f.calls[0], { method: 'remote.prepareDesktopFile', ...file });
  const snapshot = '65716e33-68b6-4e0d-8c70-0d1ad0ca4e56';
  f.finish({ name: 'pc', available: true, fileManager: 'explorer', snapshot, fileName: 'report.txt' });
  const prepared = await preparing;
  for (const changed of [{ ...file, attachment: {} }, { ...file, path: 'other.txt' }, { ...file, sessionId: 'other' }])
    await assert.rejects(workspaceDesktopRequest(f.model, changed, prepared, signal), /stale/);
  const opening = workspaceDesktopRequest(f.model, file, prepared, signal);
  assert.deepEqual(f.calls[1], { method: 'remote.openDesktopFile', sessionId: 'chat', snapshot, confirmed: true });
  f.finish({ opened: true }); await opening;
});

test('普通文件确认取消、迟到应答与旧电脑能力不产生打开', async () => {
  const f = fixture(), controller = new AbortController(), file = { sessionId: 'chat', path: 'report.txt' };
  assert.equal(canOpenDesktopFile(f.model, file), false);
  await assert.rejects(workspaceDesktopRequest(f.model, file, null, controller.signal), /unavailable/);
  f.model.transport.capabilities.desktopOpenWorkspace = true;
  const preparing = workspaceDesktopRequest(f.model, file, null, controller.signal);
  controller.abort(); f.finish({}); await assert.rejects(preparing, { name: 'AbortError' });
  assert.equal(f.cancelled(), true); assert.equal(f.calls.length, 1);
});
test('失效选择或非法坐标不请求，关闭后取消且忽略迟到成功', async () => {
  const f = fixture(), controller = new AbortController();
  for (const patch of [{ sessionId: 'other' }, { seq: -1 }, { index: 1.1 }, { source: 'path' }]) {
    await assert.rejects(desktopRequest(f.model, { source: 'presented', sessionId: 'chat', seq: 1, index: 0, ...patch }, controller.signal), /stale/);
  }
  assert.equal(f.calls.length, 0);
  const reading = desktopRequest(f.model, null, controller.signal); controller.abort(); f.finish({ name: 'late', available: true, fileManager: null });
  await assert.rejects(reading, { name: 'AbortError' }); assert.equal(f.cancelled(), true); assert.equal(f.calls.length, 1);
});
