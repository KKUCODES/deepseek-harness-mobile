const member = (value, allowed) => allowed.includes(value) ? value : 'unknown';
const version = value => typeof value === 'string' && /^\d+(?:\.\d+){1,7}(?:-[a-zA-Z0-9.]+)?$/.test(value) && value.length <= 48 ? value : null;
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;

/** 只投影明确字段；不要序列化整个绑定、模型快照、异常或插件条目。 */
export function supportDiagnostics({ info, mode, stage, binding, capabilities, plugins } = {}) {
  const report = {
    format: 'dshm-diagnostics', version: 1, capturedAt: new Date().toISOString(),
    mode: member(mode, ['ordinary', 'remote']),
    app: { version: version(info?.appVersion), versionCode: integer(info?.appVersionCode),
      androidApi: integer(info?.androidApi), webView: version(info?.webViewVersion) },
  };
  if (mode === 'remote') {
    const counts = { active: 0, mobile: 0, waiting: 0, failed: 0, unknown: 0 };
    for (const entry of (Array.isArray(plugins?.entries) ? plugins.entries : []).slice(0, 10000)) counts[member(entry?.state, ['active', 'mobile', 'waiting', 'failed'])]++;
    report.remote = {
      stage: member(stage, ['idle', 'connecting', 'negotiating', 'loading', 'ready', 'connected', 'disconnected']),
      paired: typeof binding?.paired === 'boolean' ? binding.paired : null,
      transport: integer(capabilities?.transport), dshVersion: version(capabilities?.dshVersion),
      management: typeof capabilities?.management === 'boolean' ? capabilities.management : null,
      plugins: { state: member(plugins?.state, ['loading', 'ready', 'error']), counts },
    };
  }
  return report;
}
