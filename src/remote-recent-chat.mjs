import { historyGroups } from './remote-history.mjs';
import * as sourceValues from '../../deepseek-harness/packages/util/values/src/index.ts';

const MAX_CHATS = 3, MAX_GROUPS = 24, MAX_BYTES = 512 * 1024;
const MAX_AGE = 10 * 60 * 1000;
const keyOf = target => JSON.stringify(typeof target === 'string' ? target
  : [target.parentSessionId, target.childSessionId, target.mode]);

/** 从缓存的字段恢复参数来源；有已解析对象用对象，否则拼接原文再解析。 */
function argumentFields(value) {
  if (value === null || typeof value !== 'object') return { fields: {}, invalid: true };
  if (value.object !== null && typeof value.object === 'object' && !Array.isArray(value.object)) {
    return { fields: value.object, invalid: false };
  }
  if (!Array.isArray(value.chunks)) return { fields: {}, invalid: true };
  try {
    const parsed = JSON.parse(value.chunks.join(''));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { fields: parsed, invalid: false } : { fields: {}, invalid: true };
  } catch { return { fields: {}, invalid: true }; }
}

/** 缓存只剩参数的普通字段；按原只读视图的方法集交付，工具行才能继续读取参数。 */
function argumentView(value) {
  if (value !== null && typeof value === 'object' && typeof value.complete === 'function') return value;
  // 当前 SDK 直接恢复原参数视图，保留未闭合 JSON 中已经完整的字段。
  // 旧 SDK 没有 PartialArguments 时才沿用旧缓存的只读字段适配。
  const PartialArguments = Reflect.get(sourceValues, 'PartialArguments');
  if (PartialArguments) {
    if (value?.object !== null && typeof value?.object === 'object' && !Array.isArray(value.object)) return PartialArguments.fromObject(value.object);
    return PartialArguments.fromText(Array.isArray(value?.chunks) ? value.chunks.join('') : '');
  }
  const { fields, invalid } = argumentFields(value);
  const read = key => Object.hasOwn(fields, key) ? fields[key] : undefined;
  const text = key => { const field = read(key); return typeof field === 'string' ? field : undefined; };
  return {
    isSealed: true,
    invalid,
    closed: () => true,
    keys: () => Object.keys(fields),
    has: key => Object.hasOwn(fields, key),
    complete: key => Object.hasOwn(fields, key),
    text,
    textPrefix: (key, maxLength) => text(key)?.slice(0, Math.max(1, Math.floor(maxLength))),
    stringLength: key => text(key)?.length,
    stringExceeds: (key, maxLength) => (text(key)?.length ?? 0) > Math.max(0, Math.floor(maxLength)),
    value: key => { const field = read(key); return typeof field === 'string' ? undefined : field; },
    refresh: () => false,
    append() { throw new Error('PartialArguments: cannot append to a sealed view'); },
    settle: next => argumentView({ chunks: [next] }),
  };
}

/** 工具调用的参数视图与子调用随缓存退化为普通字段；读回时恢复成可读取的只读视图。 */
function restoreTool(tool) {
  if (tool === null || typeof tool !== 'object') return;
  tool.args = argumentView(tool.args);
  for (const child of tool.subCalls ?? []) restoreTool(child);
}

function restoreGroups(groups) {
  for (const group of groups) {
    for (const node of group.nodes ?? []) {
      if (node?.kind === 'tool-call') restoreTool(node.data?.root);
    }
  }
  return groups;
}

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
    if (entry && Date.now() - entry.at < MAX_AGE) return { ...entry, groups: restoreGroups(entry.groups) };
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
