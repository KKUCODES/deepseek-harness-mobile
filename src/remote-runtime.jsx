import React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as Cordis from '@deepseek-ai/cordis';
import * as Store from '@deepseek-ai/dsh-client-store';
import * as Slots from '@deepseek-ai/dsh-client-ui-slots';
import * as Primitives from '@deepseek-ai/dsh-client-ui-primitives';
import * as Dockkit from '@deepseek-ai/dsh-client-ui-dockkit';
import { bootClient } from '../../deepseek-harness/packages/client/web/src/boot-client.ts';
import { RemoteTransport } from './remote-transport.mjs';

const modulesId = '@deepseek-ai/dsh-client-modules';
const seed = { react: React, 'react/jsx-runtime': JSXRuntime, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient,
  '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-store': Store,
  '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-ui-primitives': Primitives,
  '@deepseek-ai/dsh-client-ui-dockkit': Dockkit };

/** 每次连接创建独立客户端树；断线立即释放，不能把上一台电脑的模块或投影带入下一代。 */
export async function startRemoteRuntime(client, container, { onState = () => {}, onError = () => {}, compose } = {}) {
  const ctx = new Cordis.Context();
  const transport = new RemoteTransport(client);
  const target = { mode: 'queue', pendingQueue: [], load(registration) { this.pendingQueue.push(registration); } };
  let disposed = false, unmount, graphFollow, modules, ready = false, latestGraph, syncing = Promise.resolve();
  let releasePromise;
  const stop = () => {
    if (disposed) return releasePromise;
    disposed = true;
    off(); graphFollow?.cancel(); transport.dispose(); unmount?.();
    if (window.__DSH_TRANSPORT__ === transport.hooks) delete window.__DSH_TRANSPORT__;
    if (window.__DSH_FILE_UPLOAD__ === transport.uploadHooks) delete window.__DSH_FILE_UPLOAD__;
    if (window.__ModuleLoader__ === target) delete window.__ModuleLoader__;
    releasePromise = ctx.fiber.dispose();
    return releasePromise;
  };
  const off = client.subscribe(frame => {
    if (frame.type === 'closed') { void stop(); onState('disconnected'); }
  });
  const check = () => { if (disposed) throw new Error('remote_generation_changed'); };
  const sync = graph => {
    latestGraph = graph;
    if (!ready) return;
    syncing = syncing.then(async () => {
      check(); await modules.entries.sync(graph); check();
      const failures = modules.entries.state.getSnapshot().failures;
      if (failures.length) throw new Error('remote_plugin_activation_failed');
    }).catch(error => { if (!disposed) { onError(error); void stop(); } });
  };
  try {
    onState('negotiating');
    const capabilities = await transport.negotiate(); check();
    const graph = await client.request({ method: 'remote.graph' }).promise; check();
    if (!Array.isArray(graph?.entries) || !Array.isArray(graph?.batches)) throw new Error('invalid_remote_graph');
    const bootstrap = graph.batches.find(batch => batch.phase === 'bootstrap' && batch.entries.includes(modulesId));
    if (!bootstrap) throw new Error('missing_remote_bootstrap');
    // 由电脑的真实清单加载 bootstrap；APK 仅携带原平台单例，不伪造远程插件图。
    window.__ModuleLoader__ = target;
    window.__DSH_TRANSPORT__ = transport.hooks;
    window.__DSH_FILE_UPLOAD__ = transport.uploadHooks;
    onState('loading');
    await transport.loadBundle(bootstrap.url); check();
    const index = target.pendingQueue.findIndex(item => item.id === modulesId || item.id === `${modulesId}/client`);
    if (index < 0) throw new Error('missing_remote_modules');
    const [registration] = target.pendingQueue.splice(index, 1);
    const exports = registration.factory(id => { throw new Error(`unexpected_bootstrap_dependency:${id}`); });
    modules = exports.createClientModuleSystem(target, { id: modulesId, exports }, {
      boot: graph, staticModules: seed, loadBundle: url => transport.loadBundle(url),
    });
    graphFollow = client.request({ method: 'remote.graphFollow' }, sync,
      () => { if (!disposed) { onError(new Error('remote_graph_ended')); void stop(); } });
    void graphFollow.promise.catch(error => { if (!disposed) { onError(error); void stop(); } });
    await compose?.({ ctx, modules, transport, capabilities }); check();
    await bootClient({ ctx, modules, manifest: modules.manifest }); check();
    ready = true;
    if (latestGraph) { sync(latestGraph); await syncing; check(); }
    unmount = ctx.uiRenderer.mount(container);
    onState('ready');
    return { ctx, modules, transport, capabilities, dispose: stop };
  } catch (error) { await stop(); throw error; }
}
