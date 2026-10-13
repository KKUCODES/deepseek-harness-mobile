import { RemotePluginSettingsScope } from './remote-plugin-settings.mjs';
import { RemotePresetDirectory } from './remote-preset-directory.mjs';
import { RemotePresetManagement } from './remote-preset-management.mjs';

/** 新版原预设页面继续负责列表、帮助和声明预览；默认值只走固定管理设置通道。 */
export class RemotePresetDefaults {
  constructor(model) {
    this.model = model;
    this.scope = new RemotePluginSettingsScope(model, 'agent-preset-registry');
    this.directory = new RemotePresetDirectory(model);
    this.management = new RemotePresetManagement(model);
  }
  bind(props) {
    const source = props.hooks.agentPresetSection, scope = this.scope, model = this.model;
    let held, original, writable;
    const store = {
      getSnapshot() {
        const next = source.getSnapshot(), allowed = scope.getSnapshot().writable;
        if (original !== next || writable !== allowed) {
          original = next; writable = allowed;
          held = { ...next, saving: next.saving || !allowed };
        }
        return held;
      },
      subscribe(listener) {
        const disposers = [source.subscribe(listener), scope.subscribe(listener)];
        return () => disposers.forEach(dispose => dispose());
      },
    };
    const load = async () => { await scope.load(); if (!scope.lifetime.signal.aborted) await props.load(); };
    const makeDefault = async id => {
      if (scope.lifetime.signal.aborted || source.getSnapshot().saving) return;
      const row = source.getSnapshot().rows.find(row => row.id === id && row.broken === undefined);
      if (!row || !scope.getSnapshot().writable) return;
      const selected = model.snapshot.selected, request = model.sessionView.request;
      const generation = model.connection.generation.getSnapshot()?.id;
      const blank = model.snapshot.session?.blank;
      source.set({ ...source.getSnapshot(), saving: true, error: null });
      try {
        if (!await scope.set('selectedDefault', id)) throw new Error(scope.getSnapshot().error ?? '默认模式未保存，请重新读取。');
        if (scope.lifetime.signal.aborted) return;
        await props.load();
        // 默认值影响后续会话；只有原来仍在同一空白会话时才同步当前选择，历史会话保持原组成。
        if (blank && selected === model.snapshot.selected && request === model.sessionView.request
          && generation === model.connection.generation.getSnapshot()?.id && model.snapshot.session?.blank) {
          await model.agentPresets.load();
          await model.agentPresets.choose(id, selected);
        }
      } catch (error) {
        if (!scope.lifetime.signal.aborted) source.set({ ...source.getSnapshot(), error: error.message });
      } finally {
        if (!scope.lifetime.signal.aborted) source.set({ ...source.getSnapshot(), saving: false });
      }
    };
    return { ...props, hooks: { ...props.hooks, agentPresetSection: store }, load, makeDefault };
  }
  dispose() { this.scope.dispose(); this.directory.dispose(); this.management.dispose(); }
}
