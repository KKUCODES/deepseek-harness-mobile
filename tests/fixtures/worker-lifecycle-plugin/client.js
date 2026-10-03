// dshm-worker-lifecycle-marker
window.__ModuleLoader__.load({ id: '@dsh-mobile/worker-lifecycle-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'modules'], apply(ctx) {
    const id = '@dsh-mobile/worker-lifecycle-verification';
    const row = ctx.modules.manifest.modules.find(item => item.id === id);
    if (!row) throw new Error('worker-fixture-module-missing');
    // 沿原模块表的包身份和版本构造已核验的 package-local chunk 路由。
    const workerUrl = new URL(`/plugins/${id}/client.worker.js?rev=${encodeURIComponent(row.rev)}`, location.origin).href;
    let worker = null, disposed = false;
    let state = { running: false, tick: 0, result: null, error: '' };
    const listeners = new Set();
    const update = patch => { if (disposed) return; state = { ...state, ...patch }; for (const notify of listeners) notify(); };
    const start = () => {
      if (worker || disposed) return;
      try {
        worker = new Worker(workerUrl, { name: 'dshm-plugin-worker-verification' });
        worker.onmessage = ({ data }) => update(data.type === 'tick' ? { tick: data.tick, running: true } : { result: data });
        worker.onerror = () => update({ error: 'Worker 启动失败' });
      } catch { update({ error: 'Worker 创建失败' }); }
    };
    // 当前 Cordis 使用 effect 返回的清理函数；不存在通用 dispose 事件。
    ctx.effect(() => () => {
      disposed = true;
      worker?.terminate(); worker = null; listeners.clear();
    }, 'worker lifecycle verification');
    ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
      name: 'conversation.chat.turnTail', id: 'dshm-worker-verification',
    }, function WorkerCard() {
      const snapshot = React.useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => state);
      return React.createElement('section', { 'data-testid': 'live-worker-card', 'data-tick': snapshot.tick,
        style: { padding: 12, border: '1px solid #aaa', borderRadius: 12, marginBlock: 8 } },
      React.createElement('p', null, 'DSHM 插件后台线程验收'),
      React.createElement('button', { disabled: snapshot.running, onClick: start }, '启动测试线程'),
      React.createElement('button', { disabled: !snapshot.running, onClick: () => worker?.postMessage({ type: 'read', url: new URL(row.url, location.origin).href }) }, '读取插件资源'),
      React.createElement('output', { 'data-testid': 'worker-resource-result' }, JSON.stringify(snapshot.result)),
      React.createElement('p', { role: 'status' }, snapshot.error || (snapshot.running ? `线程运行中 ${snapshot.tick}` : '尚未启动')));
    }));
  } };
} });
