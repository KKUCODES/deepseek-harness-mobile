import { clientFrameSchema, hostFrameSchema, isStream, ResponseAssembler, RESPONSE_IDLE_MS, RESPONSE_TOTAL_MS } from '../../backend/packages/protocol/dist/index.js';

/** 已有协议的手机端客户端；私钥、token、ticket 全留在 Remote 原生桥。 */
export class RemoteClient {
  pending = new Map();
  requests = new Map();
  listeners = new Set();
  connected = false;
  assembler = new ResponseAssembler();
  relayResponseChunks = false;
  responseChunksEnabled = false;
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
    if (value.type === 'ready' && value.protocol === 1) {
      if (this.connected || this.requests.size) this.reset();
      this.relayResponseChunks = value.responseChunksVersion === 1;
      this.connected = true; this.publish(value); return;
    }
    if (value.type === 'closed') { this.reset(); this.publish(value); return; }
    const parsed = hostFrameSchema.safeParse(value);
    if (!parsed.success) { this.reset(); this.publish({ type: 'closed', reason: 'invalid_protocol' }); void this.call('socket.release').catch(() => {}); return; }
    const frame = parsed.data;
    const request = this.requests.get(frame.id);
    if (!request) return;
    if (frame.type === 'error') { this.fail(frame.id, request, new Error(frame.code)); return; }
    const part = ['responseStart', 'responseChunk', 'responseEnd'].includes(frame.type);
    if (part || request.chain) {
      request.chain = (request.chain ?? Promise.resolve()).then(async () => {
        if (this.requests.get(frame.id) !== request) return;
        if (!part) {
          if (request.fragmentStarted !== undefined) throw Error('incomplete_response_chunk');
          this.accept(frame, request); return;
        }
        if (!request.chunks) throw Error('unnegotiated_response_chunks');
        clearTimeout(request.timer);
        if (frame.type === 'responseStart') request.fragmentStarted = Date.now();
        clearTimeout(request.fragmentTimer);
        const remaining = RESPONSE_TOTAL_MS - (Date.now() - request.fragmentStarted);
        request.fragmentTimer = setTimeout(() => this.fail(frame.id, request, Error('response_chunk_timeout')), Math.max(1, Math.min(RESPONSE_IDLE_MS, remaining)));
        const result = await this.assembler.accept(frame, request.stream);
        if (this.requests.get(frame.id) !== request) return;
        if (result.ack) await this.call('socket.send', { frame: result.ack });
        if (result.frame) {
          clearTimeout(request.fragmentTimer); request.fragmentStarted = undefined;
          this.accept(result.frame, request);
        }
      }).catch(error => this.fail(frame.id, request, error));
      return;
    }
    this.accept(frame, request);
  }
  accept(frame, request) {
    if (this.requests.get(frame.id) !== request) return;
    clearTimeout(request.timer);
    if (frame.type === 'error') { this.fail(frame.id, request, new Error(frame.code)); return; }
    else if (frame.type === 'event') { request.onEvent?.(frame.value); return; }
    else if (frame.type === 'result') request.resolve(frame.value);
    else { request.onEnd?.(); request.resolve(undefined); }
    this.requests.delete(frame.id);
  }
  fail(id, request, error) {
    if (this.requests.get(id) !== request) return;
    clearTimeout(request.timer); clearTimeout(request.fragmentTimer);
    this.assembler.cancel(id); this.requests.delete(id); request.reject(error);
    void this.call('socket.send', { frame: { type: 'cancel', id } }).catch(() => {});
  }
  request(operation, onEvent, onEnd) {
    const chunks = this.responseChunksEnabled && this.relayResponseChunks;
    const frame = clientFrameSchema.parse({ type: 'request', id: crypto.randomUUID(), operation, ...(chunks ? { responseChunks: 1 } : {}) });
    if (!this.connected) throw new Error('remote_not_connected');
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = this.requests.get(frame.id);
        if (request) this.fail(frame.id, request, new Error('request_timeout_outcome_unknown'));
      }, 35000);
      this.requests.set(frame.id, { resolve, reject, timer, onEvent, onEnd, chunks, stream: isStream(operation) });
      void this.call('socket.send', { frame }).catch(error => {
        const request = this.requests.get(frame.id);
        if (request) this.fail(frame.id, request, error);
      });
    });
    return { id: frame.id, promise, cancel: () => {
      const request = this.requests.get(frame.id);
      if (!request) return;
      clearTimeout(request.timer); clearTimeout(request.fragmentTimer);
      this.assembler.cancel(frame.id); this.requests.delete(frame.id); request.resolve(undefined);
      void this.call('socket.send', { frame: { type: 'cancel', id: frame.id } }).catch(() => {});
    } };
  }
  reset() {
    this.connected = false;
    this.relayResponseChunks = false; this.responseChunksEnabled = false; this.assembler.clear();
    for (const request of this.requests.values()) { clearTimeout(request.timer); clearTimeout(request.fragmentTimer); request.reject(new Error('connection_closed_outcome_unknown')); }
    this.requests.clear();
  }
  async disconnect() { this.reset(); await this.call('socket.disconnect'); this.publish({ type: 'closed', reason: 'user_disconnect' }); }
  async release() { this.reset(); await this.call('socket.release'); }
}
