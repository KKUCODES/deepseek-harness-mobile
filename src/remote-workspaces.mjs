const endpoints = { rename: 'workspace/rename', remove: 'workspace/delete', move: 'workspace/insertBefore' };
const uncertainMessage = '操作结果尚未确认，请重新连接并核对工作区后再操作。';

/** 只管理电脑已登记的工作区，沿用原 ClientWorkspaceModel 的投影与排序协调。 */
export class RemoteWorkspaceActions {
  busy = false;
  uncertainGeneration = null;
  constructor(model) { this.model = model; }
  get supported() { return this.model.transport.capabilities?.workspaceManagement === true; }
  get permitted() { return this.supported && this.model.transport.capabilities?.management === true; }
  async change(kind, original, value) {
    const model = this.model, capabilities = model.transport.capabilities;
    const generation = model.connection.generation.getSnapshot()?.id;
    if (!this.permitted || !capabilities.endpoints.calls.includes(endpoints[kind])) throw new Error('请先在电脑端授予此设备管理权限。');
    if (generation === undefined || model.connection.state.getSnapshot() !== 'connected' || model.lifetime.signal.aborted) throw new Error('请先连接电脑。');
    if (this.uncertainGeneration === generation) throw new Error(uncertainMessage);
    if (this.busy) throw new Error('正在更新工作区，请稍候。');
    const items = model.workspaces.getSnapshot().items;
    const current = items.find(item => item.workspaceId === original.workspaceId);
    if (!current || current.title !== original.title || current.updatedAt !== original.updatedAt) throw new Error('工作区已变化，请重新选择后操作。');
    if (kind === 'rename' && (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\x00-\x1f\x7f]/u.test(value))) throw new Error('请输入有效的工作区名称，最多200个字符。');
    if (kind === 'remove' && value !== true) throw new Error('请先确认移除工作区注册。');
    if (kind === 'move' && value !== undefined && (value === current.workspaceId || !items.some(item => item.workspaceId === value))) throw new Error('工作区排序已变化，请重新选择位置。');
    this.busy = true;
    try {
      let result;
      try {
        result = await (kind === 'rename' ? model.workspaces.rename(current.workspaceId, value.trim())
          : kind === 'remove' ? model.workspaces.delete(current.workspaceId) : model.workspaces.insertBefore(current.workspaceId, value));
      } catch {
        this.uncertainGeneration = generation;
        throw new Error(uncertainMessage);
      }
      if (!result.ok) {
        if (result.error.code === 'workspace/name-conflict') throw new Error('已有同名工作区，请换一个名称。');
        if (result.error.code === 'workspace/not-found') throw new Error('该工作区已在电脑移除，请返回列表。');
        if (result.error.code === 'gateway/bad-request') throw new Error('电脑无法接受此操作，请检查输入后重试。');
        this.uncertainGeneration = generation;
        throw new Error(uncertainMessage);
      }
      if (model.connection.generation.getSnapshot()?.id !== generation) throw new Error(uncertainMessage);
      return result.value;
    } finally { this.busy = false; }
  }
}
