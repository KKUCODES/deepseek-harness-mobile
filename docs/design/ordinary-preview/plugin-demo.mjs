// 仅用于设计预览的虚构目录；兼容标记不代表真实插件经过核验。
export const pluginCatalog = [
  { id: 'prompts', name: '快捷提示词', package: '@demo/quick-prompts', version: '1.0.0', latest: '1.1.0', description: '把常用表达收进输入框，随时插入和修改。', targets: ['phone', 'computer'], capability: '读取和修改当前输入草稿；保存本插件设置。', component: '提示词菜单', setting: '默认提示词', initial: '请帮我整理要点' },
  { id: 'reading', name: '阅读样式', package: '@demo/reading-style', version: '1.0.0', latest: '1.0.0', description: '调整回复的阅读间距，让长文更容易阅读。', targets: ['phone', 'computer'], capability: '调整聊天正文样式；保存本插件设置。', component: '正文样式', setting: '段落间距', initial: '标准', options: ['紧凑', '标准', '宽松'] },
  { id: 'outline', name: '长文目录', package: '@demo/message-outline', version: '1.0.0', latest: '1.0.0', description: '按回复标题生成目录，快速跳到想看的部分。', targets: ['phone', 'computer'], capability: '读取当前聊天的回复正文；不声明网络访问。', component: '回复目录', setting: '目录标题', initial: '本条回复' },
  { id: 'workspace', name: '工作区工具', package: '@demo/workspace-tools', version: '1.0.0', latest: '1.0.0', description: '为电脑工作区提供文件操作入口。', targets: ['computer'], capability: '在电脑读取工作区文件和调用 Host 服务。', component: '工作区入口', setting: '入口名称', initial: '工作区文件' },
  { id: 'legacy', name: '旧版扩展', package: '@demo/legacy-extension', version: '0.8.0', latest: '0.8.0', description: '提供旧版 DSH 的扩展功能。', targets: ['computer'], incompatible: true, capability: '需要旧版 DSH 扩展接口。', component: '旧版入口' },
  { id: 'dependency', name: '代码索引', package: '@demo/code-index', version: '1.0.0', latest: '1.0.0', description: '索引工作区代码，方便查找与定位。', targets: ['computer'], missing: true, capability: '需要电脑上的索引服务。', component: '代码索引' },
];
export const targetNames = { phone: '手机', computer: '电脑' };
const installed = (id, enabled = true) => {
  const item = pluginCatalog.find(plugin => plugin.id === id);
  return { version: item.version, enabled, setting: item.initial || '' };
};
export function createPluginDemo() {
  return { phone: { prompts: installed('prompts'), reading: installed('reading', false) }, computer: { prompts: installed('prompts'), workspace: installed('workspace'), dependency: installed('dependency', false) }, online: true, permission: false, pending: null, result: null };
}
export function pluginBlock(state, target, item, action) {
  if (target === 'computer' && !state.online) return '电脑离线，恢复连接后才能操作。';
  if (target === 'computer' && !state.permission) return '尚未获得电脑插件管理权限，请在电脑端授权。';
  if (['uninstall', 'disable'].includes(action)) return '';
  if (!item.targets.includes(target)) return '不适用本模式：此插件需要电脑能力。';
  if (item.incompatible) return '版本不兼容：请等待适配当前 DSH 的版本。';
  if (item.missing) return '缺少电脑依赖：请先在电脑配置索引服务。';
  return '';
}
export function pluginState(state, event) {
  if (event.type === 'environment') {
    const next = { ...state, ...event.change };
    // 连接/授权变化使在途结果失效；不重放管理操作，也不乐观显示成功。
    if (state.pending?.target === 'computer' && (!next.online || !next.permission)) return { ...next, pending: null, result: { target: 'computer', error: true, text: '连接或权限已变化，操作结果未确认。重新读取状态后再操作。' } };
    return next;
  }
  if (event.type === 'clear-result') return { ...state, result: null };
  if (event.type === 'empty') return state.pending ? state : { ...state, [event.target]: {}, result: null };
  if (event.type === 'begin') {
    if (state.pending) return state;
    const item = pluginCatalog.find(plugin => plugin.id === event.id);
    if (!item) return state;
    const reason = pluginBlock(state, event.target, item, event.action);
    if (reason) return { ...state, result: { target: event.target, error: true, text: reason } };
    return { ...state, pending: event, result: null };
  }
  if (event.type !== 'finish' || !state.pending || state.pending.token !== event.token) return state;
  const pending = state.pending;
  const item = pluginCatalog.find(plugin => plugin.id === pending.id);
  const reason = pluginBlock(state, pending.target, item, pending.action);
  if (reason || pending.fail) return { ...state, pending: null, result: { target: pending.target, error: true, text: reason || '操作未完成，原版本和设置已保留。请重试。' } };
  const entries = { ...state[pending.target] };
  const previous = entries[item.id];
  if (pending.action === 'uninstall') delete entries[item.id];
  else if (pending.action === 'install') entries[item.id] = { ...installed(item.id), version: item.latest };
  else if (previous) entries[item.id] = { ...previous, ...(pending.action === 'update' ? { version: item.latest } : pending.action === 'save' ? { setting: pending.value.trim() } : { enabled: pending.action === 'enable' }) };
  const verb = { install: '安装', uninstall: '卸载', update: '更新', save: '保存设置', enable: '启用', disable: '停用' }[pending.action];
  return { ...state, [pending.target]: entries, pending: null, result: { target: pending.target, error: false, text: `已${verb}${item.name}（${targetNames[pending.target]}）。` } };
}
