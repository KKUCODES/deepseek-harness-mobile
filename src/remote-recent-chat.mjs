import { historyGroups } from './remote-history.mjs';

const MAX_CHATS = 3, MAX_GROUPS = 24, MAX_BYTES = 512 * 1024;
const MAX_AGE = 10 * 60 * 1000;
const keyOf = target => JSON.stringify(typeof target === 'string' ? target
  : [target.parentSessionId, target.childSessionId, target.mode]);

/** 只复制正文投影，离开后不持有 Session 引用、实时订阅或插件作用域。 */
export class RemoteRecentChats {
  entries = new Map();
  clear = () => this.entries.clear();
  forget(id) {
    for (const [key, entry] of this.entries) if (entry.id === id) this.entries.delete(key);
  }
  take(target) {
    const key = keyOf(target), entry = this.entries.get(key);
    this.entries.delete(key);
    if (entry && Date.now() - entry.at < MAX_AGE) return entry;
  }
  remember({ selected, selectedTarget, session, conversation }, anchor) {
    const key = keyOf(selectedTarget);
    this.entries.delete(key);
    if (session?.openState !== 'open' || session.openError || session.removed) return;
    const order = conversation?.order;
    if (!order?.length) return;
    const position = anchor ? order.indexOf(anchor.nodeKey) : order.length - 1;
    if (position < 0) return;
    const groups = historyGroups({ nodes: conversation.nodes,
      order: order.slice(Math.max(0, position - 96), position + 97) });
    const index = anchor ? groups.findIndex(group => group.id === anchor.group) : -1;
    const start = index < 0 ? Math.max(0, groups.length - MAX_GROUPS)
      : Math.min(Math.max(0, index - 4), Math.max(0, groups.length - MAX_GROUPS));
    try {
      let remaining = MAX_BYTES;
      // location 含有原 DSH 的订阅对象。缓存只交付渲染数据，不复制这些运行时句柄。
      const window = groups.slice(start, start + MAX_GROUPS).map(group => ({ ...group,
        nodes: group.nodes.map(({ key, kind, visibility, data }) => ({ key, kind, visibility, data })) }));
      const json = JSON.stringify(window, (key, value) => {
        remaining -= key.length + (typeof value === 'string' ? value.length : 0) + 4;
        if (remaining < 0) throw Error('remote_recent_chat_limit');
        return value;
      });
      if (json === '[]' || new TextEncoder().encode(json).length > MAX_BYTES) return;
      this.entries.set(key, { id: selected, groups: JSON.parse(json), anchor: index < 0 ? null : anchor, at: Date.now() });
      if (this.entries.size > MAX_CHATS) this.entries.delete(this.entries.keys().next().value);
    } catch { /* 单条记录过大或包含不可序列化数据时，沿用原会话读取。 */ }
  }
}
