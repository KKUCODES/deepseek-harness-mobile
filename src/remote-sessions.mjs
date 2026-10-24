import { ClientSessions } from '../../deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts';
import { RemoteHistoryWindow } from './remote-history-window.mjs';

/** 保留原目录/会话实现，仅协调插件布尔开关与手机多视图的独立持有。 */
export class RemoteSessions extends ClientSessions {
  catalogMenus = new Set();
  catalogViews = new Map();
  activeCatalogs = new Set();
  projectionReferences = new Map();
  catalogsClosed = false;
  historyBindings = new WeakMap();
  constructor(ctx, remote) {
    super(ctx, remote);
    this.historyRemote = remote;
    ctx.effect(() => () => {
      this.catalogsClosed = true;
      for (const reference of this.projectionReferences.values()) reference.release();
      this.projectionReferences.clear();
      this.catalogMenus.clear(); this.catalogViews.clear(); this.activeCatalogs.clear();
    });
  }
  historyBinding(binding) {
    if (!binding) return binding;
    let history = this.historyBindings.get(binding);
    if (!history) {
      history = new RemoteHistoryWindow(binding, (request, signal) => this.historyRemote.session.page(request, signal));
      this.historyBindings.set(binding, history);
    }
    return history.binding;
  }
  historyReference(reference) {
    const binding = this.historyBinding(reference.binding);
    const ready = reference.ready.then(value => this.historyBinding(value));
    void ready.catch(() => {});
    return { sessionId: reference.sessionId, get binding() { void reference.binding; return binding; },
      ready, release: () => reference.release(),
      [Symbol.dispose]: () => reference.release() };
  }
  retain(target, options) { return this.historyReference(super.retain(target, options)); }
  retainAgentScope(id) { return this.historyReference(super.retainAgentScope(id)); }
  binding(id) { return this.historyBinding(super.binding(id)); }
  sessionOf(ctx) {
    const session = super.sessionOf(ctx);
    return session ? this.binding(session.sessionId)?.session : session;
  }
  setSubagentCatalogOpen(id, open) {
    if (this.catalogsClosed) return;
    if (open) this.catalogMenus.add(id);
    else this.catalogMenus.delete(id);
    // 原布尔接口重复true仍可刷新，但不能累加成永远无法释放的持有数。
    this.syncCatalog(id, open);
  }
  retainSubagentCatalog(id) {
    if (this.catalogsClosed) return () => {};
    this.catalogViews.set(id, (this.catalogViews.get(id) ?? 0) + 1);
    this.syncCatalog(id);
    let released = false;
    return () => {
      if (released || this.catalogsClosed) return;
      released = true;
      const count = this.catalogViews.get(id) - 1;
      if (count) this.catalogViews.set(id, count);
      else this.catalogViews.delete(id);
      this.syncCatalog(id);
    };
  }
  refreshSubagents(id) {
    return typeof ClientSessions.prototype.refreshSubagents === 'function'
      ? super.refreshSubagents(id) : super.refreshProjections(id);
  }
  syncCatalog(id, refresh = false) {
    const open = this.catalogMenus.has(id) || this.catalogViews.has(id);
    if (open === this.activeCatalogs.has(id) && !refresh) return;
    if (open) this.activeCatalogs.add(id);
    else this.activeCatalogs.delete(id);
    if (typeof ClientSessions.prototype.setSubagentCatalogOpen === 'function') {
      super.setSubagentCatalogOpen(id, open);
      return;
    }
    // 新版子会话目录属于 Session 投影，打开父会话即可订阅；各手机视图共用一个原生引用。
    if (open && !this.projectionReferences.has(id)) {
      const reference = this.retain(id, { source: 'controllerOperation' });
      this.projectionReferences.set(id, reference);
      // 选择流程仍等待自己的 reference.ready 并呈现失败；目录持有不产生第二个错误通道。
      void reference.ready.catch(() => {});
    } else if (!open) {
      this.projectionReferences.get(id)?.release();
      this.projectionReferences.delete(id);
    }
  }
}
