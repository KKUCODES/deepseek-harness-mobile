const phases = new Set(['pairing', 'authorization', 'ticket', 'websocket', 'authentication', 'connection', 'negotiating', 'reading', 'notifications', 'unknown']);
const codes = new Set(['unknown_error', 'connection_failed', 'network_unreachable', 'network_timeout', 'tls_failure', 'remote_closed',
  'host_offline', 'host_upgrade_required', 'device_pending', 'device_revoked', 'permissions_changed', 'credential_expired', 'invalid_authentication',
  'authentication_required', 'rate_limited', 'capacity_exceeded', 'invalid_protocol', 'unsupported_dsh_version', 'unsupported_dsh_capabilities',
  'unsupported_remote_version', 'unsupported_remote_capabilities', 'remote_bridge_timeout', 'request_timeout_outcome_unknown',
  'response_too_large', 'response_buffer_limit', 'response_chunk_timeout', 'invalid_response_chunk', 'incomplete_response_chunk',
  'connection_closed_outcome_unknown', 'host_disconnected_outcome_unknown', 'remote_generation_changed', 'remote_not_connected']);
const reasons = new Set(['device_revoked', 'permissions_changed', 'credential_expired', 'invalid_authentication', 'authentication_required', 'rate_limited', 'capacity_exceeded', 'invalid_frame', 'host_replaced']);
const ownFile = '(?:remote-main|mobile-main|main|test)\\.js|chunks/chunk-[A-Z0-9]{8}\\.js';
const jsFrame = new RegExp(`^at (?:${ownFile}):\\d{1,6}:\\d{1,6}$`);
const nativeType = /^(?:java\.|javax\.|android\.|com\.android\.|okhttp3\.|okio\.|com\.nimbusds\.|dev\.dshmobile\.validation\.)[A-Za-z0-9_.$]{1,140}$/;
const nativeFrame = /^at (?:java\.|javax\.|android\.|com\.android\.|okhttp3\.|okio\.|com\.nimbusds\.|dev\.dshmobile\.validation\.)[A-Za-z0-9_.$<>]{1,140}\((?:[A-Za-z0-9_$.-]{1,80}\.(?:kt|java)(?::\d{1,6})?|Unknown Source|Native Method)\)$/;
export const diagnosticCode = value => typeof value === 'string' && (codes.has(value) || /^http_[1-5]\d\d$/.test(value)) ? value : 'unknown_error';
const validTime = value => Number.isSafeInteger(value) && value > 0 && value < 9_000_000_000_000;

/** Do not copy exception messages or arbitrary stack text: either may contain request credentials or chat data. */
export function safeJavascriptFrames(stack) {
  if (typeof stack !== 'string') return [];
  const result = [];
  const pattern = new RegExp(`^\\s*at (?:[A-Za-z0-9_.$<>]{1,90} \\()?https://remote\\.dshm\\.invalid/assets/web/(${ownFile}):(\\d{1,6}):(\\d{1,6})\\)?$`);
  for (const line of stack.slice(0, 16000).split('\n').slice(0, 80)) {
    const match = line.match(pattern);
    if (match) result.push(`at ${match[1]}:${match[2]}:${match[3]}`);
    if (result.length === 18) break;
  }
  return result;
}

export function diagnosticRecord(value) {
  if (!value || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.id) || !validTime(value.at)) return null;
  const record = { id: value.id, at: value.at, source: value.source === 'notifications' ? 'notifications' : 'remote',
    phase: phases.has(value.phase) ? value.phase : 'unknown', code: diagnosticCode(value.code), exceptions: [] };
  if (Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599) record.httpStatus = value.httpStatus;
  if (Number.isInteger(value.closeCode) && value.closeCode >= 1000 && value.closeCode <= 4999) record.closeCode = value.closeCode;
  if (reasons.has(value.closeReason)) record.closeReason = value.closeReason;
  if (validTime(value.resolvedAt)) record.resolvedAt = value.resolvedAt;
  let remaining = 18;
  for (const error of (Array.isArray(value.exceptions) ? value.exceptions : []).slice(0, 3)) {
    if (!(nativeType.test(error?.type) || error?.type === 'JavaScriptError')) continue;
    const frames = (Array.isArray(error.frames) ? error.frames : []).filter(frame => typeof frame === 'string'
      && frame.length <= 220 && (nativeFrame.test(frame) || jsFrame.test(frame))).slice(0, remaining);
    remaining -= frames.length;
    record.exceptions.push({ type: error.type, frames });
  }
  return record;
}

export const diagnosticPhases = Object.freeze({ pairing: '领取配对', authorization: '检查设备授权', ticket: '获取连接票据', websocket: '建立实时通道',
  authentication: '验证实时连接', connection: '保持实时连接', negotiating: '协商电脑能力', reading: '读取会话', notifications: '同步提醒', unknown: '连接阶段待确认' });

export function diagnosticView(record = {}) {
  record ??= {};
  const code = diagnosticCode(record.code), reading = record.phase === 'reading';
  let title = reading ? '会话读取失败' : '连接未完成', description = '暂时无法确认原因。', suggestion = '请稍后重试；如仍失败，可复制诊断信息反馈。';
  const http = record.httpStatus ?? (/^http_\d{3}$/.test(code) ? Number(code.slice(5)) : null);
  if (http) {
    title = record.phase === 'websocket' ? '实时连接握手失败' : reading ? '会话读取失败' : '连接请求失败';
    description = `服务器返回 HTTP ${http}。`;
    suggestion = http === 401 ? '请检查设备授权，必要时重新配对。' : http === 429 ? '请求过于频繁，请稍后重试。' : '请检查代理设置和中转地址，然后重试。';
  } else if (code === 'network_timeout' || code.includes('timeout')) {
    title = reading ? '会话读取超时' : '连接超时'; description = '未能在规定时间内收到响应。'; suggestion = reading ? '返回重试读取，无需重新配对。' : '请检查网络和代理设置，然后重试。';
  } else if (code === 'network_unreachable') {
    title = '无法连接中转'; description = '网络连接未能建立。'; suggestion = '请检查网络和代理设置，然后重试。';
  } else if (code === 'tls_failure') {
    title = '安全连接校验失败'; description = 'TLS 握手或证书校验未通过。'; suggestion = '请检查中转证书、设备时间和代理设置。';
  } else if (code === 'host_offline') {
    title = '电脑暂时离线'; description = '中转尚未连接到这台电脑。'; suggestion = '请确认电脑上的 DSH 和远程连接保持运行。';
  } else if (['device_revoked', 'credential_expired', 'device_pending', 'permissions_changed', 'invalid_authentication', 'authentication_required'].includes(code)) {
    title = '设备授权需要检查'; description = ({ device_revoked: '电脑已撤销这台手机。', credential_expired: '设备凭据已过期。', device_pending: '设备仍在等待电脑批准。', permissions_changed: '电脑已调整设备权限。' })[code] ?? '实时连接认证未完成。'; suggestion = '请在电脑端检查设备状态，然后重新连接。';
  } else if (code.startsWith('unsupported_') || code === 'host_upgrade_required') {
    title = '连接能力不兼容'; description = '电脑提供的版本或接口能力不满足当前连接要求。'; suggestion = '请检查 App、电脑插件和 DSH 的配套版本。';
  } else if (['remote_closed', 'connection_closed_outcome_unknown', 'host_disconnected_outcome_unknown', 'remote_not_connected', 'remote_generation_changed'].includes(code)) {
    title = '实时连接已中断'; description = '连接已经关闭，具体原因尚未确认。'; suggestion = '请重新连接；已加载的内容仍可查看。';
  } else if (code.startsWith('response_') || code.includes('response_chunk')) {
    title = '会话数据接收失败'; description = '收到的数据未通过传输校验。'; suggestion = '请重试读取，并检查两端及中转的配套版本。';
  }
  return { title, description, descriptionKey: http ? '服务器返回 HTTP {status}。' : description, values: { status: http },
    suggestion, phase: diagnosticPhases[record.phase] ?? diagnosticPhases.unknown };
}

/** Native storage is authoritative. Older APKs keep a bounded, in-memory fallback without blocking chat. */
export class RemoteDiagnostics {
  records = [];
  revision = 0;
  listeners = new Set();
  constructor(client) { this.client = client; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.records;
  publish(records) { this.revision++; this.records = records.map(diagnosticRecord).filter(Boolean).slice(0, 10); for (const listener of this.listeners) listener(); }
  async refresh() {
    const revision = ++this.revision;
    try { const data = await this.client.call('diagnostics.read'); if (revision === this.revision && Array.isArray(data.records)) this.publish(data.records); }
    catch { /* Old native bridges do not have diagnostics; preserve the current fallback. */ }
  }
  async capture(error, phase = 'unknown', native = true) {
    const code = diagnosticCode(error?.message);
    if (native) {
      await this.refresh();
      const latest = this.records.find(record => record.source === 'remote');
      // 断线会同时拒绝在途请求；这些派生错误不能覆盖刚收到的原生握手或网络原因。
      const derivative = ['connection_closed_outcome_unknown', 'remote_not_connected', 'connection_failed'].includes(code);
      if (latest && !latest.resolvedAt && Date.now() - latest.at < 3000
        && (latest.code === code || derivative && latest.code !== 'unknown_error')) return latest;
    }
    const stack = safeJavascriptFrames(error?.stack);
    try { const data = await this.client.call('diagnostics.record', { code, phase: phases.has(phase) ? phase : 'unknown', stack }); if (data.record) { await this.refresh(); return diagnosticRecord(data.record); } }
    catch { /* Keep the same UI available on older APKs. */ }
    const record = diagnosticRecord({ id: crypto.randomUUID(), at: Date.now(), phase, code, exceptions: stack.length ? [{ type: 'JavaScriptError', frames: stack }] : [] });
    this.publish([record, ...this.records]); return record;
  }
  async recovered() {
    try { await this.client.call('diagnostics.recovered'); } catch { }
    this.publish(this.records.map(record => record.source === 'remote' && !record.resolvedAt ? { ...record, resolvedAt: Date.now() } : record));
  }
}
