import { SessionInputShell } from '../../deepseek-harness/packages/client/ui-conversation/src/client/input/facade.ts';
import { $composerLayout } from '../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/projection.ts';
import { imagePromptPart } from './remote-image-input.mjs';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';

/** 原编辑器/提交状态机与手机草稿、附件之间的会话绑定。 */
export class RemoteInputSession {
  constructor(model, reference, binding = reference.binding, view = model) {
    this.model = model; this.reference = reference; this.view = view;
    this.generation = model.connection.generation.getSnapshot()?.id;
    this.active = true;
    this.admission = createSnapshotStore(false);
    this.pending = null;
    this.triggerFacades = new WeakMap();
    const { ctx, session } = binding;
    const sessionId = this.sessionId = binding.sessionId ?? reference.sessionId;
    this.scope = ctx;
    this.shell = new SessionInputShell({
      actx: ctx,
      inputTriggers: () => {
        if (!this.current()) return undefined;
        this.controller = model.ctx.get('inputTriggers')?.sessionOf(ctx);
        if (!this.controller) return undefined;
        let facade = this.triggerFacades.get(this.controller);
        if (!facade) {
          // 区分命令自行处理和回落为普通消息；后者须等真正的发送结果。
          facade = new Proxy(this.controller, { get: (target, key) => {
            if (key === 'adjudicate') return async (...args) => {
              this.adjudicating = true;
              try {
                const outcome = await target.adjudicate(...args);
                if (this.pending) this.pending.waitSink = outcome === undefined;
                return outcome;
              } finally { this.adjudicating = false; }
            };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          } });
          this.triggerFacades.set(this.controller, facade);
        }
        return facade;
      },
      popup: () => model.ctx.get('commandUi')?.popupFor(ctx),
      inbox: session.projections.faceOf('inbox'),
      defaultSink: async (text, attachmentIds, mode, signal) => {
        try {
          this.check();
          const reference = this.reference;
          await model.send(mode, { reference, generation: this.generation, text, attachmentIds, signal }, view);
          if (this.pending) this.pending.result = 'success';
          // 附件单独发送成功时原 shell 不再发布 state，因此主动结束手机提交锁。
          queueMicrotask(() => this.settle());
          return { kind: 'success' };
        } catch (error) {
          if (this.pending) this.pending.result = 'error';
          throw error;
        }
      },
      commandAttachments: {
        serialize: async ids => {
          this.check();
          const items = model.getSnapshot().attachments[sessionId] ?? [];
          const selected = ids.map(id => items.find(item => item.id === id));
          if (selected.some(item => !item || item.state !== 'ready')) throw new Error('remote_attachment_expired');
          const result = await Promise.all(selected.map(item => item.kind === 'image'
            ? imagePromptPart(item, AbortSignal.any([model.lifetime.signal, view.lifetime.signal])) : { type: 'file', receiptId: item.receiptId }));
          this.check();
          if (selected.some(item => !(model.getSnapshot().attachments[sessionId] ?? []).includes(item))) throw new Error('remote_attachment_expired');
          return result;
        },
        release: ids => { void model.changeAttachments(sessionId, items => items.filter(item => !ids.includes(item.id))); },
        unsupportedNotice: () => '此操作不支持附件，请先移除附件。',
      },
    });
    const shell = this.shell;
    shell.setDraft(model.getSnapshot().drafts[sessionId] ?? '');
    const savedEditor = model.getSnapshot().draftEditors?.[sessionId];
    if (savedEditor) this.restoreDraft({ text: shell.snapshot.draft, editor: savedEditor });
    // 原 shell 会在请求落定前清空编辑区。手机先保留持久化草稿，避免换页、
    // 断线或 App 退出使未确认的消息丢失；当前提交落定后才提交草稿变化。
    // 原文字 mirror 不报告“同显示文字、不同引用身份”的替换；跟随原编辑器内容提交。
    // 纯光标移动不落盘，提交期间仍保留提交前快照。
    this.unmirror = shell.editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (!this.active || this.pending || (!dirtyElements.size && !dirtyLeaves.size)) return;
      if (this.restoreFailed && shell.snapshot.draft === this.restoreFailed.text) return;
      this.restoreFailed = null;
      const draft = this.captureDraft();
      void model.writeDraft(sessionId, draft.text, draft.editor);
    });
    this.unstate = shell.state.subscribe(() => this.settle());
    this.unnotice = shell.notices.subscribe(() => this.settle());
    const owner = this;
    const listen = (event, apply, duringCommand = false) => ctx.on(event, function (request) {
      if (this !== ctx || !owner.current() || (owner.pending && !(duringCommand && owner.adjudicating))) return undefined;
      return apply(request) ? true : undefined;
    });
    this.offs = [
      listen('slash/input-begin-command', req => shell.beginCommand(req.claim, req.span)),
      listen('slash/input-insert-reference', req => shell.insertReference(req.reference, req.span)),
      // 原 action 在提交仲裁期间消费自己的 token，仍由 shell 核对位置或完整 token。
      listen('slash/input-consume-token', req => shell.consumeToken(req.guard), true),
      listen('slash/input-insert-text', req => shell.insertText(req.text, req.span, req.continue === true)),
    ];
    // 子视图关闭可能先于 React cleanup；立即取消原 shell 的命令/引用提交。
    this.onViewAbort = () => this.dispose();
    view.lifetime.signal.addEventListener('abort', this.onViewAbort, { once: true });
    if (view.lifetime.signal.aborted) this.dispose();
  }
  current() {
    return this.active && !!this.reference && !this.model.lifetime.signal.aborted
      && !this.view.lifetime.signal.aborted && this.view.reference === this.reference
      && this.model.getSnapshot().connectionState === 'connected'
      && this.model.connection.generation.getSnapshot()?.id === this.generation;
  }
  check() { if (!this.current()) throw new Error('聊天或电脑连接已变化，请核对草稿后重新发送。'); }
  captureDraft() {
    // 提交期间原shell先清空编辑区；尚未确认时交接提交前的结构，不能把它降级成文本。
    return this.pending?.draft ?? this.restoreFailed ?? { text: this.shell.snapshot.draft, editor: this.shell.editor.getEditorState().toJSON() };
  }
  projectDraft(editor) {
    return this.shell.editor.parseEditorState(editor).read(() => $composerLayout().clipboardText);
  }
  appendReference(reference) {
    this.check();
    if (this.pending || this.restoreFailed || this.model.draftTransfers.has(this.sessionId)
      || !['plain', 'claimed'].includes(this.shell.snapshot.phase)) return false;
    const end = () => {
      const offset = this.shell.editor.getEditorState().read(() => $composerLayout().detectText.length);
      return { start: offset, end: offset, draftRev: this.shell.snapshot.draftRev };
    };
    // 菜单选择追加到末尾；使用原编辑操作，保留此前卡片的owner与ID。
    if (this.shell.snapshot.draft && !/\s$/u.test(this.shell.snapshot.draft)
      && !this.shell.insertText(' ', end())) return false;
    return this.shell.insertReference(reference, end());
  }
  restoreDraft(saved) {
    if (!saved || saved.text !== (this.model.getSnapshot().drafts[this.sessionId] ?? '')) return;
    const editor = this.shell.editor;
    try {
      const state = editor.parseEditorState(saved.editor);
      if (state.read(() => $composerLayout().clipboardText) !== saved.text) throw new Error('remote_draft_structure_mismatch');
      // Lexical不接受只有root的空状态；新shell已按同一空草稿初始化。
      if (!state.isEmpty()) editor.setEditorState(state);
    } catch {
      // 无法解析的引用不能自动退化成普通文字发送，也不能自动覆盖磁盘原件。
      this.restoreFailed = saved;
      this.shell.notify('error', '草稿引用无法恢复，请重新选择引用后再发送。');
    }
  }
  submit(mode = 'queue') {
    if (!this.current() || this.pending || this.restoreFailed || this.model.composerBlocks?.storeFor(this.sessionId).getSnapshot() || this.canSubmit?.() === false) return;
    const snapshot = this.shell.snapshot;
    if (!snapshot.draft.trim() && !snapshot.attachmentIds.length) return;
    this.pending = { starting: true, draft: this.captureDraft(), waitSink: snapshot.phase !== 'claimed', noticeSeq: this.shell.notices.getSnapshot()?.seq ?? 0 };
    this.admission.set(true);
    try { this.shell.submit(mode); }
    finally { if (this.pending) this.pending.starting = false; this.settle(); }
  }
  settle() {
    const pending = this.pending;
    if (!pending || !this.active) return;
    const locked = ['adjudicating', 'submitting'].includes(this.shell.snapshot.phase);
    if (locked) pending.wasLocked = true;
    if (pending.starting || locked) return;
    const noticed = (this.shell.notices.getSnapshot()?.seq ?? 0) > pending.noticeSeq;
    if (!pending.result && !noticed && (pending.waitSink || !pending.wasLocked)) return;
    this.pending = null;
    const draft = this.captureDraft();
    void this.model.writeDraft(this.sessionId, draft.text, draft.editor);
    this.admission.set(false);
  }
  sync() {
    if (!this.active || this.pending) return;
    const snapshot = this.model.getSnapshot();
    const draft = snapshot.drafts[this.sessionId] ?? '';
    const attachments = snapshot.attachments[this.sessionId] ?? [];
    if (this.shell.snapshot.draft !== draft) this.shell.setDraft(draft);
    const ids = attachments.map(item => item.id);
    this.shell.pruneAttachments(ids);
    this.shell.addAttachments(ids.filter(id => !this.shell.snapshot.attachmentIds.includes(id)));
  }
  dispose() {
    if (!this.active) return;
    this.view.lifetime.signal.removeEventListener('abort', this.onViewAbort);
    this.active = false; this.unmirror(); this.unstate(); this.unnotice();
    for (const off of this.offs) void off();
    // React 的卸载可能晚于原会话引用释放，不再通过已释放的 reference 查 binding。
    this.controller?.dismiss();
    // 释放编辑器不删除手机持久化的附件原件；它们由 RemoteModel 持有。
    this.shell.dispose();
  }
}
