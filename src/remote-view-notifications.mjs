/** 仅合并界面通知；模型快照与操作订阅仍由调用方同步交付。 */
export class RemoteViewNotifications {
  listeners = new Set();
  timer;
  disposed = false;
  constructor(isAborted) { this.isAborted = isAborted; }
  subscribe = listener => {
    if (this.disposed || this.isAborted()) return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  publish(previous, current) {
    if (this.disposed || this.isAborted()) return;
    // 会话/连接边界立即切换作用域；分页结束立即提交，保证随后测量阅读锚点。
    if (previous?.selected !== current.selected || !!previous?.session !== !!current.session
      || previous?.session?.loadingOlder !== current.session?.loadingOlder
      || previous?.connectionState !== current.connectionState) {
      clearTimeout(this.timer); this.timer = undefined;
      this.notify();
      return;
    }
    // 原流逐条在微任务中交付，界面推迟到下一任务统一刷新；操作订阅仍同步。
    // 不依赖动画帧，避免应用进入后台后挂起必要的界面状态更新。
    if (this.timer === undefined && this.listeners.size) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.notify();
      }, 0);
    }
  }
  notify() {
    if (this.disposed || this.isAborted()) return;
    for (const listener of this.listeners) listener();
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
    clearTimeout(this.timer); this.timer = undefined;
  }
}
