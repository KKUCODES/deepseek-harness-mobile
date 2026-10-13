const snapshots = new WeakMap();

/** 仅为手机导航投影两版目录；原 Session store 和插件读取的新版投影保持原样。 */
export function remoteSessionCatalogs(list) {
  if (!list || list.subagentsByParent || !list.projectionsBySession) return list;
  if (snapshots.has(list)) return snapshots.get(list);
  const catalogs = Object.fromEntries(Object.entries(list.projectionsBySession).map(([id, snapshot]) => [id, {
    state: snapshot.state === 'idle'
      ? snapshot.values.subagentCatalog === undefined ? 'loading' : 'ready'
      : snapshot.state,
    error: snapshot.error,
    entries: (snapshot.values.subagentCatalog ?? []).map(entry => ({
      ...entry,
      // 新版允许 unknown 地址先读历史，由原 Controller 的子会话身份投影确定能否续聊。
      kind: 'child',
      activity: list.byId[entry.id]?.running === true ? 'running' : 'inactive',
      hasChildren: (list.projectionsBySession[entry.id]?.values.subagentCatalog?.length ?? 0) > 0,
    })),
  }]));
  const result = { ...list, subagentsByParent: catalogs };
  snapshots.set(list, result);
  return result;
}
