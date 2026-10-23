import { RemotePlugins } from '../../src/remote-plugins.jsx';
import { RemoteTransport } from '../../src/remote-transport.mjs';

// 隔离加载诊断：图和bundle来自原官方Host，仅跳过配对/RPC以缩小导入问题。
window.runRc21Import = async graph => {
  const steps = [];
  const client = { subscribe: () => () => {}, connected: true,
    request: operation => {
      if (operation.method !== 'remote.graph') throw Error('diagnostic_operation_denied');
      return { promise: Promise.resolve(graph), cancel() {} };
    } };
  const transport = new RemoteTransport(client);
  transport.capabilities = { dshVersion: graph.release?.version, transport: 2 };
  const model = { client, transport, publish() {} };
  const plugins = new RemotePlugins(model);
  const bootstrap = plugins.bootstrap.bind(plugins);
  plugins.bootstrap = async graph => { steps.push('bootstrap:start'); await bootstrap(graph); steps.push('bootstrap:bound'); };
  window.rc21Steps = steps;
  const exports = await plugins.prepare();
  steps.push('remotes:imported');
  await plugins.dispose(); transport.dispose();
  return { steps, apply: typeof exports.apply };
};
