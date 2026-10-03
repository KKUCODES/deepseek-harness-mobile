import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { RemoteInputSession } from './remote-input-session.mjs';

/** 标准插槽订阅跟随真实 SessionBinding，编辑器随手机页面重建。 */
export class RemoteInputBindings {
  constructor(model) { this.model = model; this.entries = new WeakMap(); }

  for(actx) {
    const session = this.model.sessions.sessionOf(actx);
    const binding = session && this.model.sessions.binding(session.sessionId);
    if (!binding || binding.session !== session || actx.fiber.uid === null) {
      throw new Error('conversation.input.for requires a retained Session scope');
    }
    return this.forBinding(binding).target;
  }

  forBinding(binding) {
    let entry = this.entries.get(binding);
    if (entry) return entry;
    const model = this.model;
    entry = { active: true, input: null, unsubscribe: null };
    const replace = (reference, view = model) => {
      const notice = entry.input?.shell.notices.getSnapshot();
      const draft = entry.input?.captureDraft();
      entry.unsubscribe?.(); entry.input?.dispose();
      const input = entry.input = new RemoteInputSession(model, reference, binding, view);
      // 只跨同一binding的编辑器交接；不持久化插件对象或未确认的提交状态。
      input.restoreDraft(draft);
      // 提示属于会话；编辑器因换页重建时不能把迟到的命令结果丢掉。
      if (notice) input.shell.notify(notice.level, notice.text);
      if (entry.state) entry.state.set(input.shell.snapshot);
      else entry.state = createSnapshotStore(input.shell.snapshot);
      entry.unsubscribe = input.shell.state.subscribe(() => entry.state.set(input.shell.snapshot));
      return input;
    };
    replace(undefined);
    const alive = () => entry.active && binding.ctx.fiber.uid !== null;
    const editable = () => alive() && entry.input.current() && !entry.input.pending && !model.draftTransfers.has(binding.sessionId);
    const available = () => model.getSnapshot().attachments[binding.sessionId] ?? [];
    entry.target = Object.freeze({
      state: entry.state,
      beginCommand: (claim, span) => editable() && entry.input.shell.beginCommand(claim, span),
      insertReference: (reference, span) => editable() && entry.input.shell.insertReference(reference, span),
      setDraft: text => {
        if (!editable()) return;
        if (typeof text !== 'string' || text.length > 100000) throw new Error('remote_draft_invalid');
        entry.input.shell.setDraft(text);
      },
      addAttachments: ids => {
        if (!editable() || !Array.isArray(ids) || ids.some(id => !available().some(item => item.id === id))) return false;
        const existing = entry.input.shell.snapshot.attachmentIds;
        return entry.input.shell.addAttachments([...new Set(ids)].filter(id => !existing.includes(id)));
      },
      removeAttachment: id => {
        if (!editable() || !entry.input.shell.removeAttachment(id)) return false;
        // 移除同一手机附件登记；否则下一次草稿同步会把附件重新加回输入框。
        void model.removeAttachment(id, binding.sessionId);
        return true;
      },
      pruneAttachments: ids => {
        if (!editable() || !Array.isArray(ids)) return;
        const valid = new Set(available().map(item => item.id));
        entry.input.shell.pruneAttachments(ids.filter(id => valid.has(id)));
      },
      submit: mode => { if (alive()) entry.input.submit(mode); },
      notify: (level, text) => { if (alive()) entry.input.shell.notify(level, text); },
      focus: () => { if (editable()) entry.input.shell.focus(); },
    });
    entry.actions = Object.freeze({
      setDraft: entry.target.setDraft, addAttachments: entry.target.addAttachments,
      removeAttachment: id => { entry.target.removeAttachment(id); },
      pruneAttachments: entry.target.pruneAttachments,
      submit: () => entry.target.submit('queue'),
    });
    entry.mount = (reference, view = model) => {
      if (!alive() || reference.binding !== binding) throw new Error('remote_input_scope_expired');
      // 插件可能在选中聊天、读取本机草稿前已创建空shell。挂载时用恢复后的
      // 草稿重新建立编辑器，避免setRootElement把预创建的空内容写回存储。
      return replace(reference, view);
    };
    entry.unmount = input => {
      // 新一代页面可能先挂载，旧 React cleanup 不得释放新编辑器。
      if (entry.input !== input) return;
      if (alive() && !model.lifetime.signal.aborted) replace(undefined);
      else input.dispose();
    };
    binding.ctx.effect(() => () => {
      entry.active = false; entry.unsubscribe?.(); entry.input.dispose(); this.entries.delete(binding);
      model.composerBlocks?.forget(binding.sessionId);
    }, 'DSHM input standard binding');
    this.entries.set(binding, entry);
    return entry;
  }

  mounted(sessionId = this.model.reference?.sessionId) {
    const binding = sessionId && this.model.sessions.binding(sessionId);
    return binding && !this.model.lifetime.signal.aborted ? this.entries.get(binding)?.input : undefined;
  }
}
