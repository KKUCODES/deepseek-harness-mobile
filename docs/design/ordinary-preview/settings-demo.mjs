// 设计预览格式，与正式 App 的数据库迁移/备份格式无关。
export const backupExample = { format: 'dshm-design-preview', version: 1, chats: [{ id: 'import-example', title: '导入的旅行清单', group: '今天', messages: [{ role: 'user', text: '出门前记得带什么？' }, { role: 'assistant', text: '水、雨伞和充电器。这是一条导入示例。' }] }] };
export function exportPreviewHistory(chats) {
  return JSON.stringify({ format: 'dshm-design-preview', version: 1, chats: chats.map(chat => ({ id: chat.id, title: chat.title, group: chat.group, messages: chat.messages.map(message => ({ role: message.role, text: message.text, ...(message.thought ? { thought: message.thought } : {}) })) })) }, null, 2);
}
export function parsePreviewHistory(text) {
  if (text.length > 1_000_000) throw new Error('文件过大，请选择较小的备份文件。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('无法读取文件，请使用有效的 JSON 备份。'); }
  if (data?.format !== 'dshm-design-preview' || data.version !== 1) throw new Error('备份版本不兼容，未导入任何聊天。');
  if (!Array.isArray(data.chats) || data.chats.length > 500) throw new Error('聊天列表格式无效。');
  const string = value => typeof value === 'string' && value.length <= 100_000;
  const seen = new Set();
  return data.chats.map(chat => {
    if (!chat || !string(chat.id) || !chat.id.trim() || seen.has(chat.id) || !string(chat.title) || !Array.isArray(chat.messages) || chat.messages.length > 2000) throw new Error('聊天数据不完整或编号重复，未导入任何聊天。');
    seen.add(chat.id);
    return { id: chat.id, title: chat.title, group: ['今天', '昨天'].includes(chat.group) ? chat.group : '今天', messages: chat.messages.map(message => {
      if (!message || !['user', 'assistant'].includes(message.role) || !string(message.text) || (message.thought !== undefined && !string(message.thought))) throw new Error('消息格式不兼容，未导入任何聊天。');
      return { role: message.role, text: message.text, ...(message.thought ? { thought: message.thought } : {}) };
    }) };
  });
}
export function mergePreviewHistory(current, incoming) {
  const ids = new Set(current.map(chat => chat.id));
  const added = incoming.filter(chat => !ids.has(chat.id));
  return { chats: [...added, ...current], added: added.length, skipped: incoming.length - added.length };
}
export function notificationPreview({ lifecycle, permission, online, enabled, event = 'attention' }) {
  const summary = { attention: '调整手机端输入框 · 有一项操作需要确认', done: '优化项目说明 · 任务已完成', failed: '更新网站依赖 · 执行失败' }[event];
  if (lifecycle === 'killed') return { kind: 'none', text: '进程已结束：不推送、不唤醒。重新打开后尝试重连，不补发历史通知。' };
  if (!online) return { kind: 'none', text: '连接不可用：无法接收新事件。恢复连接后读取最新状态。' };
  if (lifecycle === 'current') return { kind: 'inline', text: '正在查看该任务：原地更新，不重复弹出通知。' };
  if (lifecycle === 'foreground') return { kind: 'banner', text: `App 内提示 · ${summary}` };
  if (!permission) return { kind: 'none', text: '系统通知未获允许。仍可正常聊天，回到 App 查看任务。' };
  if (!enabled) return { kind: 'none', text: '此类系统提醒已关闭，任务状态仍会正常更新。' };
  return { kind: 'system', text: summary };
}
