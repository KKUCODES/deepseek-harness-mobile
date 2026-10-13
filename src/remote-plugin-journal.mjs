const endpoints = new Set(['pluginManager/installBundle', 'pluginManager/removeBundle',
  'pluginManager/setBundleEnabled', 'pluginManager/setPluginEnabled']);
const retentionMs = 60 * 60 * 1000;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;

/** 只保留未确认的展示摘要；请求参数、回执和凭据不得进入持久记录。 */
export function pluginOperationSummaries(items, now = Date.now()) {
  return items.filter(item => text(item?.id) && text(item.generation) && endpoints.has(item.endpoint)
    && ['pending', 'unknown'].includes(item.state) && Number.isFinite(item.startedAt)
    && item.startedAt <= now && now - item.startedAt < retentionMs)
    .sort((one, other) => one.startedAt - other.startedAt).slice(-64).map(item => {
      let target = text(item.target) ? item.target : item.endpoint;
      try {
        const url = new URL(target);
        // 下载地址的登录信息和查询参数只用于原请求，重开提示不需要这些内容。
        if (['http:', 'https:'].includes(url.protocol)) {
          url.username = ''; url.password = ''; url.search = ''; url.hash = ''; target = url.href;
        }
      } catch {}
      return { id: item.id, generation: item.generation, endpoint: item.endpoint, target,
        startedAt: item.startedAt, state: item.state,
        ...(text(item.requestId) ? { requestId: item.requestId } : {}),
        ...(Number.isFinite(item.finishedAt) ? { finishedAt: item.finishedAt } : {}) };
    });
}
