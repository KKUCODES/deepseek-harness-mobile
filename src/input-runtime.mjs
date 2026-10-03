import { Context } from '@deepseek-ai/cordis';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { InputTriggerController } from '../../deepseek-harness/packages/client/ui-input-trigger/src/client/controller.ts';

const prompts = Object.freeze([
  { name: '总结', label: '总结', value: '请总结下面的内容：' },
  { name: 'translate', label: '翻译', value: '请翻译以下内容：' },
]);

/** 本地纯文本草稿适配；复用原控制器，不注册虚构的 Host Session 或命令执行器。 */
export class InputValidationRuntime {
  state = createSnapshotStore({ text: '', caret: 0, revision: 0, composing: false, enabled: true, applied: 0, rejected: 0 });
  context = new Context();
  lexiconListeners = new Set();
  disposed = false;

  constructor() {
    this.source = {
      name: '本地提示词（验证）', trigger: '/',
      candidates: async (_session, { query }) => prompts.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase()) || item.label.includes(query)),
      onPick: ({ candidate }) => ({ text: candidate.value }),
      lexicon: () => prompts.map(item => item.name),
      subscribeLexicon: (_session, listener) => {
        this.lexiconListeners.add(listener);
        return () => this.lexiconListeners.delete(listener);
      },
    };
    this.sources = [this.source];
    this.removeInputHandler = this.context.on('slash/input-insert-text', request => this.insertText(request) ? true : undefined);
    this.controller = new InputTriggerController({
      actx: this.context,
      // 此身份只交给本地提示词 source；从不作为电脑 Session id 发送。
      sessionId: 'ordinary-input-validation',
      roster: { all: () => this.sources, sources: trigger => this.sources.filter(source => source.trigger === trigger) },
    });
  }

  edit(text, caret, composing = this.state.getSnapshot().composing) {
    if (this.disposed) return;
    const previous = this.state.getSnapshot();
    const next = { ...previous, text, caret: Math.max(0, Math.min(text.length, caret)), composing,
      revision: previous.revision + Number(previous.text !== text) };
    this.state.set(next);
    this.controller.track(next.text, next.caret, { tier: composing ? 'frozen' : 'plain' }, next.revision);
  }

  setComposing(composing) {
    const current = this.state.getSnapshot();
    this.edit(current.text, current.caret, composing);
  }

  insertText({ text, span }) {
    const current = this.state.getSnapshot();
    // 与上游 InputFacade 一样先核对草稿 revision；纯文本 span 直接对应 UTF-16 坐标。
    if (this.disposed || current.composing || !current.enabled || typeof text !== 'string'
      || span?.draftRev !== current.revision || !Number.isInteger(span.start) || !Number.isInteger(span.end)
      || span.start < 0 || span.end < span.start || span.end > current.text.length) {
      if (!this.disposed) this.state.set({ ...current, rejected: current.rejected + 1 });
      return false;
    }
    this.state.set({ ...current, applied: current.applied + 1 });
    this.edit(current.text.slice(0, span.start) + text + current.text.slice(span.end), span.start + text.length);
    return true;
  }

  setEnabled(enabled) {
    const current = this.state.getSnapshot();
    if (this.disposed || current.enabled === enabled) return;
    this.state.set({ ...current, enabled });
    if (enabled) {
      this.sources = [this.source];
      this.controller.sourceAdded(this.source);
    } else {
      this.sources = [];
      this.controller.sourceRemoved(this.source);
      this.controller.dismiss();
    }
  }

  snapshot() {
    return { ...this.state.getSnapshot(), menuOpen: this.controller.menu.getSnapshot().open,
      subscriptions: this.lexiconListeners.size, disposed: this.disposed };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sources = [];
    this.controller.dispose();
    await this.removeInputHandler();
  }
}
