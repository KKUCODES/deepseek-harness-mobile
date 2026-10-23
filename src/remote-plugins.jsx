import Loader from '@deepseek-ai/cordis-plugin-loader';
import { clientStaticModules as seed } from './client-static-modules.jsx';
import { activationManifest, pluginEntries } from './remote-plugin-policy.mjs';
import { isRemoteHostDisconnect } from './remote-transport.mjs';
import { remoteModuleRegistration } from './remote-module-registration.mjs';
import { assertRemoteModuleSystem } from './remote-module-capabilities.mjs';

const modulesId = '@deepseek-ai/dsh-client-modules';

/** 普通模块图增量同步并保留未变化的实例；核心接口更新需重新建立连接。 */
export class RemotePlugins {
  controller = new AbortController();
  queue = Promise.resolve();
  revision = null;
  followRevision = 0;
  constructor(model) { this.model = model; }
  publish(value) { if (!this.controller.signal.aborted) this.model.publish({ plugins: value }); }
  async prepare() {
    this.publish({ state: 'loading', entries: [] });
    this.initial = this.model.client.request({ method: 'remote.graph' });
    const graph = await this.initial.promise;
    this.controller.signal.throwIfAborted();
    await this.bootstrap(graph);
    this.coreRevision = coreRevision(graph);
    this.revision = graph.rev;
    this.prepared = true;
    return this.runtime.modules.import('@deepseek-ai/dsh-api-remotes/client', '', {});
  }
  async start() {
    const { client } = this.model;
    this.publish({ state: 'loading', entries: [] });
    let first;
    if (this.prepared) {
      first = this.queue = this.activate();
    } else {
      this.initial = client.request({ method: 'remote.graph' });
      const graph = await this.initial.promise;
      this.controller.signal.throwIfAborted();
      first = this.sync(graph);
    }
    // 加载期间到达的新图进入同一条队列，不与正在初始化的插件树交叉。
    this.offGeneration = this.model.connection.generation.subscribe(() => this.followGraphs());
    this.followGraphs();
    await first;
  }
  async installJobs() {
    if (!this.model.transport.capabilities?.endpoints?.streams?.includes('job/list')) return;
    // 用本台电脑的原客户端服务管理引用计数和重连，不在手机复制一套任务流状态机。
    const plugin = await this.runtime.modules.import('@deepseek-ai/dsh-api-job-controller/client', '', {});
    this.controller.signal.throwIfAborted();
    const fiber = this.model.ctx.plugin(plugin);
    await fiber.await();
    this.controller.signal.throwIfAborted();
    if (!this.model.ctx.get('jobs')) throw Error('remote_jobs_service_missing');
  }
  stopFollowing() {
    this.followRevision++;
    this.follow?.cancel(); this.follow = null;
  }
  followGraphs() {
    this.stopFollowing();
    if (this.controller.signal.aborted || !this.model.connection.generation.getSnapshot()) return;
    const revision = this.followRevision;
    const current = () => !this.controller.signal.aborted && revision === this.followRevision;
    const failed = error => {
      if (!current()) return;
      this.stopFollowing();
      // 断线时保留现有插件，下一次真实 Host 世代重新订阅完整模块图。
      // 取消的旧订阅即使迟到回调，也不能卸载新一代插件树。
      if (!isRemoteHostDisconnect(error)) void this.fail(error);
    };
    try {
      this.follow = this.model.client.request({ method: 'remote.graphFollow' },
        graph => { if (current()) void this.sync(graph); },
        () => failed(new Error('remote_graph_ended')));
      void this.follow.promise.catch(failed);
    } catch (error) { failed(error); }
  }
  sync(graph) {
    const work = this.queue.then(async () => {
      this.controller.signal.throwIfAborted();
      if (graph.rev === this.revision && this.runtime) return;
      if (this.coreRevision && coreRevision(graph) !== this.coreRevision) {
        if (this.model.requestRebuild) { this.model.requestRebuild(); return; }
        this.model.fail(new Error('电脑接口已更新，请重新连接。'));
        void this.model.client.disconnect().catch(error => this.model.fail(error));
        throw new Error('remote_core_changed');
      }
      if (this.runtime?.modules.entries.syncSelected) {
        const { modules, refresh } = this.runtime;
        // 只传递本次图中的 apply 名单；模块解析仍使用完整图，绝不调用旧版全量 sync。
        const selected = activationManifest({ plugins: graph.entries }, this.model.transport.capabilities).plugins.map(row => row.id);
        await modules.entries.syncSelected(graph, selected);
        this.controller.signal.throwIfAborted();
        this.runtime.graph = graph;
        refresh();
      } else {
        // 未安装增量兼容补丁的电脑保持原生命周期，不冒险启动桌面布局。
        await this.release();
        this.controller.signal.throwIfAborted();
        await this.bootstrap(graph);
        await this.activate();
      }
      this.revision = graph.rev;
    });
    this.queue = work.catch(async error => {
      if (!this.controller.signal.aborted) { await this.release(); this.publish({ state: 'error', entries: [], error: error.message }); }
    });
    return this.queue;
  }
  async bootstrap(graph) {
    const { model } = this, { transport } = model;
    const controller = new AbortController(), generation = crypto.randomUUID();
    const signal = AbortSignal.any([controller.signal, this.controller.signal]);
    const target = { mode: 'queue', pendingQueue: [], load(registration) { this.pendingQueue.push(registration); } };
    // 已移除的 script 仍可能迟到执行；由 script 元素上的代号路由，不能污染下一代模块表。
    const registrationBridge = remoteModuleRegistration({ target, signal, generation });
    const { facade } = registrationBridge;
    const runtime = this.runtime = { controller, facade, graph, modules: null, fiber: null };
    window.__ModuleLoader__ = facade;
    window.__DSH_TRANSPORT__ = transport.hooks;
    window.__DSH_FILE_UPLOAD__ = transport.uploadHooks;
    const loadBundle = url => transport.loadBundle(url, { signal, generation });
    this.publish({ state: 'loading', entries: [] });
    const bootstrap = graph.batches?.find(batch => batch.phase === 'bootstrap' && batch.entries.includes(modulesId));
    if (!bootstrap) throw new Error('missing_remote_bootstrap');
    await loadBundle(bootstrap.url); signal.throwIfAborted();
    const index = target.pendingQueue.findIndex(item => item.id === modulesId || item.id === `${modulesId}/client`);
    if (index < 0) throw new Error('missing_remote_modules');
    const [registration] = target.pendingQueue.splice(index, 1);
    const exports = registration.factory(id => { throw new Error(`unexpected_bootstrap_dependency:${id}`); });
    if (typeof exports.createClientModuleSystem !== 'function') throw Error('unsupported_dsh_capabilities');
    runtime.modules = exports.createClientModuleSystem(target, { id: modulesId, exports }, { boot: graph, staticModules: seed, loadBundle });
    assertRemoteModuleSystem(runtime.modules);
    registrationBridge.bind(runtime.modules);
  }
  async activate() {
    const { model, runtime } = this, { modules } = runtime;
    const signal = AbortSignal.any([runtime.controller.signal, this.controller.signal]);
    let scope;
    runtime.fiber = model.ctx.plugin({ name: 'dshm-remote-plugins', apply(ctx) { scope = ctx; } });
    await runtime.fiber.await(); signal.throwIfAborted();
    await scope.plugin(Loader);
    let loader;
    const assembly = scope.plugin({ inject: ['loader'], apply(ctx) { loader = ctx.loader; } });
    await assembly.await(); signal.throwIfAborted();
    loader.internal = modules;
    let ready = false;
    const refresh = () => { if (!signal.aborted) this.publish({ state: ready ? 'ready' : 'loading', entries: pluginEntries({ ...modules.manifest, plugins: runtime.graph.entries }, loader, model.transport.capabilities) }); };
    runtime.refresh = refresh;
    scope.on('internal/status', refresh);
    // 模块依赖图完整保留；只有 apply 入口名单由手机组合层选择。
    await modules.entries.start(loader, activationManifest(modules.manifest, model.transport.capabilities));
    await loader.await(); signal.throwIfAborted(); ready = true; refresh();
  }
  async release() {
    const runtime = this.runtime;
    if (!runtime) return;
    this.runtime = null;
    runtime.controller.abort();
    await runtime.fiber?.dispose();
    const ids = new Set(runtime.modules?.loadCache.keys() ?? []);
    for (const style of document.querySelectorAll('style[data-plugin]')) if (ids.has(style.getAttribute('data-plugin'))) style.remove();
    if (window.__ModuleLoader__ === runtime.facade) delete window.__ModuleLoader__;
    if (window.__DSH_TRANSPORT__ === this.model.transport.hooks) delete window.__DSH_TRANSPORT__;
    if (window.__DSH_FILE_UPLOAD__ === this.model.transport.uploadHooks) delete window.__DSH_FILE_UPLOAD__;
  }
  async fail(error) {
    await this.dispose();
    if (!this.model.lifetime.signal.aborted) this.model.publish({ plugins: { state: 'error', entries: [], error: error.message } });
  }
  dispose() {
    if (this.closing) return this.closing;
    this.controller.abort(); this.offGeneration?.(); this.initial?.cancel(); this.stopFollowing();
    this.runtime?.controller.abort();
    // 首次 activate 也可能失败；清理不能依赖启动 Promise 成功。
    this.closing = this.queue.catch(() => {}).then(() => this.release());
    return this.closing;
  }
}

function coreRevision(graph) {
  const core = new Set([modulesId, '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-typert-registry', '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-api-job-controller']);
  return JSON.stringify(graph.entries.filter(row => core.has(row.id)).map(({ id, rev }) => [id, rev]).sort(([a], [b]) => a.localeCompare(b)));
}
