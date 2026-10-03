import { clientFrameSchema, hostFrameSchema } from '../../backend/packages/protocol/dist/index.js';

/** 已有协议的手机端客户端；私钥、token、ticket 全留在 Remote 原生桥。 */
export class RemoteClient {
  pending = new Map();
  requests = new Map();
  listeners = new Set();
  connected = false;
  constructor(bridge = globalThis.DSHMRemote) {
    this.bridge = bridge;
    if (bridge) bridge.onmessage = event => {
      let value;
      try { value = JSON.parse(event.data); } catch { return; }
      if (value.event) { this.receive(value.event); return; }
      const task = this.pending.get(value.id);
      if (!task) return;
      clearTimeout(task.timer); this.pending.delete(value.id);
      value.error ? task.reject(new Error(value.error)) : task.resolve(value.data);
    };
  }
  call(op, data = {}, timeoutMs = 30000) {
    if (!this.bridge) return Promise.reject(new Error('android_required'));
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('remote_bridge_timeout')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.bridge.postMessage(JSON.stringify({ id, op, data })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('remote_bridge_unavailable')); }
    });
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  publish(value) { for (const listener of this.listeners) listener(value); }
  receive(value) {
    if (value.type === 'ready' && value.protocol === 1) { this.connected = true; this.publish(value); return; }
    if (value.type === 'closed') { this.reset(); this.publish(value); return; }
    const parsed = hostFrameSchema.safeParse(value);
    if (!parsed.success) { this.reset(); this.publish({ type: 'closed', reason: 'invalid_protocol' }); void this.call('socket.release').catch(() => {}); return; }
    const frame = parsed.data;
    const request = this.requests.get(frame.id);
    if (!request) return;
    clearTimeout(request.timer);
    if (frame.type === 'error') request.reject(new Error(frame.code));
    else if (frame.type === 'event') { request.onEvent?.(frame.value); return; }
    else if (frame.type === 'result') request.resolve(frame.value);
    else { request.onEnd?.(); request.resolve(undefined); }
    this.requests.delete(frame.id);
  }
  request(operation, onEvent, onEnd) {
    const frame = clientFrameSchema.parse({ type: 'request', id: crypto.randomUUID(), operation });
    if (!this.connected) throw new Error('remote_not_connected');
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(frame.id);
        void this.call('socket.send', { frame: { type: 'cancel', id: frame.id } }).catch(() => {});
        reject(new Error('request_timeout_outcome_unknown'));
      }, 35000);
      this.requests.set(frame.id, { resolve, reject, timer, onEvent, onEnd });
      void this.call('socket.send', { frame }).catch(error => {
        clearTimeout(timer); this.requests.delete(frame.id); reject(error);
      });
    });
    return { id: frame.id, promise, cancel: () => {
      const request = this.requests.get(frame.id);
      if (!request) return;
      clearTimeout(request.timer); this.requests.delete(frame.id); request.resolve(undefined);
      void this.call('socket.send', { frame: { type: 'cancel', id: frame.id } }).catch(() => {});
    } };
  }
  reset() {
    this.connected = false;
    for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('connection_closed_outcome_unknown')); }
    this.requests.clear();
  }
  async disconnect() { this.reset(); await this.call('socket.disconnect'); this.publish({ type: 'closed', reason: 'user_disconnect' }); }
  async release() { this.reset(); await this.call('socket.release'); }
}
