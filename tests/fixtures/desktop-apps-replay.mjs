/** 仅页面回放：记录固定操作，不连接真实电脑，不模拟设备认证。 */
export function desktopAppsReplay(model) {
  const calls = [], cancelled = [], pending = [];
  let hold = false, failOpen = false;
  model.transport.generation = 1; model.transport.lifetime = new AbortController();
  const original = model.client.request.bind(model.client);
  model.client.request = operation => {
    if (!['remote.desktopApps', 'remote.prepareDesktopApp', 'remote.openDesktopApp', 'remote.desktopAppIcon'].includes(operation.method)) return original(operation);
    calls.push(operation);
    const value = operation.method === 'remote.desktopAppIcon' ? { appId: operation.appId, contentType: 'image/svg+xml',
      data: btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>') }
      : operation.method === 'remote.openDesktopApp' ? { opened: true }
      : { name: 'test-pc', available: true, workspacePath: 'C:/existing/workspace', apps: ['explorer', 'vscode'],
        ...(operation.method === 'remote.prepareDesktopApp' ? { snapshot: crypto.randomUUID(), appId: operation.appId } : {}) };
    return { promise: failOpen && operation.method === 'remote.openDesktopApp' ? Promise.reject(new Error('outcome_unknown'))
      : hold ? new Promise(resolve => pending.push(() => resolve(value))) : Promise.resolve(value),
      cancel() { cancelled.push(operation.method); } };
  };
  const connection = (state, supported = true) => {
    model.transport.lifetime.abort(); model.transport.lifetime = new AbortController(); model.transport.generation++;
    model.transport.capabilities.desktopApps = supported;
    model.publish({ connectionState: state });
  };
  connection('connected');
  return { connection, icons() { model.transport.capabilities.desktopAppIcons = true; model.publish({}); }, header(enabled) { model.publish({ plugins: { ...model.getSnapshot().plugins,
    entries: enabled ? [{ id: '@deepseek-ai/dsh-client-ui-open-in-app', state: 'mobile' }] : [] } }); },
    hold(value) { hold = value; }, release() { pending.splice(0).forEach(resolve => resolve()); },
    failOpen() { failOpen = true; }, snapshot: () => ({ calls, cancelled, pending: pending.length }) };
}
