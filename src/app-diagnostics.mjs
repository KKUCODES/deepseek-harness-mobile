const stackFile = /^(?:(?:app-diagnostics|startup|mobile-main|remote-main|main)\.js|chunks\/[\w-]+\.js|plugins\/[\w-]+\.js)$/;
const localFrame = /https:\/\/(?:appassets\.androidplatform\.net|remote\.dshm\.invalid)\/assets\/web\/([^\s():?#]+):(\d{1,8}):(\d{1,8})(?=\)?\s*$)/;
const browserFrame = /(?:^|[ (])(?:\/assets\/web\/)?((?:[\w-]+\/)?[\w-]+\.js):(\d{1,8}):(\d{1,8})(?=\)?\s*$)/;
const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError', 'DOMException', 'AbortError', 'NetworkError', 'QuotaExceededError', 'NotFoundError', 'SecurityError', 'InvalidStateError']);
const knownCodes = new Set(`unknown_error missing_credential model_error model_timeout model_rate_limited model_auth_failed model_unavailable history_write_failed history_read_failed request_failed request_aborted attachment_failed upload_failed send_unconfirmed send_rejected connection_offline host_offline host_upgrade_required invalid_protocol unsupported_dsh_version unsupported_dsh_capabilities unsupported_remote_version unsupported_remote_capabilities network_timeout network_unreachable tls_failure remote_closed device_pending device_revoked permissions_changed credential_expired invalid_authentication response_too_large response_buffer_limit response_chunk_timeout invalid_response_chunk incomplete_response_chunk remote_bridge_timeout request_timeout_outcome_unknown connection_closed_outcome_unknown host_disconnected_outcome_unknown remote_generation_changed remote_not_connected invalid_response response_failed web_restart_busy web_restart_save_failed update_bridge_failed plugin_operation_failed mount_failed activation_failed load_failed storage_failed timeout render_failed resource_load_failed uncaught unhandled_rejection history_gap provider_error stream_closed transport_failed unexpected_content_type invalid_json invalid_chunk invalid_delta missing_finish_reason content_filter insufficient_system_resource provider_model_missing credential_unavailable key_required`.split(' '));

export function safeFailureCode(value, fallback = 'unknown_error') {
  const code = typeof value === 'string' ? value.toLowerCase() : '';
  return knownCodes.has(code) || /^http_[1-5]\d\d$/.test(code) ? code : fallback;
}

/** Keep executable locations and exception types. Error messages, URL parameters and arbitrary function names can contain user data. */
export function webException(error, fallbackLocation) {
  const causes = [], seen = new Set();
  let remaining = 300, omitted = 0;
  function add(value, relation) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return;
    if (causes.length >= 16) { omitted++; return; }
    seen.add(value);
    try {
      const type = errorTypes.has(value.name) ? value.name : 'Error';
      const stack = typeof value.stack === 'string' ? value.stack.slice(0, 150_000) : '';
      const frames = [];
      for (const raw of stack.split('\n')) {
        if (!/^\s*at\s/.test(raw)) continue;
        const match = localFrame.exec(raw) ?? browserFrame.exec(raw);
        if (!match || !stackFile.test(match[1])) { omitted++; continue; }
        if (remaining <= 0) { omitted++; continue; }
        const [, file, line, column] = match;
        frames.push(`${file}:${Number(line)}:${Number(column)}`);
        remaining--;
      }
      if (!frames.length && fallbackLocation && stackFile.test(fallbackLocation.file)) {
        frames.push(`${fallbackLocation.file}:${fallbackLocation.line}:${fallbackLocation.column}`);
      }
      causes.push({ type, relation, frames });
      add(value.cause, 'cause');
      if (type === 'AggregateError' && Array.isArray(value.errors)) {
        for (const child of value.errors.slice(0, 16)) add(child, 'suppressed');
        omitted += Math.max(0, value.errors.length - 16);
      }
    } catch { omitted++; }
  }
  add(error, 'root');
  return { causes, omitted };
}

export function diagnosticLocation(url, line, column) {
  const match = localFrame.exec(`${url}:${line}:${column}`);
  return match && stackFile.test(match[1]) ? { file: match[1], line, column } : undefined;
}

const ignoredSpan = Object.assign(() => {}, { stage() {} });

export const diagnostics = {
  record(domain, event, options = {}) {
    globalThis.__dshmDiagnostics?.record(domain, event, options);
  },
  span(domain, event) {
    if (globalThis.__dshmDiagnostics?.enabled === false) return ignoredSpan;
    const trace = globalThis.crypto?.randomUUID?.();
    const started = performance.now();
    this.record(domain, `${event}_start`, { trace });
    const finish = (result, { error, code, count } = {}) => this.record(domain, `${event}_${result}`, {
      trace, error, code, count, duration: Math.round(performance.now() - started),
      level: result === 'failed' ? 'ERROR' : result === 'cancelled' ? 'WARN' : 'INFO',
    });
    finish.stage = (event, options = {}) => this.record(domain, event, { ...options, trace, duration: Math.round(performance.now() - started) });
    finish.trace = trace;
    return finish;
  },
};
