import { ClientSessions } from '../../deepseek-harness/packages/api/session-controller/src/client/sessions/service.ts';

/** 保留原目录/会话实现，仅协调插件布尔开关与手机多视图的独立持有。 */
export class RemoteSessions extends ClientSessions {
  catalogMenus = new Set();
  catalogViews = new Map();
  activeCatalogs = new Set();
  catalogsClosed = false;
  constructor(ctx, remote) {
    super(ctx, remote);
    ctx.effect(() => () => {
      this.catalogsClosed = true;
      this.catalogMenus.clear(); this.catalogViews.clear(); this.activeCatalogs.clear();
    });
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
  syncCatalog(id, refresh = false) {
    const open = this.catalogMenus.has(id) || this.catalogViews.has(id);
    if (open === this.activeCatalogs.has(id) && !refresh) return;
    if (open) this.activeCatalogs.add(id);
    else this.activeCatalogs.delete(id);
    super.setSubagentCatalogOpen(id, open);
  }
}
