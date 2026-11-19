/** 首页工作区会话偏好的本地存储键 */
export const WORKSPACE_CHAT_STORAGE_KEY = 'dshm.remote.home.workspace-chats.v1';
/** 工作区展开后默认展示的会话数量 */
export const WORKSPACE_CHAT_PREVIEW_LIMIT = 5;
/** 未归属工作区会话分组的固定标识 */
export const WORKSPACE_CHAT_ORPHAN_ID = '__orphan_sessions__';
/** 未归属工作区会话分组的标题 */
export const WORKSPACE_CHAT_ORPHAN_TITLE = '其他会话';

/** 首页工作区会话偏好的默认值：开关关闭且全部收起 */
export function defaultWorkspaceChatPreferences() {
  return { enabled: false, expanded: {}, active: [], unread: [], seen: [] };
}

/**
 * 归一化首页工作区会话偏好，丢弃未知字段和非法展开状态
 * @param value 待归一化的存储内容
 * @returns 只含 enabled、expanded 与状态集合的偏好
 */
export function normalizeWorkspaceChatPreferences(value) {
  const expanded = {};
  if (value?.expanded && typeof value.expanded === 'object' && !Array.isArray(value.expanded)) {
    for (const [id, mode] of Object.entries(value.expanded)) {
      const normalized = normalizeWorkspaceChatMode(mode);
      if (isWorkspaceChatGroupId(id) && normalized !== 'collapsed') expanded[id] = normalized;
    }
  }
  return {
    enabled: value?.enabled === true,
    expanded,
    active: normalizeSessionIds(value?.active),
    unread: normalizeSessionIds(value?.unread),
    seen: normalizeSessionIds(value?.seen),
  };
}

/**
 * 读取本机保存的首页工作区会话偏好；存储不可用或内容损坏时返回默认值
 * @param storage 形如 localStorage 的同步存储
 * @returns 归一化后的偏好
 */
export function readWorkspaceChatPreferences(storage) {
  try {
    const stored = storage?.getItem(WORKSPACE_CHAT_STORAGE_KEY);
    if (!stored) return defaultWorkspaceChatPreferences();
    return normalizeWorkspaceChatPreferences(JSON.parse(stored));
  } catch {
    return defaultWorkspaceChatPreferences();
  }
}

/**
 * 保存首页工作区会话偏好
 * @param storage 形如 localStorage 的同步存储
 * @param value 待保存的偏好
 * @returns 是否写入成功；失败时由调用方保留内存状态
 */
export function writeWorkspaceChatPreferences(storage, value) {
  try {
    storage?.setItem(WORKSPACE_CHAT_STORAGE_KEY, JSON.stringify(normalizeWorkspaceChatPreferences(value)));
    return true;
  } catch {
    return false;
  }
}

/**
 * 把会话按工作区投影分组；组内顺序沿用传入会话顺序，未归属会话放在最后的其他会话组
 * @param options.workspaces 工作区列表，顺序即展示顺序
 * @param options.sessions 已按首页条件过滤的会话列表，顺序即组内顺序
 * @param options.expanded 各分组已保存的展开状态
 * @param options.limit 默认展示的会话条数
 * @returns 按展示顺序排列的分组投影
 */
export function groupWorkspaceChats({ workspaces, sessions, expanded = {}, limit = WORKSPACE_CHAT_PREVIEW_LIMIT }) {
  const owners = new Map();
  const buckets = new Map();
  for (const workspace of workspaces) {
    const id = workspace.id ?? workspace.workspaceId;
    buckets.set(id, []);
    for (const sessionId of workspace.sessionIds ?? []) if (!owners.has(sessionId)) owners.set(sessionId, id);
  }
  const orphans = [];
  for (const session of sessions) {
    const owner = owners.get(session.id);
    if (owner !== undefined) buckets.get(owner).push(session);
    else orphans.push(session);
  }
  const groups = workspaces.map(workspace => {
    const id = workspace.id ?? workspace.workspaceId;
    return workspaceChatGroup({
      id, title: workspace.title, kind: 'workspace',
      sessions: buckets.get(id), mode: expanded[id], limit,
    });
  });
  if (orphans.length) groups.push(workspaceChatGroup({
    id: WORKSPACE_CHAT_ORPHAN_ID, title: WORKSPACE_CHAT_ORPHAN_TITLE, kind: 'orphan',
    sessions: orphans, mode: expanded[WORKSPACE_CHAT_ORPHAN_ID], limit,
  }));
  return groups;
}

/**
 * 搜索时只保留有命中的分组并全部展开；命中不在默认条数内也可见
 * @param options.workspaces 工作区列表，顺序即展示顺序
 * @param options.sessions 已按搜索条件过滤的会话列表，顺序即组内顺序
 * @param options.limit 默认展示的会话条数
 * @returns 只含有命中会话的分组投影
 */
export function searchWorkspaceChats({ workspaces, sessions, limit = WORKSPACE_CHAT_PREVIEW_LIMIT }) {
  return groupWorkspaceChats({ workspaces, sessions, expanded: {}, limit })
    .filter(group => group.sessions.length > 0)
    .map(group => ({ ...group, mode: 'search', expanded: true, hiddenCount: 0 }));
}

/**
 * 计算当前展开状态实际应展示的会话
 * @param group 分组投影
 * @param limit 默认展示的会话条数
 * @returns 当前应渲染的会话
 */
export function visibleWorkspaceChats(group, limit = WORKSPACE_CHAT_PREVIEW_LIMIT) {
  if (group.mode === 'preview') return group.sessions.slice(0, limit);
  if (group.mode === 'all' || group.mode === 'search') return group.sessions;
  return [];
}

/**
 * 点击工作区行后的展开状态：收起与默认展开之间切换
 * @param mode 当前展开状态
 * @returns 切换后的展开状态
 */
export function toggleWorkspaceChatMode(mode) {
  return normalizeWorkspaceChatMode(mode) === 'collapsed' ? 'preview' : 'collapsed';
}

/**
 * 展开其余会话：把默认展示切换为全部展示
 * @param mode 当前展开状态
 * @returns 全部展示状态
 */
export function expandWorkspaceChatMode(mode) {
  return normalizeWorkspaceChatMode(mode) === 'collapsed' ? 'collapsed' : 'all';
}

/**
 * 收起其余会话：把全部展示切回默认展示
 * @param mode 当前展开状态
 * @returns 默认展示状态
 */
export function collapseWorkspaceChatMode(mode) {
  return normalizeWorkspaceChatMode(mode) === 'all' ? 'preview' : normalizeWorkspaceChatMode(mode);
}

/**
 * 格式化分组会话行的相对时间
 * @param updatedAt 会话更新时间，毫秒时间戳
 * @param now 当前时间，毫秒时间戳
 * @param t 翻译函数
 * @returns 相对时间文案；时间无效时返回 null，由调用方回退到日期
 */
export function formatRelativeChatTime(updatedAt, now, t) {
  const numeric = typeof updatedAt === 'number' ? updatedAt : Number(updatedAt);
  const value = Number.isFinite(numeric) ? numeric : Date.parse(updatedAt);
  const current = Number(now ?? Date.now());
  if (!Number.isFinite(value) || !Number.isFinite(current)) return null;
  const seconds = Math.max(0, Math.floor((current - value) / 1000));
  if (seconds < 10) return t('刚刚');
  if (seconds < 60) return t('{count} 秒', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('{count} 分钟', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('{count} 小时', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('{count} 天', { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('{count} 个月', { count: months });
  return t('{count} 年', { count: Math.max(1, Math.floor(days / 365)) });
}

/**
 * 推进会话状态：运行中的会话记入 active，运行结束且未打开过的会话记入 unread
 * @param previous 当前首页偏好
 * @param sessions 本次观察到的会话运行状态
 * @returns 更新后的偏好；没有变化时返回原对象
 */
export function advanceSessionStatus(previous, sessions) {
  const active = new Set(previous.active ?? []);
  const unread = new Set(previous.unread ?? []);
  const seen = new Set(previous.seen ?? []);
  let changed = false;
  for (const session of sessions) {
    if (session.running === true) {
      if (!active.has(session.id)) {
        active.add(session.id);
        if (unread.delete(session.id)) changed = true;
        if (seen.delete(session.id)) changed = true;
        changed = true;
      }
    } else if (active.has(session.id)) {
      active.delete(session.id);
      if (seen.delete(session.id)) { /* 运行中已经打开过，结束后不再提示。 */ }
      else if (!unread.has(session.id)) unread.add(session.id);
      changed = true;
    }
  }
  return changed ? { ...previous, active: [...active], unread: [...unread], seen: [...seen] } : previous;
}

/**
 * 记录一次会话打开：清除未读提示；运行中的会话不再在完成时提示
 * @param previous 当前首页偏好
 * @param id 会话标识
 * @param running 打开时会话是否仍在运行
 * @returns 更新后的偏好；没有变化时返回原对象
 */
export function openSessionStatus(previous, id, running) {
  const active = new Set(previous.active ?? []);
  const unread = new Set(previous.unread ?? []);
  const seen = new Set(previous.seen ?? []);
  let changed = unread.delete(id);
  if (running === true) {
    if (!active.has(id)) { active.add(id); changed = true; }
    if (!seen.has(id)) { seen.add(id); changed = true; }
  } else if (seen.delete(id)) changed = true;
  return changed ? { ...previous, active: [...active], unread: [...unread], seen: [...seen] } : previous;
}

/**
 * 校验并去重会话标识列表
 * @param value 待校验的列表
 * @returns 只含非空字符串的数组
 */
function normalizeSessionIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id))] : [];
}

/**
 * 校验并归一化单个分组的展开状态
 * @param value 待校验的展开状态
 * @returns collapsed、preview 或 all
 */
function normalizeWorkspaceChatMode(value) {
  return value === 'preview' || value === 'all' ? value : 'collapsed';
}

/**
 * 校验分组标识可作为普通对象键使用
 * @param value 待校验的分组标识
 * @returns 是否为可用标识
 */
function isWorkspaceChatGroupId(value) {
  return typeof value === 'string' && value.length > 0 && value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

/**
 * 生成单个分组的只读投影
 * @param options.id 分组标识
 * @param options.title 分组标题
 * @param options.kind 分组来源
 * @param options.sessions 分组内的全部会话
 * @param options.mode 已保存的展开状态
 * @param options.limit 默认展示的会话条数
 * @returns 分组投影
 */
function workspaceChatGroup({ id, title, kind, sessions, mode, limit }) {
  const normalized = normalizeWorkspaceChatMode(mode);
  return {
    id, title, kind, sessions, total: sessions.length, mode: normalized,
    expanded: normalized !== 'collapsed', hiddenCount: Math.max(0, sessions.length - limit),
  };
}
