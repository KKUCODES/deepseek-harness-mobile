import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSessionStatus, collapseWorkspaceChatMode, defaultWorkspaceChatPreferences, expandWorkspaceChatMode, formatRelativeChatTime, groupWorkspaceChats,
  normalizeWorkspaceChatPreferences, openSessionStatus, readWorkspaceChatPreferences, searchWorkspaceChats, toggleWorkspaceChatMode,
  visibleWorkspaceChats, WORKSPACE_CHAT_ORPHAN_ID, WORKSPACE_CHAT_PREVIEW_LIMIT, WORKSPACE_CHAT_STORAGE_KEY,
  writeWorkspaceChatPreferences,
} from '../src/remote-home-workspaces.mjs';

const workspaces = [
  { id: 'work', title: '周报', sessionIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
  { id: 'empty', title: '读书笔记', sessionIds: [] },
  { id: 'site', title: '个人网站', sessionIds: ['h'] },
];
const sessions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'orphan'].map(id => ({ id, title: id }));

test('偏好默认关闭且全部收起，非法存储内容回退默认值', () => {
  assert.deepEqual(defaultWorkspaceChatPreferences(), { enabled: false, expanded: {}, active: [], unread: [], seen: [] });
  assert.deepEqual(normalizeWorkspaceChatPreferences(undefined), { enabled: false, expanded: {}, active: [], unread: [], seen: [] });
  assert.deepEqual(normalizeWorkspaceChatPreferences({ enabled: 'yes', expanded: [] }), { enabled: false, expanded: {}, active: [], unread: [], seen: [] });
  assert.deepEqual(normalizeWorkspaceChatPreferences({ enabled: true, expanded: { work: 'all', empty: 'collapsed', site: 'preview', bad: 1 },
    active: ['a', 'a', '', 2], unread: ['b'], seen: ['c'] }),
  { enabled: true, expanded: { work: 'all', site: 'preview' }, active: ['a'], unread: ['b'], seen: ['c'] });
});

test('偏好读写使用固定键并在损坏时返回默认值', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readWorkspaceChatPreferences(storage).enabled, false);
  assert.equal(writeWorkspaceChatPreferences(storage, { enabled: true, expanded: { work: 'all' }, active: ['a'], unread: ['b'], seen: [] }), true);
  assert.deepEqual(JSON.parse(values.get(WORKSPACE_CHAT_STORAGE_KEY)), { enabled: true, expanded: { work: 'all' }, active: ['a'], unread: ['b'], seen: [] });
  assert.deepEqual(readWorkspaceChatPreferences(storage), { enabled: true, expanded: { work: 'all' }, active: ['a'], unread: ['b'], seen: [] });
  values.set(WORKSPACE_CHAT_STORAGE_KEY, '{bad json');
  assert.deepEqual(readWorkspaceChatPreferences(storage), { enabled: false, expanded: {}, active: [], unread: [], seen: [] });
  assert.equal(writeWorkspaceChatPreferences({ setItem() { throw Error('quota'); } }, { enabled: true, expanded: {}, active: [], unread: [], seen: [] }), false);
});

test('按工作区顺序分组，组内保持会话顺序，未归属会话放在最后的其他会话组', () => {
  const groups = groupWorkspaceChats({ workspaces, sessions });
  assert.deepEqual(groups.map(group => group.id), ['work', 'empty', 'site', WORKSPACE_CHAT_ORPHAN_ID]);
  assert.deepEqual(groups[0].sessions.map(item => item.id), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(groups[1].total, 0);
  assert.deepEqual(groups[2].sessions.map(item => item.id), ['h']);
  assert.deepEqual(groups[3].sessions.map(item => item.id), ['orphan']);
  assert.equal(groups[3].title, '其他会话');
  assert.equal(groups[3].kind, 'orphan');
});

test('默认收起不展示会话，展开默认只展示 5 条并给出其余数量', () => {
  const groups = groupWorkspaceChats({ workspaces, sessions, expanded: { work: 'preview', site: 'all' } });
  const work = groups[0], site = groups[2];
  assert.equal(work.mode, 'preview');
  assert.equal(work.hiddenCount, 2);
  assert.deepEqual(visibleWorkspaceChats(work).map(item => item.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(visibleWorkspaceChats(work).length, WORKSPACE_CHAT_PREVIEW_LIMIT);
  assert.equal(site.mode, 'all');
  assert.deepEqual(visibleWorkspaceChats(site).map(item => item.id), ['h']);
  assert.deepEqual(visibleWorkspaceChats(groups[1]), []);
});

test('也接受电脑原始工作区投影的 workspaceId 字段', () => {
  const groups = groupWorkspaceChats({ workspaces: [{ workspaceId: 'work', title: '周报', sessionIds: ['a'] }], sessions: [{ id: 'a' }] });
  assert.equal(groups[0].id, 'work');
  assert.equal(groups[0].title, '周报');
  assert.deepEqual(groups[0].sessions.map(item => item.id), ['a']);
});

test('搜索只保留有命中的工作区并全部展示，命中不在默认 5 条内也可见', () => {
  const matched = [sessions[5], sessions[6], sessions[8]];
  const groups = searchWorkspaceChats({ workspaces, sessions: matched });
  assert.deepEqual(groups.map(group => group.id), ['work', WORKSPACE_CHAT_ORPHAN_ID]);
  assert.equal(groups[0].mode, 'search');
  assert.equal(groups[0].expanded, true);
  assert.equal(groups[0].hiddenCount, 0);
  assert.deepEqual(visibleWorkspaceChats(groups[0]).map(item => item.id), ['f', 'g']);
  assert.deepEqual(visibleWorkspaceChats(groups[1]).map(item => item.id), ['orphan']);
  assert.deepEqual(searchWorkspaceChats({ workspaces, sessions: [] }), []);
});

test('相对时间按刚刚、秒、分钟、小时、天、月、年分档', () => {
  const t = (text, values = {}) => text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  const now = Date.UTC(2026, 10, 19, 12, 0, 0);
  const at = seconds => now - seconds * 1000;
  assert.equal(formatRelativeChatTime(at(5), now, t), '刚刚');
  assert.equal(formatRelativeChatTime(at(10), now, t), '10 秒');
  assert.equal(formatRelativeChatTime(at(59), now, t), '59 秒');
  assert.equal(formatRelativeChatTime(at(60), now, t), '1 分钟');
  assert.equal(formatRelativeChatTime(at(60 * 60), now, t), '1 小时');
  assert.equal(formatRelativeChatTime(at(24 * 60 * 60), now, t), '1 天');
  assert.equal(formatRelativeChatTime(at(30 * 24 * 60 * 60), now, t), '1 个月');
  assert.equal(formatRelativeChatTime(at(360 * 24 * 60 * 60), now, t), '1 年');
  assert.equal(formatRelativeChatTime(at(730 * 24 * 60 * 60), now, t), '2 年');
  assert.equal(formatRelativeChatTime(now + 5000, now, t), '刚刚');
  assert.equal(formatRelativeChatTime(new Date(at(60)).toISOString(), now, t), '1 分钟');
  assert.equal(formatRelativeChatTime(undefined, now, t), null);
});

test('完成提示只覆盖运行结束且未打开过的会话', () => {
  const initial = defaultWorkspaceChatPreferences();
  let state = advanceSessionStatus(initial, [{ id: 'a', running: true }]);
  assert.deepEqual(state.active, ['a']);
  assert.deepEqual(state.unread, []);
  state = advanceSessionStatus(state, [{ id: 'a', running: false }]);
  assert.deepEqual(state.active, []);
  assert.deepEqual(state.unread, ['a']);
  state = openSessionStatus(state, 'a', false);
  assert.deepEqual(state.unread, []);

  let opened = advanceSessionStatus(initial, [{ id: 'b', running: true }]);
  opened = openSessionStatus(opened, 'b', true);
  assert.deepEqual(opened.seen, ['b']);
  opened = advanceSessionStatus(opened, [{ id: 'b', running: false }]);
  assert.deepEqual(opened.unread, []);
  assert.deepEqual(opened.seen, []);

  let again = advanceSessionStatus(opened, [{ id: 'b', running: true }]);
  assert.deepEqual(again.seen, []);
  again = advanceSessionStatus(again, [{ id: 'b', running: false }]);
  assert.deepEqual(again.unread, ['b']);
});

test('展开状态在收起、默认展示和全部展示之间切换', () => {
  assert.equal(toggleWorkspaceChatMode('collapsed'), 'preview');
  assert.equal(toggleWorkspaceChatMode('preview'), 'collapsed');
  assert.equal(toggleWorkspaceChatMode('all'), 'collapsed');
  assert.equal(expandWorkspaceChatMode('preview'), 'all');
  assert.equal(collapseWorkspaceChatMode('all'), 'preview');
  assert.equal(collapseWorkspaceChatMode('preview'), 'preview');
});
