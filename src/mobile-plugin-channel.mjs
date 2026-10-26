/** 原生插件管理桥的关联请求通道；不包含安装策略或插件生命周期。 */
export class MobilePluginChannel {
  pending = new Map(); listeners = new Set();
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  constructor(bridge) {
    this.bridge = bridge;
    if (bridge) bridge.onmessage = event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.event) { this.accept(message.event); return; }
      const task = this.pending.get(message.id); if (!task) return;
      this.pending.delete(message.id); clearTimeout(task.timer);
      if (message.error) task.reject(Error(message.error));
      else { this.accept(message.data); task.resolve(this.snapshot); }
    };
  }
  call(op, data = {}, timeoutMs = 8000) {
    if (!this.bridge) return Promise.reject(Error('mobile_plugins_unavailable'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('mobile_plugins_timeout')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.bridge.postMessage(JSON.stringify({ id, op, data })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(Error('mobile_plugins_unavailable')); }
    });
  }
}
