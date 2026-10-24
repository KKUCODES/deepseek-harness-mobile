const handlers = new Set();
/** 原生重启前等待每个存活页面确认本地写入；不把电脑端运行状态当作手机草稿。 */
export function registerUpdatePreparation(handler) { handlers.add(handler); return () => handlers.delete(handler); }
export async function prepareUpdate() { for (const handler of handlers) await handler(); }
if (typeof window !== 'undefined') window.__dshmPrepareUpdate = prepareUpdate;
