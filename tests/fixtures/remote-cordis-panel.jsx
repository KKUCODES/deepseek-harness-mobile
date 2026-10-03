import { CordisPanel } from '../../../deepseek-harness/packages/extensions/ui-cordis/src/client/CordisPanel.tsx';
import { NS, zh, en } from '../../../deepseek-harness/packages/extensions/ui-cordis/src/client/locales.ts';

// 原组件的布局回归；清单为隔离夹具，不作为真实 Host 生命周期的证据。
export async function enableCordisPanel(model) {
  const inventory = { read: true, rows: [{ pluginId: 'layout-fixture', agentId: 'one',
    packages: [{ packageId: 'layout-v1', name: '动态插件布局检查', purpose: '检查手机入口与弹窗位置' }] }] };
  const empty = new Map();
  let active = empty;
  const listeners = new Set();
  const activeRuns = { subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, getSnapshot: () => active };
  const request = () => {
    active = new Map([['layout-fixture', { phase: 'awaiting-approval', requestId: 'approval-layout', agentId: 'one',
      pluginId: 'layout-fixture', packageId: 'layout-v1', name: '动态插件布局检查', purpose: '布局验证', mode: 'run' }]]);
    for (const listener of listeners) listener();
  };
  const settle = async () => { active = empty; for (const listener of listeners) listener(); };
  const state = value => ({ subscribe: () => () => {}, getSnapshot: () => value });
  const noop = async () => {};
  const plugin = model.ctx.plugin({ name: '@fixture/cordis-panel', inject: ['slots', 'locale'], apply(ctx) {
    ctx.provide('dynamicCordisRunner', { activeRuns });
    ctx.locale.register(NS, { zh, en });
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'cordis-panel', locale: NS,
      inject: () => ({ hooks: { inventory: state(inventory), activeRuns, runErrors: state(empty), loaded: state(empty), renderFailures: state(empty) },
        onApprove: settle, onDecline: settle, onRun: noop, onStop: noop, onRemove: noop, onRefresh: noop }),
    }, CordisPanel));
  } });
  await plugin.await();
  return Object.assign(() => plugin.dispose(), { request });
}
