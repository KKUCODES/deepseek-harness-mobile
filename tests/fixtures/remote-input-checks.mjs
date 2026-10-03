import { Context } from '@deepseek-ai/cordis';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { RemoteInputSession } from '../../src/remote-input-session.mjs';

// 原 SessionInputShell/Lexical 的隔离契约回放；不调用电脑或模型。
export async function checkRemoteInput() {
  const passed = [];
  const equal = (actual, expected, message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)}`);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  async function run(name, test) {
    const ctx = new Context(), calls = [], writes = [];
    const state = { drafts: { one: '保留草稿' }, draftEditors: {}, attachments: { one: [] }, connectionState: 'connected' };
    const controller = { lexicon: createSnapshotStore(new Map()), track() {}, dismiss() {}, openReference() { return true; },
      serializeReference: async (_source, ref) => `model:${ref}`, adjudicate: async () => undefined };
    ctx.provide('inputTriggers', { sessionOf: () => controller });
    const reference = { sessionId: 'one', binding: { ctx, session: { projections: { faceOf: () => createSnapshotStore(undefined) } } } };
    let dispatch = async () => {};
    const model = { ctx, reference, draftTransfers: new Map(), lifetime: new AbortController(), connection: { generation: createSnapshotStore({ id: 'g1' }) },
      getSnapshot: () => state, async writeDraft(id, value, editor) { state.drafts[id] = value; state.draftEditors[id] = editor; writes.push(value); },
      async changeAttachments(id, update) { state.attachments[id] = update(state.attachments[id]); },
      async send(mode, request) {
        calls.push({ mode, text: request.text, ids: request.attachmentIds, signal: request.signal });
        await dispatch(request);
        state.attachments.one = state.attachments.one.filter(item => !request.attachmentIds.includes(item.id));
      } };
    const input = new RemoteInputSession(model, reference);
    const edit = text => { input.shell.setDraft(text); };
    const chip = () => {
      edit('@example');
      return input.shell.insertReference({ source: 'fixture', ref: 'id1', label: '可见引用', clipboardText: '@example', appearance: 'file' },
        { start: 0, end: 8, draftRev: input.shell.snapshot.draftRev });
    };
    try { await test({ input, model, state, controller, calls, writes, edit, chip, dispatch: fn => { dispatch = fn; } }); passed.push(name); }
    finally { input.dispose(); await ctx.fiber.dispose(); }
  }
  await run('引用按 owner 序列化；确认前保留草稿且不重复提交', async ({ input, state, calls, chip, dispatch }) => {
    equal(chip(), true, 'chip 插入');
    const pending = Promise.withResolvers(); dispatch(() => pending.promise);
    input.submit(); await tick();
    equal(calls.map(call => call.text), ['model:id1'], '使用模型表示而非展示文本');
    equal(state.drafts.one.trim(), '@example', '持久化草稿确认前保持');
    equal(input.shell.snapshot.draft, '', '编辑区暂时清空');
    input.sync(); input.submit(); equal(calls.length, 1, '不会把旧附件/草稿再次加入');
    pending.resolve(); await tick();
    equal(input.admission.getSnapshot(), false, '提交结束'); equal(state.drafts.one, '', '确认后清空');
  });
  await run('菜单追加保留原引用身份并通过原提供方发送；提交中拒绝追加', async ({ input, state, calls, chip, dispatch }) => {
    chip();
    const added = { source: 'fixture', ref: 'id2', label: '另一引用', clipboardText: '@second', appearance: 'file' };
    equal(input.appendReference(added), true, '菜单追加');
    equal(input.shell.snapshot.occurrences.map(item => item.ref), ['id1', 'id2'], '两枚引用身份');
    const pending = Promise.withResolvers(); dispatch(() => pending.promise);
    input.submit(); await tick();
    equal(calls.map(call => call.text.trim()), ['model:id1 model:id2'], '按各自身份序列化');
    equal(input.appendReference(added), false, '发送期间不可追加');
    pending.resolve(); await tick();
    equal(state.drafts.one, '', '确认后无误插入内容');
  });
  await run('草稿交接期间拒绝菜单引用且保留原编辑器', async ({ input, model, chip }) => {
    chip(); const before = input.captureDraft();
    model.draftTransfers.set('one', {});
    equal(input.appendReference({ source: 'fixture', ref: 'id2', label: '引用', clipboardText: '@second', appearance: 'file' }), false, '交接期间不可追加');
    equal(input.captureDraft(), before, '未改写草稿');
  });
  await run('发送失败保留结构化引用及草稿', async ({ input, state, chip, dispatch }) => {
    chip(); dispatch(async () => { throw new Error('fixture send failure'); });
    input.submit(); await tick();
    equal(input.shell.snapshot.occurrences.length, 1, '失败恢复引用块');
    equal(state.drafts.one.trim(), '@example', '失败恢复持久化草稿');
    equal(input.admission.getSnapshot(), false, '失败解除锁');
  });
  await run('编辑器交接保留引用并重新调用原提供方序列化', async ({ input, model, calls, chip }) => {
    chip(); const draft = input.captureDraft(); input.dispose();
    const next = new RemoteInputSession(model, model.reference);
    try {
      next.restoreDraft(draft);
      equal(next.shell.snapshot.occurrences[0]?.ref, 'id1', '恢复原引用身份');
      equal(calls.length, 0, '恢复本身不发送');
      next.submit(); await tick();
      equal(calls.map(call => call.text), ['model:id1'], '发送仍调用原提供方');
    } finally { next.dispose(); }
  });
  await run('新绑定自动恢复结构，同显示文字引用替换也更新持久化身份', async ({ input, model, state, calls, chip }) => {
    chip();
    const text = state.drafts.one;
    input.shell.insertReference({ source: 'fixture', ref: 'id2', label: '另一引用', clipboardText: '@example', appearance: 'file' },
      { start: 0, end: 1, draftRev: input.shell.snapshot.draftRev });
    equal(state.drafts.one, text, '文字投影相同');
    // JSON往返模拟跨运行时载入，不调用captureDraft/restoreDraft手动交接。
    state.draftEditors = JSON.parse(JSON.stringify(state.draftEditors)); input.dispose();
    const next = new RemoteInputSession(model, model.reference);
    try {
      equal(next.shell.snapshot.occurrences[0]?.ref, 'id2', '持久化的是最新身份');
      equal(calls.length, 0, '恢复不会自动发送');
      next.submit(); await tick();
      equal(calls.map(call => call.text), ['model:id2'], '恢复后由当前提供方解析');
      equal(state.drafts.one, '', '成功后清空');
    } finally { next.dispose(); }
  });
  await run('在途交接取消旧序列化且不自动重发，提供方消失时拒绝降级', async ({ input, model, controller, calls, chip }) => {
    chip(); const pending = Promise.withResolvers(); let signal;
    controller.serializeReference = (_source, _ref, value) => { signal = value; return pending.promise; };
    input.submit(); const draft = input.captureDraft(); input.dispose();
    equal(signal.aborted, true, '交接立即取消旧提交');
    const next = new RemoteInputSession(model, model.reference);
    try {
      next.restoreDraft(draft); pending.resolve('late'); await tick();
      equal(calls.length, 0, '旧结果和重建不会发送');
      equal(next.shell.snapshot.occurrences[0]?.ref, 'id1', '提交前引用保持');
      controller.serializeReference = async () => { throw new Error('reference source unloaded'); };
      next.submit(); await tick();
      equal(calls.length, 0, '提供方消失不发送显示文字');
      equal(next.shell.snapshot.occurrences.length, 1, '失败保留引用');
    } finally { next.dispose(); }
  });
  await run('旧结构不能覆盖其他入口更新后的草稿', async ({ input, model, state, chip }) => {
    chip(); const draft = input.captureDraft(); input.dispose();
    state.drafts.one = '其他入口的新草稿';
    const next = new RemoteInputSession(model, model.reference);
    try {
      next.restoreDraft(draft);
      equal(next.shell.snapshot.draft, '其他入口的新草稿', '保留较新的文字');
      equal(next.shell.snapshot.occurrences.length, 0, '过期引用不恢复');
    } finally { next.dispose(); }
  });
  await run('损坏结构换页后仍保留原件并拒绝按纯文字发送', async ({ input, model, state, calls }) => {
    input.dispose();
    state.draftEditors.one = { root: { type: 'unknown-plugin-node', version: 1 } };
    const next = new RemoteInputSession(model, model.reference);
    let replacement;
    try {
      equal(!!next.restoreFailed, true, '解析失败被识别');
      const saved = next.captureDraft(); next.dispose();
      replacement = new RemoteInputSession(model, model.reference); replacement.restoreDraft(saved);
      replacement.submit(); await tick(); equal(calls.length, 0, '换页仍不发送降级文本');
      equal(replacement.captureDraft().editor, state.draftEditors.one, '保留损坏原件供重试');
      replacement.shell.setDraft('重新输入的消息'); replacement.submit(); await tick();
      equal(calls.map(call => call.text), ['重新输入的消息'], '明确重新编辑后可发送');
    } finally { next.dispose(); replacement?.dispose(); }
  });
  await run('可解析但与草稿文字不符的结构不能静默降级', async ({ input, model, state, calls, chip }) => {
    chip(); const saved = input.captureDraft(); input.dispose();
    state.drafts.one = '记录的文字与结构不一致';
    state.draftEditors.one = saved.editor;
    const next = new RemoteInputSession(model, model.reference);
    try {
      equal(!!next.restoreFailed, true, '结构投影不一致必须提示恢复失败');
      next.submit(); await tick(); equal(calls.length, 0, '不得发送降级文字');
      equal(next.captureDraft().editor, saved.editor, '仍保留原结构');
      next.shell.setDraft('用户重新编辑'); next.submit(); await tick();
      equal(calls.map(call => call.text), ['用户重新编辑'], '明确编辑后解除保护');
    } finally { next.dispose(); }
  });
  await run('引用 owner 卸载或序列化失败时不得降级发送', async ({ input, controller, calls, state, chip }) => {
    chip(); controller.serializeReference = async () => { throw new Error('reference source unloaded'); };
    input.submit(); await tick();
    equal(calls.length, 0, '未发送'); equal(state.drafts.one.trim(), '@example', '仍保留草稿');
    equal(input.admission.getSnapshot(), false, '解除提交锁');
  });
  await run('序列化中离开会话取消；持久化草稿不丢失', async ({ input, controller, calls, state, chip }) => {
    chip(); const pending = Promise.withResolvers(); let signal;
    controller.serializeReference = (_source, _ref, value) => { signal = value; return pending.promise; };
    input.submit(); input.dispose(); equal(signal.aborted, true, '旧提交已取消');
    pending.resolve('late model text'); await tick();
    equal(calls.length, 0, '迟到序列化不发送'); equal(state.drafts.one.trim(), '@example', '持久化草稿仍在');
  });
  await run('视图生命周期结束立即取消原引用提交，不等待页面卸载', async ({ input, model, controller, calls, state, chip }) => {
    chip(); const pending = Promise.withResolvers(); let signal;
    controller.serializeReference = (_source, _ref, value) => { signal = value; return pending.promise; };
    input.submit(); model.lifetime.abort();
    equal(input.active, false, '输入立即释放'); equal(signal.aborted, true, '原序列化信号取消');
    pending.resolve('late reference'); await tick();
    equal(calls.length, 0, '不发送迟到结果'); equal(state.drafts.one.trim(), '@example', '保留原草稿');
  });
  await run('旧候选位置/断线不插入或发送', async ({ input, model, state, edit, calls }) => {
    const span = { start: 0, end: 2, draftRev: input.shell.snapshot.draftRev };
    edit('新草稿'); equal(input.shell.insertText('旧候选', span), false, '旧位置拒绝');
    state.connectionState = 'disconnected'; input.submit(); equal(calls.length, 0, '离线拒绝');
    state.connectionState = 'connected'; model.connection.generation.set({ id: 'g2' });
    input.submit(); equal(calls.length, 0, '旧连接代次拒绝');
  });
  await run('仅附件发送成功解除锁且不重新挂回附件', async ({ input, state, calls, edit }) => {
    edit(''); state.attachments.one = [{ id: 'a', state: 'ready' }]; input.sync();
    input.submit(); await tick(); input.sync();
    equal(calls[0].ids, ['a'], '同一附件快照'); equal(input.admission.getSnapshot(), false, '附件发送解锁');
    equal(input.shell.snapshot.attachmentIds, [], '已发送附件清理');
  });
  await run('命令回落为普通消息时继续等发送结果', async ({ input, edit, state, dispatch }) => {
    edit('/plain hello'); const pending = Promise.withResolvers(); dispatch(() => pending.promise);
    input.submit(); await tick(); equal(input.admission.getSnapshot(), true, '判定结束不等于发送结束');
    equal(state.drafts.one, '/plain hello', '仍保留草稿');
    pending.resolve(); await tick(); equal(input.admission.getSnapshot(), false, '发送确认后解锁');
  });
  await run('命令认领成功/失败均沿原提交状态机', async ({ input, controller, edit, calls, state }) => {
    controller.adjudicate = async () => ({ claim: { name: 'test', token: '/test ', submit: async () => ({ kind: 'success' }) } });
    edit('/test hello'); input.submit(); await tick();
    equal(calls.length, 0, '命令不走普通发送'); equal(input.admission.getSnapshot(), false, '命令成功解锁');
    equal(state.drafts.one, '', '命令成功清空');
    controller.adjudicate = async () => ({ claim: { name: 'test', token: '/test ', submit: async () => ({ kind: 'error', text: 'fixture failure' }) } });
    edit('/test retry'); input.submit(); await tick();
    equal(state.drafts.one, '/test retry', '命令失败保留'); equal(input.admission.getSnapshot(), false, '命令失败解锁');
  });
  return passed;
}

// 复用页面实际的 RemoteModel、原 SessionBinding 和输入服务，传输仍由测试页协议回放。
export async function checkViewInputs(model) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const primary = model.reference, primaryInput = model.inputBindings.mounted();
  assert(primary?.sessionId === 'one' && primaryInput?.current(), '先打开主聊天，再核验并存的输入');
  const saved = { ...model.snapshot.drafts };
  const view = model.createSessionView(); let entry, input;
  try {
    await view.select('two');
    entry = model.inputBindings.forBinding(view.reference.binding);
    input = entry.mount(view.reference, view);
    primaryInput.shell.setDraft('主输入草稿'); entry.target.setDraft('旁栏输入草稿');
    assert(primaryInput.current() && input.current(), '两个不同会话的编辑器应同时有效');
    assert(model.snapshot.drafts.one === '主输入草稿' && model.snapshot.drafts.two === '旁栏输入草稿', '草稿归属应独立');
    assert(model.inputBindings.mounted('two') === input, '原文件命令应找到目标会话输入框');
    input.shell.setDraft('@file');
    assert(input.shell.insertReference({ source: 'fixture', ref: 'retained-file', label: '保留引用', clipboardText: '@file', appearance: 'file' },
      { start: 0, end: 5, draftRev: input.shell.snapshot.draftRev }), '插入结构化引用');
    entry.unmount(input);
    input = entry.mount(view.reference, view);
    assert(input.shell.snapshot.occurrences[0]?.ref === 'retained-file', '同一会话输入重挂载必须保留引用身份');
    assert(input.shell.snapshot.occurrences[0]?.source === 'fixture', '不能把引用降级成显示文字');
    input.shell.setDraft('旁栏输入草稿');
    await model.changeAttachments('one', () => [{ id: 'primary-file', state: 'ready' }]);
    await model.changeAttachments('two', () => [{ id: 'side-file', state: 'ready' }]);
    input.sync();
    assert(entry.target.removeAttachment('side-file'), '旁栏插件能够移除自己的附件');
    assert(model.snapshot.attachments.two.length === 0 && model.snapshot.attachments.one.length === 1, '附件移除不能误用主会话ID');
    view.dispose();
    assert(!input.active, '关闭视图无需等待页面卸载即可释放编辑器');
    assert(!input.current() && primaryInput.current(), '关闭旁栏只结束自己的输入');
    entry.target.setDraft('已失效的修改'); entry.target.submit('queue');
    assert(model.snapshot.drafts.two === '旁栏输入草稿', '失效输入不应修改持久化草稿');
    assert(model.reference === primary, '主会话引用保持');
    return { independentInputs: true, sharedDraftStore: true, scopedAttachmentRemoval: true, closedInputRejected: true };
  } finally {
    if (input) entry.unmount(input);
    view.dispose();
    await model.changeAttachments('one', () => []); await model.changeAttachments('two', () => []);
    await model.writeDraft('one', saved.one ?? ''); await model.writeDraft('two', saved.two ?? '');
    primaryInput.sync();
  }
}
