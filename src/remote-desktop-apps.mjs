/** 工作区由电脑按会话解析，手机只传选择器和一次性确认，不发送目录或命令。 */
export async function desktopAppsRequest(model, sessionId, action, value, caller) {
  const generation = model.transport.generation;
  const signal = AbortSignal.any([caller, model.lifetime.signal, model.transport.lifetime.signal]);
  const check = () => {
    signal.throwIfAborted();
    if (model.getSnapshot().connectionState !== 'connected' || model.transport.generation !== generation) throw new Error('remote_not_connected');
    if (!sessionId || model.getSnapshot().selected !== sessionId) throw new Error('remote_desktop_stale');
    if (model.transport.capabilities?.desktopApps !== true) throw new Error('remote_desktop_unavailable');
    if (action === 'icon' && model.transport.capabilities?.desktopAppIcons !== true) throw new Error('remote_desktop_unavailable');
  };
  check();
  if (!['list', 'prepare', 'open', 'icon'].includes(action)) throw new Error('remote_desktop_invalid');
  if (['prepare', 'icon'].includes(action) && (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(value))) throw new Error('remote_desktop_invalid');
  if (action === 'open' && (value?.sessionId !== sessionId || value?.generation !== generation
    || typeof value?.snapshot !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.snapshot))) throw new Error('remote_desktop_stale');
  const operation = action === 'list' ? { method: 'remote.desktopApps', sessionId }
    : action === 'icon' ? { method: 'remote.desktopAppIcon', sessionId, appId: value }
    : action === 'prepare' ? { method: 'remote.prepareDesktopApp', sessionId, appId: value }
      : { method: 'remote.openDesktopApp', sessionId, snapshot: value.snapshot, confirmed: true };
  const request = model.client.request(operation), abort = () => request.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await request.promise; check();
    if (action === 'icon') {
      if (result?.appId !== value) throw new Error('remote_desktop_icon_invalid');
      if (result.contentType === null && result.data === null) return null;
      if (!['image/png', 'image/svg+xml'].includes(result.contentType) || typeof result.data !== 'string'
        || !result.data.length || result.data.length > 349528 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.data)
        || atob(result.data).length > 256 * 1024 || btoa(atob(result.data)) !== result.data) throw new Error('remote_desktop_icon_invalid');
      // 只交给img解码；不把SVG放入聊天DOM，也不执行返回的链接或脚本。
      return `data:${result.contentType};base64,${result.data}`;
    }
    if (action === 'open') {
      if (result?.opened !== true) throw new Error('remote_desktop_invalid');
      return result;
    }
    if (typeof result?.name !== 'string' || !result.name || result.available !== true
      || typeof result.workspacePath !== 'string' || !result.workspacePath || result.workspacePath.length > 4096) throw new Error('remote_desktop_invalid');
    if (action === 'list' ? !Array.isArray(result.apps) || result.apps.length > 128
      || result.apps.some(app => typeof app !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(app))
      : result.appId !== value || typeof result.snapshot !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.snapshot)) throw new Error('remote_desktop_invalid');
    return { ...result, sessionId, generation };
  } finally { signal.removeEventListener('abort', abort); }
}

export function desktopAppsError(error, opening) {
  if (error.message === 'remote_desktop_workspace_missing') return '工作区已不可用，请在电脑上检查目录和会话。';
  if (error.message === 'remote_desktop_workspace_changed') return '工作区已变化，请重新选择应用并核对。';
  if (error.message === 'remote_desktop_app_missing') return '电脑上已找不到这个应用，请重新选择。';
  if (error.message === 'remote_desktop_stale') return '当前聊天或确认信息已变化，请重新选择应用。';
  if (error.message === 'remote_desktop_unavailable') return '请更新电脑远程插件及兼容补丁，并确认电脑桌面可用。';
  return opening ? '打开结果尚未确认，请先在电脑上核对。' : '无法读取电脑应用，请检查连接后重试。';
}
