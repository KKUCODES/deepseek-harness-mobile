import { computerEndpointViewSchema, computerEndpointWriteSchema, computerEndpointTargetSchema } from '../../backend/packages/protocol/dist/index.js';

const uncertain = '地址保存结果尚未确认，请重新连接并核对，不要重复提交。';
const refusal = ['management_required', 'remote_endpoint_stale', 'remote_endpoint_read_only', 'remote_endpoint_invalid'];
const message = code => ({ management_required: '请先在电脑端授予此设备管理权限。',
  remote_endpoint_stale: '电脑配置已变化或页面已过期，请重新读取地址。', remote_endpoint_read_only: '电脑设置目前只读。',
  remote_endpoint_invalid: '请输入不含账号、密码、查询参数和片段的 HTTP 或 HTTPS 地址。',
  remote_endpoint_upgrade: '请更新电脑远程插件和网关后管理服务地址。', remote_not_connected: '请先连接电脑。',
  remote_endpoint_busy: '正在处理服务地址，请稍候。',
})[code] ?? '暂时无法读取电脑服务地址，请重新连接后重试。';

export class RemoteComputerEndpoint {
  view = null; generation = null; busy = false; uncertainGeneration = null;
  constructor(model, target) {
    const parsed = target === undefined ? undefined : computerEndpointTargetSchema.parse(target);
    this.model = model; this.target = typeof parsed === 'object' ? Object.freeze(parsed) : parsed;
  }
  get supported() { return this.model.transport.capabilities?.[typeof this.target === 'object' ? 'providerEndpoint' : this.target ? 'webSearchSettings' : 'computerEndpoint'] === true; }
  current() {
    if (!this.model.transport.capabilities?.management) throw new Error('management_required');
    if (!this.supported) throw new Error('remote_endpoint_upgrade');
    const generation = this.model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || this.model.connection.state.getSnapshot() !== 'connected' || this.model.lifetime.signal.aborted) throw new Error('remote_not_connected');
    return generation;
  }
  async read(signal) { return this.run(null, null, signal); }
  async save(view, change, signal) { return this.run(view, change, signal); }
  async run(view, change, externalSignal) {
    let request, generation, owned = false;
    const writing = change !== null;
    const signal = AbortSignal.any([this.model.lifetime.signal, ...(externalSignal ? [externalSignal] : [])]);
    const abort = () => request?.cancel();
    try {
      if (this.busy) throw new Error('remote_endpoint_busy');
      generation = this.current(); signal.throwIfAborted();
      if (writing && this.uncertainGeneration === generation) throw new Error('uncertain');
      if (writing && (view !== this.view || !view || this.generation !== generation)) throw new Error('remote_endpoint_stale');
      if (writing && !view.writable) throw new Error('remote_endpoint_read_only');
      const target = this.target ? { target: this.target } : {};
      let operation = { method: 'remote.endpointRead', ...target };
      if (writing) {
        const parsed = computerEndpointWriteSchema.safeParse({ method: 'remote.endpointWrite', ...target, snapshot: view.snapshot, expectedRevision: view.revision, confirmed: true, change });
        if (!parsed.success) throw new Error('remote_endpoint_invalid');
        operation = parsed.data;
      }
      this.busy = true; owned = true; this.view = null;
      request = this.model.client.request(operation); signal.addEventListener('abort', abort, { once: true });
      const result = await request.promise; signal.throwIfAborted();
      let current;
      try { current = this.current(); } catch { throw new Error('remote_endpoint_stale_after_reply'); }
      if (current !== generation) throw new Error('remote_endpoint_stale_after_reply');
      const parsed = computerEndpointViewSchema.safeParse(result);
      if (!parsed.success || (typeof this.target === 'object'
        ? typeof parsed.data.target !== 'object' || parsed.data.target.provider !== this.target.provider
        : parsed.data.target !== this.target)) throw new Error('remote_endpoint_unavailable');
      this.view = parsed.data; this.generation = generation; return this.view;
    } catch (error) {
      if (writing && (owned && !refusal.includes(error?.message) || error?.message === 'uncertain')) {
        this.uncertainGeneration = generation; throw new Error(uncertain);
      }
      throw new Error(message(error?.message));
    } finally { signal.removeEventListener('abort', abort); request?.cancel(); if (owned) this.busy = false; }
  }
}
