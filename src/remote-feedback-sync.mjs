import { watchFeedback } from './remote-feedback-notifications.mjs';

const changesFeedback = (change, sessionId) => change.kind === 'replace'
  || change.kind === 'append' && change.entries.some(entry => entry.type === 'event'
    && ['feedback/message-put', 'feedback/message-delete'].includes(entry.event.type)
    && entry.event.data.sessionId === sessionId);

/** 把原反馈控件接到当前会话日志；共享订阅，不改原 controller 的串行写入/CAS。 */
export function feedbackObservable(controller, events, sessionId, watch) {
  let activation, observers = 0;
  const request = state => {
    state.dirty = true;
    if (state.running) return;
    state.running = true;
    queueMicrotask(async () => {
      try {
        while (activation === state && state.dirty) {
          state.dirty = false;
          // resync 排在原写操作之后，避免迟到的 list 覆盖本机刚提交的版本。
          await controller.resync();
        }
      } catch {
        // 原 controller 负责错误状态；等待下一次真实事件/重新进入，不循环重试。
      } finally { state.running = false; }
    });
  };
  return {
    getSnapshot: () => controller.getSnapshot(),
    subscribe(listener) {
      const unsubscribe = controller.subscribe(listener);
      observers++;
      if (observers === 1) {
        const state = activation = { dirty: false, running: false, revision: events.getSnapshot().revision };
        state.off = events.subscribe(() => {
          const snapshot = events.getSnapshot();
          if (snapshot.revision === state.revision) return;
          state.revision = snapshot.revision;
          if (changesFeedback(snapshot.change, sessionId)) request(state);
        });
        state.offNotifications = watch?.(() => request(state));
        // 触屏没有悬停，挂载即读取已保存的评价；离开后再进入也重新核对。
        request(state);
      }
      let active = true;
      return () => {
        if (!active) return;
        active = false; unsubscribe(); observers--;
        if (!observers) { activation.off(); activation.offNotifications?.(); activation = undefined; }
      };
    },
  };
}

/** 只适配已核验的原反馈插槽，其余插件注入保持原样。 */
export function syncFeedbackSlot(options, model) {
  const controllers = new WeakMap(), inject = options.inject;
  return { ...options, inject(sessionId) {
    const value = inject(sessionId), controller = value.hooks.feedback;
    const events = model.sessions.binding(sessionId)?.eventSource;
    if (!events || typeof controller.resync !== 'function') throw new Error('电脑反馈插件版本与当前手机不兼容。');
    let sources = controllers.get(controller);
    if (!sources) { sources = new WeakMap(); controllers.set(controller, sources); }
    let observable = sources.get(events);
    if (!observable) {
      const watch = model.transport.capabilities?.feedbackNotifications === true
        ? changed => watchFeedback(model, sessionId, changed) : undefined;
      observable = feedbackObservable(controller, events, sessionId, watch); sources.set(events, observable);
    }
    return { ...value, hooks: { ...value.hooks, feedback: observable } };
  } };
}
