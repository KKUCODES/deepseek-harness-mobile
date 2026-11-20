/** 首页工作区会话偏好的本地存储键 */
export const WORKSPACE_CHAT_STORAGE_KEY = 'dshm.remote.home.workspace-chats.v1';
/** 工作区展开后默认展示的会话数量 */
export const WORKSPACE_CHAT_PREVIEW_LIMIT = 5;
/** 未归属工作区会话分组的固定标识 */
export const WORKSPACE_CHAT_ORPHAN_ID = '__orphan_sessions__';
/** 未归属工作区会话分组的标题 */
export const WORKSPACE_CHAT_ORPHAN_TITLE = '其他会话';
/** 草稿会话行标题的最大字符数 */
const DRAFT_TITLE_LIMIT = 40;

/** 首页工作区会话偏好的默认值：开关关闭且全部收起 */
export function defaultWorkspaceChatPreferences() {
  return { enabled: false, expanded: {}, active: [], unread: [] };
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
  const legacyStatus = value !== null && typeof value === 'object' && Object.hasOwn(value, 'seen');
  return {
    enabled: value?.enabled === true,
    expanded,
    // 旧版用 seen 判定完成提示，升级时清空一次跟踪结果，避免保留误报的未读点。
    active: legacyStatus ? [] : normalizeSessionIds(value?.active),
    unread: legacyStatus ? [] : normalizeSessionIds(value?.unread),
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
 * 按最后活动时间倒序排列首页会话；空白会话固定在最前，同一时间按标识升序保证顺序稳定
 * @param sessions 首页会话投影，传入顺序不作要求
 * @returns 排序后的新数组，不修改传入数组
 */
export function orderChatsByActivity(sessions) {
  return [...sessions].sort((left, right) => {
    if (left.blank !== right.blank) return left.blank === true ? -1 : 1;
    return chatActivity(right) - chatActivity(left) || String(left.id).localeCompare(String(right.id));
  });
}

/**
 * 读取会话最后活动时间，缺失或非法值按 0 处理
 * @param session 首页会话投影
 * @returns 毫秒时间戳
 */
function chatActivity(session) {
  const value = typeof session.updatedAt === 'number' ? session.updatedAt : Number(session.updatedAt);
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(session.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 组装首页会话行：过滤归档、工作区和搜索条件，纳入带草稿的空白会话，再按最近活动排序
 * @param options.ids 会话列表的标识顺序
 * @param options.byId 会话摘要，按标识索引
 * @param options.workspaces 工作区投影，用于判定会话归属
 * @param options.archivedSessionIds 已归档会话标识
 * @param options.archived 是否查看已归档会话
 * @param options.workspace 当前筛选的工作区标识；为空表示全部工作区
 * @param options.phrase 搜索词；非空时只保留标题命中或内容命中的会话
 * @param options.snippets 内容搜索命中摘要，按会话标识索引
 * @param options.drafts 草稿文本，按会话标识索引
 * @param options.attachments 草稿附件，按会话标识索引
 * @returns 已排序的会话摘要；带草稿的空白会话排在最前
 */
export function homeChatRows({ ids = [], byId = {}, workspaces = [], archivedSessionIds = [], archived = false,
  workspace = null, phrase = '', snippets = new Map(), drafts = {}, attachments = {} }) {
  const lowered = phrase.toLocaleLowerCase();
  const scope = workspace === null ? undefined : workspaces.find(item => (item.id ?? item.workspaceId) === workspace);
  const rows = [];
  for (const id of ids) {
    const item = byId[id];
    if (item === undefined || (workspace !== null && scope?.sessionIds?.includes(id) !== true)) continue;
    if (item.blank === true) {
      // 空白会话只在草稿有内容时出现；搜索和归档视图不展示未开始的会话。
      if (lowered || archived || archivedSessionIds.includes(id)) continue;
      if (!hasDraftContent(drafts[id], attachments[id])) continue;
    } else if (archivedSessionIds.includes(id) !== archived) continue;
    if (lowered && !String(item.displayTitle ?? '').toLocaleLowerCase().includes(lowered) && !snippets.has(id)) continue;
    rows.push(item);
  }
  return orderChatsByActivity(rows);
}

/**
 * 草稿会话行标题：取草稿首个非空行，没有文字时用第一个附件名
 * @param text 草稿文本
 * @param attachments 草稿附件
 * @param fallback 没有文字也没有附件时的兜底标题
 * @returns 展示用标题
 */
export function draftChatTitle(text, attachments, fallback) {
  const line = String(text ?? '').split('\n').map(part => part.trim()).find(Boolean);
  if (line !== undefined) return line.length > DRAFT_TITLE_LIMIT ? `${line.slice(0, DRAFT_TITLE_LIMIT - 1)}…` : line;
  const name = (attachments ?? []).find(item => typeof item?.name === 'string' && item.name !== '')?.name;
  return name ?? fallback;
}

/**
 * 判断空白会话是否已有草稿内容
 * @param text 草稿文本
 * @param attachments 草稿附件
 * @returns 有文字或附件时为 true
 */
function hasDraftContent(text, attachments) {
  return String(text ?? '').trim() !== '' || (attachments ?? []).length > 0;
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
 * 推进会话状态：运行中的会话记入 active，运行结束时未停留在该会话的记入 unread
 * @param previous 当前首页偏好
 * @param sessions 本次观察到的会话运行状态
 * @param openId 当前正停留的会话标识；为 null 表示首页
 * @returns 更新后的偏好；没有变化时返回原对象
 */
export function advanceSessionStatus(previous, sessions, openId = null) {
  const active = new Set(previous.active ?? []);
  const unread = new Set(previous.unread ?? []);
  let changed = false;
  for (const session of sessions) {
    if (session.running === true) {
      if (!active.has(session.id)) { active.add(session.id); changed = true; }
      if (unread.delete(session.id)) changed = true;
    } else if (active.has(session.id)) {
      active.delete(session.id);
      if (session.id !== openId && !unread.has(session.id)) unread.add(session.id);
      changed = true;
    }
  }
  return changed ? { ...previous, active: [...active], unread: [...unread] } : previous;
}

/**
 * 记录一次会话打开：清除未读提示；运行中的会话保持 active 以便结束时可判断
 * @param previous 当前首页偏好
 * @param id 会话标识
 * @param running 打开时会话是否仍在运行
 * @returns 更新后的偏好；没有变化时返回原对象
 */
export function openSessionStatus(previous, id, running) {
  const active = new Set(previous.active ?? []);
  const unread = new Set(previous.unread ?? []);
  let changed = unread.delete(id);
  if (running === true && !active.has(id)) { active.add(id); changed = true; }
  return changed ? { ...previous, active: [...active], unread: [...unread] } : previous;
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
