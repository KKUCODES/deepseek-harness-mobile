export const FILES_PANEL_ID = '@deepseek-ai/dsh-client-ui-sidebar-files';

// 原内置面板共享手机视口，正文自行滚动；第三方同槽替换仍由通用插件框架处理。
const layouts = new Map([
  ['@deepseek-ai/dsh-client-ui-sidebar-right/guide', { fill: true }],
  ['@deepseek-ai/dsh-client-ui-sidebar-documentpreview', { fill: true }],
  ['@deepseek-ai/dsh-client-ui-deliverables', { fill: true }],
  [FILES_PANEL_ID, { fill: true, nativeOwner: FILES_PANEL_ID, view: 'files' }],
  ['@deepseek-ai/dsh-client-ui-plan', { fill: true, nativeOwner: '@deepseek-ai/dsh-client-ui-plan', view: 'plan' }],
  ['@deepseek-ai/dsh-client-ui-schedule/task', { fill: true, nativeOwner: '@deepseek-ai/dsh-client-ui-schedule', view: 'task' }],
]);
const mainLayouts = new Map([
  ['schedules', { nativeOwner: '@deepseek-ai/dsh-client-ui-schedule', view: 'schedules' }],
  ['plugins', { nativeOwner: '@deepseek-ai/dsh-client-ui-plugin-manager', view: 'plugins' }],
]);

export const mainPanelFillsViewport = id => mainLayouts.has(id);

export function panelFillsViewport(typeId, kind) {
  return layouts.get(typeId)?.fill === true || kind === 'subagentchat';
}

/** 下发的官方组件没有本地函数身份；同时核对槽、条目和注册域，不能按同槽放开第三方。 */
export function nativePanelSlot(ctx, options) {
  const layout = options.name === 'sidebar.right.pane.tab' ? layouts.get(options.key)
    : options.name === 'main' ? mainLayouts.get(options.key)
      : settingsLayout(options);
  if (!layout?.nativeOwner) return undefined;
  for (let fiber = ctx.fiber; fiber;) {
    if ((fiber.entry?.options.name ?? fiber.name) === layout.nativeOwner) return layout.view;
    const parent = fiber.parent?.fiber;
    if (parent === fiber) break;
    fiber = parent;
  }
  return undefined;
}

function settingsLayout(options) {
  const sections = { general: 'settings-general', 'agent-presets': 'agent-preset' };
  if (options.name === 'settings.section' && sections[options.id]) return {
    nativeOwner: `@deepseek-ai/dsh-client-ui-${sections[options.id]}`, view: 'settings',
  };
  if (options.name === 'settings.general.item') {
    const owners = { 'developer-tools': 'settings-general', 'current-version': 'settings-general', appearance: 'theme', shortcuts: 'shortcuts',
      permission: 'permission-presets', 'composer-enter': 'conversation', 'link-opening': 'chat', 'performance-usage': 'chat', 'transcript-view': 'chat' };
    if (owners[options.id]) return { nativeOwner: `@deepseek-ai/dsh-client-ui-${owners[options.id]}`, view: 'settings-row' };
  }
}
