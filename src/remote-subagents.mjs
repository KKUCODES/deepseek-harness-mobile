export const SUBAGENT_MODEL_READ_ONLY = '当前电脑端不支持在子会话中更换模型或思考强度。';
export const EXTERNAL_SUBAGENT_MESSAGE = '此任务的执行结果显示在父会话。';

/** 外部执行器只有任务标识，没有可供主聊天或旁栏打开的本地 Session。 */
export function assertLocalSubagent(entry) {
  if (entry.mode === 'external') throw new Error(EXTERNAL_SUBAGENT_MESSAGE);
}

/** 只展示当前父会话的官方结算记录，不把提示词、工具参数或其他消息当作结果。 */
export function externalSubagentResults(entries) {
  const results = new Map();
  for (const { event } of entries) {
    if (event?.type !== 'user/message' || event.data.source?.kind !== 'subagent-settled') continue;
    const id = event.data.source.senderSessionId;
    if (typeof id !== 'string') continue;
    results.set(id, { seq: event.seq, text: (event.data.content ?? [])
      .filter(block => block.type === 'text').map(block => block.text).join('\n') });
  }
  return results;
}

/** 跟随已协商的 Host 实例，旧订阅不得恢复新连接的发送资格。 */
export function watchSubagentService(model) {
  let disposed = false, current, key;
  const stop = () => { const old = current; current = undefined; old?.request?.cancel(); };
  const start = () => {
    const supported = model.transport.capabilities?.subagentState === true;
    const next = supported && model.getSnapshot().connectionState === 'connected' && model.capabilityGeneration;
    if (disposed || key === next) return;
    key = next; stop();
    model.publish({ subagentServiceAvailable: supported ? false : undefined });
    if (!next) return;
    const subscription = current = {};
    const fail = () => {
      if (disposed || current !== subscription) return;
      stop(); model.publish({ subagentServiceAvailable: false });
    };
    try {
      subscription.request = model.client.request({ method: 'remote.subagentStateFollow' }, state => {
        if (disposed || current !== subscription) return;
        if (!state || typeof state.available !== 'boolean' || Object.keys(state).length !== 1) { fail(); return; }
        model.publish({ subagentServiceAvailable: state.available });
      }, fail);
      void subscription.request.promise.then(fail, fail);
      if (current !== subscription) subscription.request.cancel();
    } catch { fail(); }
  };
  const off = model.subscribe(start);
  start();
  return () => { disposed = true; off(); stop(); };
}

/** 原错误仍留在 Session store；主聊天与旁栏只转换公开的诊断文案。 */
export function subagentReadError(error) {
  // 原 SDK 将未标记的流异常包装为 gateway/internal，并保留原错误码作为 message。
  return (error?.code === 'subagent/catalog-diagnostic'
    || error?.code === 'gateway/internal' && error?.message === 'subagent/catalog-diagnostic'
    || error?.code == null && error?.message === 'subagent/catalog-diagnostic')
    ? '无法确认这个子会话的记录，请在电脑上检查。'
    : error?.message;
}

/** 目录中的 inactive 只说明当前未运行，不表示任务成功或已完成。 */
export function subagentStatus(entry, t = text => text) {
  if (entry.kind === 'diagnostic') return t({ corrupt: '记录无法解析', unsupported: '暂不支持此记录', unavailable: '暂时无法读取' }[entry.reason] ?? '暂时无法读取');
  if (entry.mode === 'external') return t('外部任务');
  return `${t(entry.activity === 'running' ? '进行中' : '当前未运行')} · ${t(entry.mode === 'unknown' ? '模式未知' : entry.mode === 'one-shot' ? '只读记录' : '可继续聊天')}`;
}

export function subagentAccess(state, serviceAvailable = state.subagentServiceAvailable) {
  const address = state.session?.subagent?.address ?? (typeof state.selectedTarget === 'object' ? state.selectedTarget : null);
  if (!address) return { address: null, canSend: true, canStop: true, message: null };
  if (address.mode === 'external') return { address, canSend: false, canStop: false, message: EXTERNAL_SUBAGENT_MESSAGE };
  if (address.mode === 'unknown') return { address, canSend: false, canStop: false,
    // 读取已失败时上方显示真实错误，不能继续暗示仍在等待类型确认。
    message: state.session?.openError ? null : '正在确认子会话类型，暂时只能查看记录。' };
  if (address.mode === 'one-shot') return { address, canSend: false, canStop: false, message: '这是一次性子任务，可以查看执行记录。' };
  if (serviceAvailable === false) return { address, canSend: false, canStop: false,
    message: '电脑已停用子会话服务，恢复后可以继续聊天。' };
  const available = state.session?.subagent?.parentAvailable;
  return { address, canSend: available === true, canStop: true,
    message: available === true ? null : available === false ? '父会话暂不可用，恢复后可以继续聊天。' : '正在确认父会话状态…' };
}
