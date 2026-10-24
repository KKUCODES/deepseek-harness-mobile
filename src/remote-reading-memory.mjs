const PREFIX = 'dshm.remote.reading.v1:';
const RECOVERY = 'dshm.remote.reading.recover';
export function markReadingRecovery() { try { sessionStorage.setItem(RECOVERY, String(Date.now())); } catch {} }
export function takeReadingRecovery() {
  try {
    const at = Number(sessionStorage.getItem(RECOVERY)); sessionStorage.removeItem(RECOVERY);
    return at > 0 && Date.now() >= at && Date.now() - at < 60000;
  } catch { return false; }
}
/** 只保存绑定隔离的会话地址和阅读锚点，不保存正文、凭据、审批或待发送动作。 */
export class RemoteReadingMemory {
  constructor(identity, storage = () => globalThis.localStorage) { this.key = identity ? PREFIX + identity : null; this.storage = storage; }
  read() {
    try {
      const value = JSON.parse(this.key && this.storage()?.getItem(this.key));
      if (!value || !Number.isFinite(value.at) || value.at > Date.now() || Date.now() - value.at > 86400000 || typeof value.selected !== 'string'
        || value.selected.length > 512 || !Number.isSafeInteger(value.seq) || value.seq < 0
        || typeof value.group !== 'string' || value.group.length > 2048
        || !Number.isFinite(value.offset) || Math.abs(value.offset) > 100000000) return;
      if (typeof value.target === 'string' && value.target !== value.selected) return;
      if (value.target && typeof value.target !== 'string') {
        const target = value.target;
        if (target.childSessionId !== value.selected || typeof target.parentSessionId !== 'string'
          || target.parentSessionId.length > 512 || !['one-shot', 'continuable', 'unknown'].includes(target.mode)) return;
        value.target = { childSessionId: target.childSessionId, parentSessionId: target.parentSessionId, mode: target.mode };
      }
      return value;
    } catch { /* 只读恢复提示损坏不影响权威会话读取。 */ }
  }
  remember(selected, target, anchor) {
    if (!this.key || !selected || !Number.isSafeInteger(anchor.seq)) return;
    const value = { selected, target, seq: anchor.seq, group: anchor.group, offset: anchor.offset, at: Date.now() };
    // 滚动只更新小型游标；同一回合内按 250ms 合并同步存储写入。
    if (this.last?.selected === selected && this.last?.group === anchor.group && value.at - this.last.at < 250) return;
    this.last = value;
    try { this.storage()?.setItem(this.key, JSON.stringify(value)); } catch { /* 不可持久化时仍保留当前阅读。 */ }
  }
}
