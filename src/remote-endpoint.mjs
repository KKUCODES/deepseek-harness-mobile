import { computerEndpointViewSchema, computerEndpointWriteSchema, computerEndpointTargetSchema } from '../../backend/packages/protocol/dist/index.js';

const uncertain = '地址保存结果尚未确认，请重新连接并核对，不要重复提交。';
const refusal = ['management_required', 'remote_endpoint_stale', 'remote_endpoint_read_only', 'remote_endpoint_invalid', 'remote_endpoint_reset_unavailable'];
const message = code => ({ management_required: '请先在电脑端授予此设备管理权限。',
  remote_endpoint_stale: '电脑配置已变化或页面已过期，请重新读取地址。', remote_endpoint_read_only: '电脑设置目前只读。',
  remote_endpoint_invalid: '请输入不含账号、密码、查询参数和片段的 HTTP 或 HTTPS 地址。',
  remote_endpoint_upgrade: '请更新电脑远程插件和网关后管理服务地址。', remote_not_connected: '请先连接电脑。',
  remote_endpoint_busy: '正在处理服务地址，请稍候。',
  remote_endpoint_storage_failed: '无法保存地址核对记录，请检查手机存储后重试。',
  remote_endpoint_reset_unavailable: '当前没有可恢复的默认地址，请填写完整服务地址。',
})[code] ?? '暂时无法读取电脑服务地址，请重新连接后重试。';

export class RemoteComputerEndpoint {
  view = null; generation = null; busy = false; uncertainGeneration = null;
  notice = ''; listeners = new Set();
  getNotice = () => this.notice;
  subscribeNotice = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publishNotice(value) {
    if (this.notice === value) return;
    this.notice = value; for (const listener of this.listeners) listener();
  }
  constructor(model, target) {
    const parsed = target === undefined ? undefined : computerEndpointTargetSchema.parse(target);
    this.model = model; this.target = typeof parsed === 'object' ? Object.freeze(parsed) : parsed;
    if (model.endpointJournal?.recovery(this.target)) this.notice = uncertain;
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
    let request, generation, marker, submitted = false, owned = false;
    const journal = this.model.endpointJournal, recovered = journal?.recovery(this.target);
    const writing = change !== null;
    const signal = AbortSignal.any([this.model.lifetime.signal, ...(externalSignal ? [externalSignal] : [])]);
    const abort = () => request?.cancel();
    try {
      if (this.busy) throw new Error('remote_endpoint_busy');
      generation = this.current(); signal.throwIfAborted();
      if (writing && this.uncertainGeneration === generation) throw new Error('uncertain');
      if (writing && (view !== this.view || !view || this.generation !== generation)) throw new Error('remote_endpoint_stale');
      if (writing && !view.writable) throw new Error('remote_endpoint_read_only');
      if (writing && change.op === 'unset' && view.resettable === false) throw new Error('remote_endpoint_reset_unavailable');
      const target = this.target ? { target: this.target } : {};
      const policy = typeof this.target === 'object' && this.model.transport.capabilities?.providerEndpointResetPolicy === true;
      if (policy) target.resetPolicy = true;
      let operation = { method: 'remote.endpointRead', ...target };
      if (writing) {
        const parsed = computerEndpointWriteSchema.safeParse({ method: 'remote.endpointWrite', ...target, snapshot: view.snapshot, expectedRevision: view.revision, confirmed: true, change });
        if (!parsed.success) throw new Error('remote_endpoint_invalid');
        operation = parsed.data;
      }
      this.busy = true; owned = true; this.view = null;
      if (writing) {
        if (journal) marker = await journal.begin(this.target);
        signal.throwIfAborted();
        if (this.current() !== generation) throw new Error('remote_endpoint_stale');
        submitted = true;
      }
      request = this.model.client.request(operation); signal.addEventListener('abort', abort, { once: true });
      const result = await request.promise; signal.throwIfAborted();
      let current;
      try { current = this.current(); } catch { throw new Error('remote_endpoint_stale_after_reply'); }
      if (current !== generation) throw new Error('remote_endpoint_stale_after_reply');
      const parsed = computerEndpointViewSchema.safeParse(result);
      if (!parsed.success || (policy && typeof parsed.data.resettable !== 'boolean') || (typeof this.target === 'object'
        ? typeof parsed.data.target !== 'object' || parsed.data.target.provider !== this.target.provider
        : parsed.data.target !== this.target)) throw new Error('remote_endpoint_unavailable');
      if (writing) await journal?.settled(marker);
      else if (this.uncertainGeneration !== generation) await journal?.settled(recovered);
      this.view = parsed.data; this.generation = generation;
      if (this.uncertainGeneration !== generation) this.publishNotice('');
      return this.view;
    } catch (error) {
      if (writing && (submitted && !refusal.includes(error?.message) || error?.message === 'uncertain')) {
        // 设置卡可能因断线卸载；结果未知提示属于本次连接服务，不能只留在组件状态中。
        this.uncertainGeneration = generation; journal?.uncertain(marker); this.publishNotice(uncertain); throw new Error(uncertain);
      }
      if (writing && marker) try { await journal?.settled(marker); } catch { journal?.uncertain(marker); }
      throw new Error(message(error?.message));
    } finally { signal.removeEventListener('abort', abort); request?.cancel(); if (owned) this.busy = false; }
  }
}
