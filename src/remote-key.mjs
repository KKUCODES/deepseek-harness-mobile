import { computerKeyViewSchema, computerKeyTargetSchema } from '../../backend/packages/protocol/dist/index.js';

export function computerKeyError(error) {
  return ({ management_required: '请先在电脑端授予此设备管理权限。',
    remote_key_unavailable: '暂时无法读取电脑 Key 状态。',
    remote_key_reference_unsupported: '此电脑凭据不能远程管理，请在电脑上检查 Key 配置。',
    remote_key_stale: '电脑配置已变化或页面已过期，请重新读取 Key 状态。',
    remote_key_read_only: '电脑 Key 来自只读配置，请在电脑上修改。',
    remote_key_busy: '正在处理电脑 Key，请稍候。',
    remote_not_connected: '请先连接电脑。',
    remote_key_write_unconfirmed: 'Key 保存结果尚未确认，请重新连接电脑并核对，不要重复提交。',
    remote_key_upgrade: '请更新电脑远程插件、网关和 App 后管理电脑 Key。',
  })[error?.message] ?? '无法完成电脑 Key 操作，请重新连接并核对。';
}

export class RemoteComputerKey {
  view = null;
  busy = false;
  generation = null;
  constructor(model, target) {
    this.model = model; this.target = target === undefined ? undefined : computerKeyTargetSchema.parse(target);
    if (typeof this.target === 'object') Object.freeze(this.target);
  }
  get supported() { return this.model.transport.capabilities?.[typeof this.target === 'object' ? 'providerKey' : this.target ? 'webSearchSettings' : 'computerKey'] === true; }
  current() {
    if (!this.model.transport.capabilities?.management) throw new Error('management_required');
    if (!this.supported) throw new Error('remote_key_upgrade');
    const generation = this.model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || this.model.connection.state.getSnapshot() !== 'connected' || this.model.lifetime.signal.aborted)
      throw new Error('remote_not_connected');
    return generation;
  }
  async read(signal) { return this.run(false, signal); }
  async configure(signal) { return this.run(true, signal); }
  async run(writing, externalSignal) {
    let request, abort, owned = false;
    const signal = AbortSignal.any([this.model.lifetime.signal, ...(externalSignal ? [externalSignal] : [])]);
    try {
      if (this.busy) throw new Error('remote_key_busy');
      const generation = this.current();
      signal.throwIfAborted();
      if (writing && (!this.view || this.generation !== generation)) throw new Error('remote_key_stale');
      if (writing && !this.view.writable) throw new Error('remote_key_read_only');
      const previous = this.view;
      this.busy = true; owned = true; this.view = null;
      let result;
      if (writing) {
        // 无输入值参数；原生窗口独占密码和 socket 写请求。
        abort = () => { void this.model.client.call('computerKey.cancel').catch(() => {}); };
        signal.addEventListener('abort', abort, { once: true });
        result = await this.model.client.call('computerKey.configure', { snapshot: previous.snapshot, ...(this.target ? { target: this.target } : {}) }, 600000);
      } else {
        request = this.model.client.request({ method: 'remote.keyRead', ...(this.target ? { target: this.target } : {}) });
        abort = () => request.cancel(); signal.addEventListener('abort', abort, { once: true });
        result = await request.promise;
      }
      signal.throwIfAborted();
      if (this.current() !== generation) throw new Error(writing ? 'remote_key_write_unconfirmed' : 'remote_key_stale');
      if (writing) return { cancelled: result?.cancelled === true };
      const parsed = computerKeyViewSchema.safeParse(result);
      const expected = typeof this.target === 'object' ? this.target.provider : this.target ? 'deepseek-search' : 'deepseek-official';
      if (!parsed.success || parsed.data.provider !== expected || parsed.data.target?.provider !== (typeof this.target === 'object' ? this.target.provider : undefined)) throw new Error('remote_key_unavailable');
      this.generation = generation; this.view = parsed.data;
      return this.view;
    } catch (error) { throw new Error(computerKeyError(error)); }
    finally { if (abort) signal.removeEventListener('abort', abort); request?.cancel(); if (owned) this.busy = false; }
  }
}
