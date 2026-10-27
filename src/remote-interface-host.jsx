import React from 'react';
import { Context } from '@deepseek-ai/cordis';
import { SlotRegistry } from '@upstream/ui-renderer/src/client/registry.ts';
import { createSlotRenderer } from '@upstream/ui-renderer/src/client/scoped-slots.tsx';
import { renderSessionArea } from '@upstream/ui-session/src/client/session-provider.tsx';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { MobileInterfacePlugins, REMOTE_HOME_SLOT, REMOTE_CONNECTION_SLOT } from './mobile-interface-plugins.mjs';
import { PhonePluginHost, phonePluginsFor } from './phone-plugins.mjs';

/** 本地页面宿主先于电脑连接存在；重连只替换会话模型，不重启界面插件或抢占第二份运行租约。 */
export class RemoteInterfaceHost {
  constructor(registry = phonePluginsFor('remote')) {
    this.ctx = new Context();
    this.slots = new SlotRegistry(this.ctx);
    this.slots.install(createSlotRenderer());
    // 原renderer根包含session-maybe；本地页面明确没有Session，拒绝借此访问电脑会话。
    const absent = createSnapshotStore({ key: undefined, hooks: {}, keyedHooks: {}, props: {} });
    this.slots.installScope('session', { current: absent, bindingSource: target => {
      if (target !== undefined) throw Error('Interface pages do not own sessions');
      return absent;
    }, renderArea: renderSessionArea });
    this.slots.register({ name: 'root', scope: 'root', children: {
      [REMOTE_HOME_SLOT]: { kind: 'single', scope: 'root' },
      [REMOTE_CONNECTION_SLOT]: { kind: 'single', scope: 'root' },
    } }, ({ surface, owner, fallback, renderSlot }) => renderSlot(surface, owner, { fallback }));
    this.controller = new MobileInterfacePlugins(this.ctx, () => registry.catalog, { autoStart: false });
    this.runtime = new PhonePluginHost(registry, entry => async enabled => {
      if (entry.group !== REMOTE_HOME_SLOT) throw Error('incompatible');
      if (enabled) {
        await this.controller.select(entry.id);
        const state = this.controller.getSnapshot();
        if (state.status !== 'active') throw Error(state.error ?? 'load');
      } else if (this.controller.getSnapshot().selected === entry.id) await this.controller.select(null);
    });
    this.off = this.controller.subscribe(() => {
      const state = this.controller.getSnapshot();
      if (state.status === 'failed' && state.selected) void this.runtime.fail(state.selected, state.error ?? 'render').catch(() => {});
    });
    this.ready = this.runtime.ready.catch(() => this.controller.fail('storage'));
  }
  render = (surface, owner, fallback) => this.slots.renderSlot('root', { surface, owner, fallback });
  async dispose() {
    this.off(); await this.runtime.dispose(); await this.ctx.fiber.dispose();
  }
}

export function RemoteInterfaceSurface({ host, surface, owner, fallback }) {
  const state = React.useSyncExternalStore(host.controller.subscribe, host.controller.getSnapshot);
  return state.status === 'active' ? host.render(surface, owner, fallback) : fallback;
}
