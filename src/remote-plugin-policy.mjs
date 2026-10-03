// 这些入口的组合职责已由手机承担。保留模块表供依赖解析，但不再执行桌面 apply。
// 其余插件仍按真实服务依赖启动；缺失服务显示等待，不伪造 Host 能力。
export const mobileComposition = new Set([
  '@deepseek-ai/dsh-client-web', '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-hmr',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-typert-registry',
  '@deepseek-ai/dsh-client-ui-approval', '@deepseek-ai/dsh-client-ui-user-questions',
  '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-api-workspace-controller',
  '@deepseek-ai/dsh-client-ui-renderer', '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-session', '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-chat',
  // 子会话菜单与旁栏已有手机组合，避免 uiWorkspace 就绪后重复注册桌面呈现。
  '@deepseek-ai/dsh-client-ui-subagent',
  // 原投影和卡片由手机组合，成员导航交给自己的子会话入口。
  '@deepseek-ai/dsh-client-ui-workflow-run',
  // 原服务由手机派生，补充插件本地 action 的菜单入口；原命令执行策略不变。
  '@deepseek-ai/dsh-client-ui-commands',
  '@deepseek-ai/dsh-client-ui-sidebar-right',
  // 手机提供原全局导航接口和页面入口，不挂载带新聊天按钮的桌面侧栏。
  '@deepseek-ai/dsh-client-ui-sidebar',
  // 原配置卡片与分页由手机组合，敏感字段继续走限定管理接口。
  '@deepseek-ai/dsh-client-ui-settings-plugins',
  // 模型页、引导和扩展插槽由手机组合，Key保持原生；不得再执行重复注册的桌面apply。
  '@deepseek-ai/dsh-client-ui-settings-models',
  // 手机保留原文档注册表、标签与预览组件，读取/隔离网页由授权通道组合。
  '@deepseek-ai/dsh-client-ui-sidebar-documentpreview',
]);

// 原入口直接 fetch 桌面 HTTP 路由；在独立授权通道接入前不启动其请求。
// 与已由手机提供的组合区分，不能将尚未实现的 R16 标为可用。
const pendingAdapters = new Map([
  ['@deepseek-ai/dsh-client-ui-open-in-app', '当前连接暂不支持在电脑应用中打开。'],
  ['@deepseek-ai/dsh-client-ui-sidebar-browser', '当前版本暂不支持远程预览电脑网页。'],
  ['@deepseek-ai/dsh-client-ui-deliverables', '交付文件请通过聊天中的文件入口查看。'],
]);

// 手机只查看命令结果；整个交互终端入口（创建、恢复、输入和关闭进程）均不启动。
// 保留模块供其他插件解析依赖，不影响聊天中的命令记录组件。
const excludedInterfaces = new Map([
  ['@deepseek-ai/dsh-client-ui-sidebar-terminal', '手机仅支持查看命令结果，不提供交互终端。'],
]);

export function supportsDeliverables(capabilities) {
  return !!(capabilities?.desktopOpen && capabilities.desktopReveal
    && capabilities.channels?.includes('changes')
    && capabilities.endpoints?.calls?.includes('workspaceFiles/read'));
}

function composed(id, capabilities) {
  return mobileComposition.has(id) || id === '@deepseek-ai/dsh-client-ui-deliverables' && supportsDeliverables(capabilities)
    || id === '@deepseek-ai/dsh-client-ui-open-in-app' && capabilities?.desktopApps === true;
}

// 已核验的原插件入口会直接使用这些接口。服务存在不代表这台设备获准调用。
// 基于电脑本次协商的允许名单选择 apply；保留模块图，后续开放接口后可正常启动。
// 面板依赖 runner 的运行/审批链路；只允许读取目录不能代表动态插件可用。
const cordisCalls = [
  'getClientCode', 'inventory', 'invoke', 'reportClientGuardFailure', 'reportRenderFailure',
  'resolveInspectQuery', 'resolveRequestRun', 'runHostHalf', 'settleUserRun',
  'stopFromPanel', 'syncInspectManifest', 'undefineFromPanel',
].map(method => `dynamicCordisRunner/${method}`);
const requiredCalls = new Map([
  ['@deepseek-ai/dsh-api-workspace-files', ['workspaceFiles/stat']],
  ['@deepseek-ai/dsh-client-ui-skill', ['skills/list']],
  ['@deepseek-ai/dsh-client-ui-reference', ['fileReferences/list', 'sessionReferenceResolver/candidates']],
  ['@deepseek-ai/dsh-client-ui-sidebar-files', ['workspaceFiles/list']],
  ['@deepseek-ai/dsh-cordis-client-runner', cordisCalls],
  ['@deepseek-ai/dsh-client-ui-cordis', cordisCalls],
  ['@deepseek-ai/dsh-client-ui-message-feedback', ['messageFeedback/list', 'messageFeedback/put', 'messageFeedback/delete', 'sessionFeedback/record']],
  ['@deepseek-ai/dsh-client-ui-goal', ['goals/get', 'goals/edit', 'goals/pause', 'goals/resume', 'goals/clear']],
  ['@deepseek-ai/dsh-client-ui-agent-preset', ['agentPresets/list', 'agentPresets/select']],
  ['@deepseek-ai/dsh-client-ui-plugin-manager', ['pluginInventory/list', 'pluginManager/listPlugins', 'pluginManager/installBundle']],
  ['@deepseek-ai/dsh-client-ui-settings-plugin-inventory', ['pluginInventory/list']],
]);

const requiredStreams = new Map([
  ['@deepseek-ai/dsh-api-workspace-files', ['workspaceFiles/changes']],
]);

function unavailable(id, capabilities) {
  if (excludedInterfaces.has(id)) return excludedInterfaces.get(id);
  if (pendingAdapters.has(id)) return pendingAdapters.get(id);
  const required = requiredCalls.get(id);
  if (capabilities?.management === false && required?.some(endpoint => !capabilities?.endpoints?.calls?.includes(endpoint))
    && ['@deepseek-ai/dsh-client-ui-plugin-manager', '@deepseek-ai/dsh-client-ui-settings-plugin-inventory'].includes(id))
    return '这台手机尚未获得电脑管理权限，请在电脑端授权后使用。';
  if (required?.some(endpoint => !capabilities?.endpoints?.calls?.includes(endpoint))) return '电脑当前未开放这个插件所需的远程接口。';
  if (requiredStreams.get(id)?.some(endpoint => !capabilities?.endpoints?.streams?.includes(endpoint))) return '电脑当前未开放这个插件所需的远程接口。';
}

export function activationManifest(manifest, capabilities) {
  return { ...manifest, plugins: manifest.plugins.filter(row => !composed(row.id, capabilities) && !unavailable(row.id, capabilities)) };
}

export function pluginEntries(manifest, loader, capabilities) {
  const entries = new Map([...loader.entries()].map(entry => [entry.options.name, entry]));
  return manifest.plugins.map(({ id }) => {
    if (composed(id, capabilities)) return { id, state: 'mobile' };
    const reason = unavailable(id, capabilities);
    if (reason) return { id, state: 'waiting', reason };
    const entry = entries.get(id), fiber = entry?.fiber;
    if (fiber?.state === 2) return { id, state: 'active' };
    if (fiber?.state === 0) return { id, state: 'waiting', missing: Object.keys(fiber.inject).filter(service => entry.ctx.get(service) === undefined) };
    return { id, state: 'failed' };
  });
}
