import { StreamFailure } from './ordinary-stream.mjs';

// 同一页面共用响应分发器，复制操作不能覆盖正在生成回复的 onmessage。
let nativeClient;
export const ordinaryNative = () => nativeClient ??= new OrdinaryNative();

export class OrdinaryNative {
  #bridge;
  #pending = new Map();
  constructor(bridge = globalThis.DSHMOrdinary) {
    this.#bridge = bridge;
    if (bridge) bridge.onmessage = event => {
      let response;
      try { response = JSON.parse(event.data); } catch { return; }
      const task = this.#pending.get(response.id);
      if (!task) return;
      this.#pending.delete(response.id);
      clearTimeout(task.timer);
      if (response.error) task.reject(new StreamFailure(response.error));
      else task.resolve(response.data);
    };
  }
  get available() { return !!this.#bridge; }
  call(op, data = {}) {
    if (!this.#bridge) return Promise.reject(new StreamFailure('android_required'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new StreamFailure('bridge_timeout'));
      }, ['key.configure', 'files.pick', 'backup.save'].includes(op) ? 600_000 : 110_000);
      this.#pending.set(id, { resolve, reject, timer });
      try { this.#bridge.postMessage(JSON.stringify({ id, op, data })); }
      catch { clearTimeout(timer); this.#pending.delete(id); reject(new StreamFailure('bridge_unavailable')); }
    });
  }
  status() { return this.call('key.status'); }
  configure() { return this.call('key.configure'); }

  async open({ requestId, model, messages, thinking, requestOptions }, signal) {
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      signal.removeEventListener('abort', finish);
      void this.call('request.cancel', { requestId }).catch(() => {});
    };
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    signal.addEventListener('abort', finish, { once: true });
    try {
      const head = await this.call('request.open', { requestId, model, messages,
        ...(thinking === undefined ? {} : { thinking }), ...(requestOptions === undefined ? {} : { requestOptions }) });
      if (ended) throw new DOMException('Stopped', 'AbortError');
      if (head.status < 200 || head.status >= 300 || head.contentType?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
        finish();
        return new Response(null, { status: head.status, headers: { 'content-type': head.contentType } });
      }
      const body = new ReadableStream({
        pull: async controller => {
          try {
            const part = await this.call('request.read', { requestId });
            if (ended) return;
            if (part.done) { finish(); controller.close(); }
            else controller.enqueue(Uint8Array.from(atob(part.bytes), char => char.charCodeAt(0)));
          } catch (error) { if (!ended) { finish(); controller.error(error); } }
        },
        cancel: finish,
      }, { highWaterMark: 0 });
      return new Response(body, { status: head.status, headers: { 'content-type': head.contentType } });
    } catch (error) { finish(); throw error; }
  }
}
