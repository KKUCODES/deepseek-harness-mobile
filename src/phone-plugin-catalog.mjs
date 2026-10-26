export const MOBILE_INTERFACE_API = 1;
export const REMOTE_HOME_SLOT = 'dshm.remote.home';

/** 随App提供的受控目录；宿主与配置能力由条目声明，不由管理页面判断包名。 */
export const PHONE_PLUGIN_CATALOG = [
  { id: 'input', name: '输入提示词', version: '0.1.6-alpha.2', host: 'ordinary', settings: 'prompts',
    description: '在消息中输入 /，选择本地总结或翻译提示词。', source: '@deepseek-ai/dsh-client-ui-input-trigger', capabilities: '输入菜单、纯文本插入' },
  { id: 'theme', name: '外观主题', version: '0.1.6-alpha.2', host: 'ordinary', settings: 'appearance',
    description: '调整手机上的浅色、深色主题与阅读字号。', source: '@deepseek-ai/dsh-client-ui-theme', capabilities: '主题、字号、本地偏好' },
  { id: 'rendering', name: '聊天排版', version: '0.1.0', host: 'ordinary',
    description: '使用 DSH 的 Markdown、代码高亮和公式排版显示回复。', source: '@dsh-mobile/ordinary-rendering', capabilities: '回复内容渲染' },
];

export const pluginDescriptor = entry => ({ id: entry.id, host: entry.host, group: entry.group ?? null, version: entry.version });
export const defaultPluginRecord = entry => ({ ...pluginDescriptor(entry), installed: true, enabled: true, revision: 0, configured: false });

export function pluginStatus(record, runtime) {
  if (!record) return '未安装';
  if (runtime?.revision === record.revision) {
    if (runtime.status === 'failed') return record.enabled ? '加载失败' : record.installed ? '停止失败' : '卸载失败';
    if (runtime.status === 'stopping') return '正在停止…';
  }
  if (!record.installed) return '未安装';
  if (!record.configured) return '等待同步';
  if (!record.enabled) return '已停用';
  if (!runtime || runtime.revision !== record.revision || runtime.status === 'inactive') return '待加载';
  return { active: '运行中', loading: '正在加载…', stopping: '正在停止…', failed: '加载失败' }[runtime.status] ?? '待加载';
}
