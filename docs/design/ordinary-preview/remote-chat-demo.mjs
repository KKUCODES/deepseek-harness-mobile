// 仅驱动交互预览，不实现或替代真实网关协议、审批权限与模型调用。
export const responseText = '已检查当前工作区的相关内容。\n\n输入区域使用独立滚动容器，保留草稿；连接恢复后先读取最新状态，避免重复提交。\n\n这是一段逐步显示的示例回复，没有调用电脑或模型。';
export const fileExample = {
  path: 'src/composer.ts',
  before: 'export const composer = {\n  height: 120,\n  keepDraft: false,\n};\n',
  after: 'export const composer = {\n  height: 56,\n  keepDraft: true,\n};\n',
  latest: '// 示例完整文件：包含这次修改之后的更新\nexport const composer = {\n  height: 56,\n  keepDraft: true,\n  restoreSelection: true,\n};\n\nexport function canSend(text: string) {\n  return text.trim().length > 0;\n}\n',
};
export const phaseLabel = { approval: '等待批准', question: '等待回答', running: '正在回复', sending: '发送中', accepted: '电脑已接收', queued: '排队中', done: '已完成', stopped: '已停止', failed: '执行失败', unknown: '发送结果未知' };
// 模型名来自上游会话模型测试样例；真实列表必须由绑定电脑提供。
export const demoModels = [
  { provider: 'deepseek-official', id: 'deepseek-chat', name: 'DeepSeek Chat' },
  { provider: 'deepseek-official', id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
];
export function createSession(task, text) {
  const phase = text ? 'queued' : ({ approval: 'approval', question: 'question', running: 'running', queued: 'queued', failed: 'failed' }[task.id] || 'done');
  return { phase, model: demoModels[0], modelPending: null, modelStatus: 'ready', modelError: '', modelFailNext: false, modelSource: '电脑', draft: '', attachments: [], messages: [{ id: `${task.id}-start`, role: 'user', text: text || `请帮我${task.title}。`, delivery: '电脑已接收' }], reply: ['done', 'failed'].includes(phase) ? responseText : '', queue: [], approval: 'pending', answer: '', question: 'pending', history: 'idle', fault: 'normal', turn: 0 };
}
export function sessionStatus(session) {
  return { label: phaseLabel[session.phase], status: ['approval', 'question', 'unknown'].includes(session.phase) ? 'attention' : ['running', 'sending', 'accepted', 'queued'].includes(session.phase) ? 'running' : 'other' };
}
export function advanceSession(s, action) {
  const busy = ['running', 'sending', 'accepted', 'queued', 'approval', 'question'].includes(s.phase);
  switch (action.type) {
    case 'model-select': {
      const model = demoModels.find(item => item.id === action.id);
      if (!action.online || !model || ['selecting', 'unknown'].includes(s.modelStatus) || model.id === s.model.id) return s;
      return { ...s, modelPending: model, modelStatus: 'selecting', modelError: '' };
    }
    case 'model-host-change': {
      const model = demoModels.find(item => item.id === action.id);
      return action.online && model ? { ...s, model, modelPending: null, modelStatus: 'ready', modelError: '', modelSource: '电脑' } : s;
    }
    case 'model-disconnected': return s.modelStatus === 'selecting' ? { ...s, modelStatus: 'unknown', modelError: '连接中断，切换结果未知，请重连后核对。' } : s;
    case 'model-refresh': return action.online ? { ...s, modelPending: null, modelStatus: 'ready', modelError: '', modelSource: '电脑' } : s;
    case 'draft': return { ...s, draft: action.value };
    case 'attach': return { ...s, attachments: [...new Set([...s.attachments, action.name])] };
    case 'remove-attachment': return { ...s, attachments: s.attachments.filter(name => name !== action.name) };
    case 'answer': return { ...s, answer: action.value };
    case 'send': {
      if (!action.online || !s.draft.trim() || s.phase === 'unknown' || ['selecting', 'unknown'].includes(s.modelStatus)) return s;
      const message = { id: action.id, role: 'user', text: s.draft.trim(), attachments: s.attachments, delivery: busy ? '排队中' : '发送中' };
      if (busy) return { ...s, draft: '', attachments: [], queue: [...s.queue, message] };
      const previous = s.reply ? [{ id: `${action.id}-previous`, role: 'assistant', text: s.reply }] : [];
      return { ...s, phase: 'sending', draft: '', attachments: [], messages: [...s.messages, ...previous, message], reply: '', turn: s.turn + 1 };
    }
    case 'tick':
      if (!action.online) return s;
      if (s.modelStatus === 'selecting') return s.modelFailNext
        ? { ...s, modelPending: null, modelStatus: 'error', modelError: '切换失败，仍使用原模型，请重新选择。', modelFailNext: false }
        : { ...s, model: s.modelPending, modelPending: null, modelStatus: 'ready', modelError: '', modelSource: '手机' };
      if (s.phase === 'sending') return { ...s, phase: s.fault === 'unknown' ? 'unknown' : 'accepted', messages: s.messages.map((m, i) => i === s.messages.length - 1 ? { ...m, delivery: s.fault === 'unknown' ? '结果未知' : '电脑已接收' } : m) };
      if (s.phase === 'accepted') return { ...s, phase: 'running' };
      if (s.phase === 'running') { const reply = responseText.slice(0, s.reply.length + 6); return { ...s, reply, phase: reply.length === responseText.length ? 'done' : 'running' }; }
      return s;
    case 'stop': return action.online && busy ? { ...s, phase: 'stopped', approval: s.phase === 'approval' ? 'canceled' : s.approval, question: s.phase === 'question' ? 'canceled' : s.question } : s;
    case 'cancel-queue': return action.online ? { ...s, queue: s.queue.filter(m => m.id !== action.id) } : s;
    case 'next': {
      if (!action.online || busy || s.phase === 'unknown' || !s.queue.length) return s;
      const [message, ...queue] = s.queue;
      const previous = s.reply ? [{ id: `${message.id}-previous`, role: 'assistant', text: s.reply }] : [];
      return { ...s, phase: 'accepted', queue, reply: '', turn: s.turn + 1, messages: [...s.messages, ...previous, { ...message, delivery: '电脑已接收' }] };
    }
    case 'start-queued': return action.online && s.phase === 'queued' ? { ...s, phase: 'accepted' } : s;
    case 'approve':
    case 'reject':
    case 'handled':
      if (!action.online || s.phase !== 'approval' || s.approval !== 'pending') return s;
      return { ...s, approval: action.type === 'approve' ? 'approved' : action.type === 'reject' ? 'rejected' : 'handled', phase: action.type === 'reject' ? 'stopped' : 'accepted' };
    case 'submit-answer': return action.online && s.phase === 'question' && s.question === 'pending' && s.answer.trim() ? { ...s, question: 'answered', phase: 'accepted', messages: [...s.messages, { id: action.id, role: 'user', text: s.answer, delivery: '电脑已接收' }] } : s;
    case 'question-handled': return s.phase === 'question' ? { ...s, question: 'handled', phase: 'accepted' } : s;
    case 'verify': return action.online && s.phase === 'unknown' ? { ...s, phase: 'accepted', fault: 'normal', messages: s.messages.map(m => m.delivery === '结果未知' ? { ...m, delivery: '已核对：电脑已接收' } : m) } : s;
    case 'history-loading': return { ...s, history: 'loading' };
    case 'history-error': return { ...s, history: 'error' };
    case 'history-ready': return s.history === 'complete' ? s : { ...s, history: 'complete', messages: [{ id: 'older-user', role: 'user', text: '先确认现有布局和返回路径。', delivery: '电脑已接收' }, { id: 'older-answer', role: 'assistant', text: '已查看原版界面，将保留 DSH 的布局、主题与现有交互。以下是后续任务记录。' }, ...s.messages.filter(m => !m.id.startsWith('older-'))] };
    case 'scene': return { ...s, ...action.patch };
    default: return s;
  }
}
