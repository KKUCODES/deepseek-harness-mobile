import React from 'react';
import * as tools from '../../../deepseek-harness/packages/client/ui-tool/src/client/index.ts';
import * as cordis from '../../../deepseek-harness/packages/extensions/ui-cordis/src/client/index.ts';

/** 原卡片与手机消息链路回放；仅替换隔离清单和运行状态，不宣称真实Host执行。 */
export async function enableCordisCards(model, send) {
  const pluginId = 'card-plugin', packageId = 'card-package', pluginRunId = 'card-run';
  const listeners = new Set(), remoteListeners = new Map();
  let loaded = [], rows = [], active = new Map(), seq = (model.snapshot.session?.cursor ?? -1) + 1;
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const empty = new Map();
  const observable = getSnapshot => ({ subscribe, getSnapshot });
  const runner = { subscribe, getSnapshot: () => loaded, activeRuns: observable(() => active),
    lastRunError: observable(() => empty), renderFailures: observable(() => empty), reconcileApprovals() {} };
  const row = { pluginId, agentId: 'two', currentPackageId: packageId,
    packages: [{ packageId, name: '卡片回放插件', purpose: '隔离工具历史检查', hasClientHalf: true, hasHostHalf: true }] };
  const fixture = model.ctx.isolate('remote').plugin({ name: '@fixture/cordis-cards', inject: ['slots', 'locale'], apply(ctx) {
    ctx.provide('remote', { $host: model.ctx.remote.$host, dynamicCordisRunner: {
      inventory: async () => ({ ok: true, value: rows }),
    }, $on(event, listener) { remoteListeners.set(event, listener); } });
    ctx.provide('dynamicCordisRunner', runner);
    ctx.plugin(tools);
    // 直接调用原apply：远端命名空间由上面的显式隔离边界提供。
    cordis.apply(ctx);
    ctx.slots.inject('tool.view.cordis', () => ctx.slots.register({ name: 'tool.view.cordis', key: `${pluginId}.${packageId}` },
      ({ pluginId: id, packageId: pkg, pluginRunId: run }) => {
        const [count, setCount] = React.useState(0);
        return <button data-testid="cordis-business" data-owner={`${id}/${pkg}/${run}`} onClick={() => setCount(count + 1)}>业务点击 {count}</button>;
      }));
  } });
  await fixture.await();
  const state = phase => {
    loaded = phase === 'running' ? [{ pluginId, packageId, pluginRunId }] : [];
    active = phase === 'awaiting-approval' ? new Map([[pluginId, { phase, pluginId, packageId, agentId: 'two', requestId: 'card-request', mode: 'run' }]]) : new Map();
    rows = phase === 'removed' ? [] : [{ ...row,
      ...(phase === 'running' ? { activeRun: { packageId, pluginRunId } } : {}),
      latestRun: { pluginRunId, packageId, status: phase === 'failed' ? 'failed' : phase,
        ...(phase === 'failed' ? { error: { phase: 'client-apply', message: '明确的卡片失败回放' } } : {}) } }];
    for (const fn of listeners) fn();
    remoteListeners.get('cordis/dynamic-package')?.();
  };
  const emit = (type, data) => send({ type: 'event', event: { seq: seq++, time: Date.now(), type, data,
    ...(type === 'tool/result' ? { surfaceOp: 'append' } : {}) } });
  let turn = 70;
  const history = mode => {
    turn++;
    emit('turn/start', { turn }); emit('step/start', { turn, step: 1 });
    const call = (name, suffix, args, meta, text, isError = false) => {
      const callId = `cordis-${suffix}-${turn}`;
      emit('tool/call', { turn, step: 1, callId, name, arguments: JSON.stringify(args) });
      emit('tool/result', { turn, step: 1, meta, message: { id: `${callId}-result`, role: 'tool', source: { kind: 'tool', callId },
        content: [{ type: 'tool-result', isError, content: [{ type: 'text', text }] }] } });
    };
    if (mode === 'initial') call('cordis_define', 'define', { name: '卡片回放插件', purpose: '隔离工具历史检查',
      code: { client: 'return { apply() { /* CLIENT_SOURCE */ } };', host: 'return { apply() { /* HOST_SOURCE */ } };' } },
    { pluginId, packageId }, '定义记录');
    if (mode === 'initial' || mode === 'newer') call('cordis_run', 'run', { pluginId, packageId, mode: 'run' },
      { pluginId, packageId, pluginRunId }, '运行记录');
    if (mode === 'actions') {
      call('cordis_stop', 'stop', { pluginId }, undefined, '停止记录');
      call('cordis_undefine', 'remove', { pluginId }, undefined, '移除记录');
      call('cordis_run', 'error', { pluginId: 'failed-plugin', packageId: 'bad-package', mode: 'run' }, undefined, '明确的工具失败', true);
    }
    emit('step/end', { turn, step: 1 });
    emit('turn/end', { turn, reason: { kind: 'completed' } });
  };
  return { state, history, dispose: () => fixture.dispose() };
}
