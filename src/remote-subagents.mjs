export const SUBAGENT_MODEL_READ_ONLY = '当前电脑端不支持在子会话中更换模型或思考强度。';

/** 目录中的 inactive 只说明当前未运行，不表示任务成功或已完成。 */
export function subagentStatus(entry, t = text => text) {
  if (entry.kind === 'diagnostic') return t({ corrupt: '记录无法解析', unsupported: '暂不支持此记录', unavailable: '暂时无法读取' }[entry.reason] ?? '暂时无法读取');
  return `${t(entry.activity === 'running' ? '进行中' : '当前未运行')} · ${t(entry.mode === 'one-shot' ? '只读记录' : '可继续聊天')}`;
}

export function subagentAccess(state) {
  const address = state.session?.subagent?.address ?? (typeof state.selectedTarget === 'object' ? state.selectedTarget : null);
  if (!address) return { address: null, canSend: true, canStop: true, message: null };
  if (address.mode === 'one-shot') return { address, canSend: false, canStop: false, message: '这是一次性子任务，可以查看执行记录。' };
  const available = state.session?.subagent?.parentAvailable;
  return { address, canSend: available === true, canStop: true,
    message: available === true ? null : available === false ? '父会话暂不可用，恢复后可以继续聊天。' : '正在确认父会话状态…' };
}
