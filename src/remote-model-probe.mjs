import { modelProbePrepareSchema, modelProbePreparedSchema, modelProbeExecuteSchema, modelProbeResultSchema } from '../../backend/packages/protocol/dist/index.js';
import { computerSettingsError } from './remote-settings.mjs';

/** 页面不接触临时Key；准备快照和候选严格绑定当前连接。 */
export class RemoteModelProbe {
  busy = false;
  prepared = null;
  constructor(model) { this.model = model; }
  get supported() { return this.model.transport.capabilities?.providerModelProbe === true; }
  generation() {
    if (!this.supported) throw Error('remote_settings_upgrade');
    if (this.model.transport.capabilities?.management !== true) throw Error('management_required');
    const generation = this.model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || this.model.connection.state.getSnapshot() !== 'connected' || this.model.lifetime.signal.aborted) throw Error('remote_not_connected');
    return generation;
  }
  async run(work, signal) {
    if (this.busy) throw Error(computerSettingsError({ message: 'remote_settings_busy' }));
    const fused = AbortSignal.any([this.model.lifetime.signal, ...(signal ? [signal] : [])]);
    try {
      const generation = this.generation(); fused.throwIfAborted(); this.busy = true;
      const value = await work(fused);
      fused.throwIfAborted();
      if (this.generation() !== generation) throw Error('remote_settings_stale');
      return value;
    } catch (error) { this.prepared = null; throw Error(computerSettingsError(error)); }
    finally { this.busy = false; }
  }
  async request(operation, signal) {
    const request = this.model.client.request(operation);
    const abort = () => request.cancel(); signal.addEventListener('abort', abort, { once: true });
    try { return await request.promise; }
    finally { signal.removeEventListener('abort', abort); request.cancel(); }
  }
  async prepare(target, signal) {
    this.prepared = null;
    const operation = modelProbePrepareSchema.parse({ ...target, method: 'remote.modelProbePrepare' });
    if (operation.authentication.mode === 'temporary') throw Error('临时 Key 请在原生窗口中输入。');
    const view = await this.run(async fused => {
      const value = modelProbePreparedSchema.parse(await this.request(operation, fused));
      if (value.baseURL !== operation.baseURL || value.api !== operation.api
        || value.authentication.mode !== operation.authentication.mode
        || value.authentication.provider !== operation.authentication.provider) throw Error('remote_settings_invalid');
      return value;
    }, signal);
    this.prepared = { view, generation: this.generation() };
    return view;
  }
  async execute(view, signal) {
    return this.run(async fused => {
      if (this.prepared?.view !== view || this.prepared.generation !== this.generation() || view.expiresAt <= Date.now()) throw Error('remote_settings_stale');
      this.prepared = null;
      const operation = modelProbeExecuteSchema.parse({ method: 'remote.modelProbeExecute', snapshot: view.snapshot, confirmed: true, mode: view.authentication.mode });
      return modelProbeResultSchema.parse(await this.request(operation, fused));
    }, signal);
  }
  async temporary(target, signal) {
    this.prepared = null;
    const operation = modelProbePrepareSchema.parse({ ...target, method: 'remote.modelProbePrepare', authentication: { mode: 'temporary' } });
    return this.run(async fused => {
      const abort = () => { void this.model.client.call('modelProbe.cancel', {}).catch(() => {}); };
      fused.addEventListener('abort', abort, { once: true });
      try {
        const result = await this.model.client.call('modelProbe.temporary', { baseURL: operation.baseURL, api: operation.api });
        if (result?.cancelled === true && Object.keys(result).length === 1) return { cancelled: true };
        return modelProbeResultSchema.parse(result);
      } finally { fused.removeEventListener('abort', abort); }
    }, signal);
  }
}
