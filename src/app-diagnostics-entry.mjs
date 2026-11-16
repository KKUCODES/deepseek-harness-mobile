import { diagnosticLocation, safeFailureCode, webException } from './app-diagnostics.mjs';

const mode = location.pathname.endsWith('/remote.html') ? 'remote' : 'ordinary';
const build = document.querySelector('meta[name="dshm-web-build"]')?.content;
const bridge = window.DSHMDiagnostics;
const stackLimit = Error.stackTraceLimit;
let rows = [], localId = 0, pending = false, cursor = 0;
let enabled = !bridge || window.__dshmCaptureEnabled === true;
let captureUpdate, bucket = -1, infoCount = 0, errorCount = 0;
const subscribers = new Set();
const copies = new Map();
const notify = () => subscribers.forEach(listener => listener());
const publish = entries => { rows = [...rows, ...entries].slice(-400); notify(); };
const send = value => { try { bridge?.postMessage(JSON.stringify(value)); return true; } catch { return false; } };
const read = () => {
  if (!bridge || pending || !subscribers.size) return;
  pending = true;
  if (!send({ op: 'read', after: cursor })) pending = false;
};
if (bridge) bridge.onmessage = event => {
  try {
    const reply = JSON.parse(event.data);
    if (typeof reply.captureEnabled === 'boolean') {
      setCapture(reply.captureEnabled);
      if (reply.updated) captureUpdate?.(true);
      return;
    }
    if (reply.copied) { copies.get(reply.copied)?.(reply.ok); return; }
    if (reply.changed) { read(); return; }
    pending = false;
    if (!Array.isArray(reply.rows)) return;
    if (reply.rows.length) {
      cursor = reply.rows.at(-1).id;
      publish(reply.rows);
    }
    if (reply.more) read();
  } catch { pending = false; }
};
const api = window.__dshmDiagnostics = Object.freeze({
  record(domain, event, { level = 'INFO', code, error, trace, duration, count, location: source } = {}) {
    if (!enabled) return;
    const second = Math.floor(performance.now() / 1000);
    if (bucket !== second) { bucket = second; infoCount = errorCount = 0; }
    if (level === 'INFO' ? ++infoCount > 64 : ++errorCount > 16) return;
    const entry = { domain, event, level, build, trace, duration, count,
      code: code ? safeFailureCode(code) : undefined,
      ...(error ? { exception: webException(error, source) } : {}),
      ...(source ? { location: source } : {}),
    };
    if (bridge) send({ op: 'record', entry });
    else publish([{ ...entry, id: ++localId, at: Date.now(), source: 'webview', mode }]);
  },
  getSnapshot: () => rows,
  get enabled() { return enabled; },
  getCapture: () => enabled,
  subscribe(listener) {
    const first = !subscribers.size;
    subscribers.add(listener);
    if (bridge && first) send({ op: 'watch' });
    read();
    return () => { subscribers.delete(listener); if (bridge && !subscribers.size) send({ op: 'unwatch' }); };
  },
  persisted: Boolean(bridge),
  async setCapture(value) {
    if (!bridge) { setCapture(value); return; }
    if (captureUpdate) throw Error('diagnostics_capture_unavailable');
    const applied = await new Promise(resolve => {
      const timeout = setTimeout(() => { captureUpdate = undefined; resolve(false); }, 4000);
      captureUpdate = ok => { clearTimeout(timeout); captureUpdate = undefined; resolve(ok); };
      if (!send({ op: 'setCapture', enabled: value })) captureUpdate(false);
    });
    if (!applied) throw Error('diagnostics_capture_unavailable');
  },
  async copy(id) {
    if (!bridge || copies.has(id)) throw Error('diagnostics_copy_unavailable');
    const copied = await new Promise(resolve => {
      const timeout = setTimeout(() => { copies.delete(id); resolve(false); }, 4000);
      copies.set(id, ok => { clearTimeout(timeout); copies.delete(id); resolve(ok); });
      send({ op: 'copy', id });
    });
    if (!copied) throw Error('diagnostics_copy_unavailable');
  },
});
function onError(event) {
  if (event instanceof ErrorEvent) {
    api.record(mode, 'uncaught_error', { level: 'ERROR', code: 'uncaught', error: event.error,
      location: diagnosticLocation(event.filename, event.lineno, event.colno) });
  } else if (['SCRIPT', 'LINK'].includes(event.target?.tagName)) {
    api.record('startup', 'resource_load_failed', { level: 'ERROR', code: 'resource_load_failed' });
  }
}
const onRejection = event => api.record(mode, 'unhandled_rejection', {
  level: 'ERROR', code: 'unhandled_rejection', error: event.reason,
});

function setCapture(value) {
  enabled = value;
  if (enabled) {
    Error.stackTraceLimit = 300;
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);
  } else {
    Error.stackTraceLimit = stackLimit;
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
  }
  notify();
}
setCapture(enabled);
if (bridge) send({ op: 'watchCapture' });
