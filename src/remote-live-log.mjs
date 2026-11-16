import { diagnosticCode } from './remote-diagnostics.mjs';
import { diagnostics } from './app-diagnostics.mjs';

const events = {
  connection_start: ['INFO', '正在连接电脑'],
  connection_ready: ['INFO', '电脑已连接'],
  connection_closed: ['WARN', '电脑连接已断开'],
  connection_error: ['ERROR', 'Remote 连接诊断'],
  picker_open: ['INFO', '已打开系统选择器'],
  picker_returned: ['INFO', '系统选择器已返回附件'],
  picker_clipdata: ['INFO', '系统通过 ClipData 返回附件'],
  picker_canceled: ['INFO', '已取消选择'],
  picker_expired: ['WARN', '连接已变化，选择结果已丢弃'],
  picker_rejected: ['WARN', '选择结果未通过校验'],
  picker_failed: ['ERROR', '无法打开系统选择器'],
  files_received: ['INFO', '聊天界面已收到附件'],
  files_skipped: ['WARN', '当前会话未接收附件'],
  files_ready: ['INFO', '附件已加入待发送列表'],
  files_failed: ['ERROR', '附件准备失败'],
};

export function createRemoteLiveLog(limit = 250) {
  let entries = [], sequence = 0;
  const listeners = new Set();
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => entries,
    record(event, value) {
      if (!Object.hasOwn(events, event)) return;
      const [level, label] = events[event];
      // 仅收录预定义事件、受限的数量和已有诊断允许的错误码。
      const detail = event === 'connection_error' ? diagnosticCode(value)
        : Number.isInteger(value) && value >= 0 && value <= 1000 ? value : undefined;
      entries = [...entries, { id: ++sequence, at: Date.now(), level, label, detail }].slice(-limit);
      for (const listener of listeners) listener();
    },
  };
}

export const remoteLiveLog = {
  record(event, value, error) {
    if (!Object.hasOwn(events, event)) return;
    diagnostics.record('remote', event, { level: events[event][0], error,
      ...(event === 'connection_error' ? { code: diagnosticCode(value) } : { count: value }) });
  },
};
export const remoteEventLabel = event => events[event]?.[1];
