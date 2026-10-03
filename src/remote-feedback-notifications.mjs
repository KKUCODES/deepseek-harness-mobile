/** 只重开只读失效订阅，不重放反馈写入。每次握手都重新核对当前值。 */
export function watchFeedback(model, sessionId, changed) {
  let current, disposed = false;
  const stop = () => { const previous = current; current = undefined; previous?.request?.cancel(); };
  const start = () => {
    stop();
    if (disposed || !model.connection.generation.getSnapshot()) return;
    const state = current = { revision: -1 };
    const failed = () => {
      if (disposed || current !== state) return;
      stop(); model.fail(new Error('评价同步已中断，请重新连接电脑。'));
    };
    try {
      state.request = model.client.request({ method: 'remote.feedbackFollow', sessionId }, value => {
        if (disposed || current !== state) return;
        if (!Number.isSafeInteger(value?.revision) || value.revision < 0
          || (state.revision === -1 ? value.type !== 'ready' || value.revision !== 0
            : value.type !== 'changed' || value.revision <= state.revision)) { failed(); return; }
        state.revision = value.revision; changed();
      }, failed);
      void state.request.promise.then(failed, failed);
      // 桥实现可能同步回调；失效后仍需取消刚返回的句柄。
      if (current !== state) state.request.cancel();
    } catch { failed(); }
  };
  const off = model.connection.generation.subscribe(start);
  start();
  return () => { disposed = true; off(); stop(); };
}
