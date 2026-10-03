import { computerSettingsViewSchema, computerSettingsWriteSchema, pluginSettingsViewSchema, pluginSettingsNamespaceSchema,
  providerDirectorySchema, providerSettingsViewSchema, providerSettingsWriteSchema, providerRouteSchema, providerKeySetupSchema,
  providerModelsViewSchema, providerModelsWriteSchema, providerModelsDiscoveryViewSchema, deepSeekModelsWriteSchema,
  providerRemovalViewSchema, providerRemovalWriteSchema,
  providerCreationViewSchema, providerCreationWriteSchema } from '../../backend/packages/protocol/dist/index.js';
import { RemoteComputerEndpoint } from './remote-endpoint.mjs';
import { RemoteComputerKey } from './remote-key.mjs';

const uncertain = '保存结果尚未确认，请重新连接电脑并重新读取设置后核对。';
export function computerSettingsError(error) {
  return ({ management_required: '请先在电脑端授予此设备管理权限。',
    remote_settings_unavailable: '电脑尚未提供这些设置，请确认对应插件已启用。',
    remote_settings_read_only: '电脑设置目前只读。',
    remote_settings_stale: '电脑设置已变化或页面已过期，请重新读取后再修改。',
    remote_settings_invalid: '设置值无效，请检查后重新读取。',
    remote_settings_upgrade: '请更新电脑远程插件和网关后使用电脑设置。',
    remote_not_connected: '请先连接电脑。',
    remote_settings_busy: '正在处理设置，请稍候。',
    remote_provider_inherited: '此提供方来自电脑基础配置，不能在这里移除。',
    remote_model_discovery_failed: '无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。',
  })[error?.message] ?? '暂时无法读取电脑设置，请重新连接后重试。';
}

export class RemoteComputerSettings {
  busy = false;
  view = null;
  generation = null;
  uncertainGeneration = null;
  constructor(model, namespace) {
    this.model = model;
    this.namespace = namespace === undefined ? undefined : pluginSettingsNamespaceSchema.parse(namespace);
  }
  get supported() { return this.model.transport.capabilities?.[this.namespace === 'web-search-deepseek' ? 'webSearchSettings' : this.namespace?.startsWith('subagent') ? 'subagentSettings' : this.namespace ? 'pluginSettings' : 'computerSettings'] === true; }
  get permitted() { return this.model.transport.capabilities?.management === true; }
  currentGeneration() {
    const model = this.model;
    if (!this.permitted) throw new Error('management_required');
    if (!this.supported) throw new Error('remote_settings_upgrade');
    const generation = model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || model.connection.state.getSnapshot() !== 'connected' || model.lifetime.signal.aborted) throw new Error('remote_not_connected');
    return generation;
  }
  async read(signal) { return this.request({ method: 'remote.settingsRead', ...(this.namespace ? { namespace: this.namespace } : {}) }, signal, false); }
  writeOperation(view, edits) { return computerSettingsWriteSchema.safeParse({ method: 'remote.settingsWrite', ...(this.namespace ? { namespace: this.namespace } : {}), snapshot: view.snapshot, expectedRevision: view.revision, edits }); }
  parseResult(result) {
    const parsed = (this.namespace ? pluginSettingsViewSchema : computerSettingsViewSchema).safeParse(result);
    if (!parsed.success || parsed.data.namespace !== (this.namespace ?? 'llm-deepseek')) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
  async save(view, edits, signal) {
    let generation;
    try { generation = this.currentGeneration(); } catch (error) { throw new Error(computerSettingsError(error)); }
    if (this.busy) throw new Error(computerSettingsError({ message: 'remote_settings_busy' }));
    if (this.uncertainGeneration === generation) throw new Error(uncertain);
    if (this.view !== view || this.generation !== generation) throw new Error(computerSettingsError({ message: 'remote_settings_stale' }));
    if (!view.writable) throw new Error(computerSettingsError({ message: 'remote_settings_read_only' }));
    const parsed = this.writeOperation(view, edits);
    if (!parsed.success) throw new Error('请输入有效的设置值。');
    return this.request(parsed.data, signal, true);
  }
  async request(operation, externalSignal, writing) {
    if (this.busy) throw new Error(computerSettingsError({ message: 'remote_settings_busy' }));
    let generation;
    try { generation = this.currentGeneration(); } catch (error) { throw new Error(computerSettingsError(error)); }
    const signal = AbortSignal.any([this.model.lifetime.signal, ...(externalSignal ? [externalSignal] : [])]);
    signal.throwIfAborted();
    this.busy = true; this.view = null;
    let request;
    const abort = () => request?.cancel();
    try {
      request = this.model.client.request(operation);
      signal.addEventListener('abort', abort, { once: true });
      const result = await request.promise;
      signal.throwIfAborted();
      let current;
      try { current = this.currentGeneration(); } catch { throw new Error(writing ? 'remote_settings_write_unconfirmed' : 'remote_not_connected'); }
      if (current !== generation) throw new Error(writing ? 'remote_settings_write_unconfirmed' : 'remote_settings_stale');
      const parsed = this.parseResult(result);
      this.generation = generation; this.view = parsed;
      return this.view;
    } catch (error) {
      const certainRefusal = ['management_required', 'remote_settings_stale', 'remote_settings_read_only', 'remote_provider_inherited'];
      if (writing && !certainRefusal.includes(error?.message)) { this.uncertainGeneration = generation; throw new Error(uncertain); }
      throw new Error(computerSettingsError(error));
    } finally { signal.removeEventListener('abort', abort); request?.cancel(); this.busy = false; }
  }
}

/** 每个提供方保留自己的写入状态，切换表单不能解除未确认写入的限制。 */
export class RemoteProviderSettings extends RemoteComputerSettings {
  providers = new Map();
  constructor(model, provider) {
    super(model); this.provider = provider === undefined ? undefined : providerRouteSchema.parse(provider);
    if (this.provider === undefined) this.creation = new RemoteProviderCreation(model);
    if (this.provider !== undefined) this.endpoint = new RemoteComputerEndpoint(model, { provider: this.provider });
    if (this.provider !== undefined) this.key = new RemoteComputerKey(model, { provider: this.provider });
    if (this.provider !== undefined) this.models = new RemoteProviderModelSettings(model, this.provider);
    if (this.provider !== undefined) this.overrides = new RemoteProviderModelSettings(model, this.provider, 'overrides');
    if (this.provider !== undefined) this.removal = new RemoteProviderRemoval(model, this.provider);
  }
  get supported() { return this.model.transport.capabilities?.providerSettings === true; }
  forProvider(provider) {
    const route = providerRouteSchema.parse(provider);
    if (!this.providers.has(route)) this.providers.set(route, new RemoteProviderSettings(this.model, route));
    return this.providers.get(route);
  }
  async read(signal) { return this.request(this.provider === undefined ? { method: 'remote.providerSettingsList' }
    : { method: 'remote.providerSettingsRead', provider: this.provider }, signal, false); }
  get keySetupSupported() { return this.model.transport.capabilities?.providerKeySetup === true; }
  async prepareKey(view, signal) {
    const next = await this.save(view, { setupKey: true }, signal);
    if (next.keySetupAvailable !== false) {
      this.uncertainGeneration = this.generation; this.view = null; throw new Error(uncertain);
    }
    return next;
  }
  writeOperation(view, change) {
    if (change?.setupKey === true) return this.keySetupSupported && view.keySetupAvailable === true && Object.keys(change).length === 1
      ? providerKeySetupSchema.safeParse({ method: 'remote.providerKeySetup', provider: this.provider,
        snapshot: view.snapshot, expectedRevision: view.revision, confirmed: true }) : { success: false };
    const { edits, compat, protocolChange } = Array.isArray(change) ? { edits: change } : change;
    if (compat !== undefined && !view.compat) return { success: false };
    if (protocolChange !== undefined && (!view.protocol || !view.protocol.choices.includes(protocolChange.value))) return { success: false };
    return providerSettingsWriteSchema.safeParse({ method: 'remote.providerSettingsWrite', provider: this.provider,
      snapshot: view.snapshot, expectedRevision: view.revision, edits, ...(compat === undefined ? {} : { compat }),
      ...(protocolChange === undefined ? {} : { protocolChange }) });
  }
  parseResult(result) {
    const parsed = (this.provider === undefined ? providerDirectorySchema : providerSettingsViewSchema).safeParse(result);
    if (!parsed.success || (this.provider !== undefined && parsed.data.provider !== this.provider)) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}

export class RemoteProviderCreation extends RemoteComputerSettings {
  get supported() { return this.model.transport.capabilities?.providerCreation === true; }
  get modelRowsSupported() { return this.model.transport.capabilities?.providerCreationModelRows === true; }
  async read(signal) {
    const view = await this.request({ method: 'remote.providerCreationRead' }, signal, false);
    if (view.created) { this.view = null; throw new Error(computerSettingsError({ message: 'remote_settings_invalid' })); }
    return view;
  }
  async save(view, draft, signal) {
    const result = await super.save(view, draft, signal);
    if (!result.created || result.created.provider !== draft.provider || result.created.useKey !== draft.useKey) {
      this.uncertainGeneration = this.generation; this.view = null; throw new Error(uncertain);
    }
    return result;
  }
  writeOperation(view, draft) {
    if (draft.kind === 'custom' && Array.isArray(draft.models) && draft.models.some(row => typeof row !== 'string') && !this.modelRowsSupported) return { success: false };
    if (view.created || (draft.useKey && !view.keyAvailable)) return { success: false };
    if (draft.kind === 'catalog' ? !view.available.some(row => row.provider === draft.provider)
      : view.taken.includes(draft.provider) || !view.protocols.includes(draft.api)) return { success: false };
    return providerCreationWriteSchema.safeParse({ ...draft, method: 'remote.providerCreationWrite', snapshot: view.snapshot,
      expectedRevision: view.revision, confirmed: true });
  }
  parseResult(result) {
    const parsed = providerCreationViewSchema.safeParse(result);
    if (!parsed.success) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}

export class RemoteProviderRemoval extends RemoteComputerSettings {
  constructor(model, provider) { super(model); this.provider = providerRouteSchema.parse(provider); }
  get supported() { return this.model.transport.capabilities?.providerRemoval === true; }
  async read(signal) { return this.request({ method: 'remote.providerRemovalRead', provider: this.provider }, signal, false); }
  writeOperation(view) { return view.removable && !view.removed ? providerRemovalWriteSchema.safeParse({
    method: 'remote.providerRemovalWrite', provider: this.provider, snapshot: view.snapshot, expectedRevision: view.revision,
  }) : { success: false }; }
  parseResult(result) {
    const parsed = providerRemovalViewSchema.safeParse(result);
    if (!parsed.success || parsed.data.provider !== this.provider) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}

export class RemoteDeepSeekModels extends RemoteComputerSettings {
  official = true;
  get supported() { return this.model.transport.capabilities?.deepSeekModels === true; }
  async read(signal) { return this.request({ method: 'remote.deepSeekModelsRead' }, signal, false); }
  writeOperation(view, change) { return deepSeekModelsWriteSchema.safeParse({ method: 'remote.deepSeekModelsWrite',
    snapshot: view.snapshot, expectedRevision: view.revision, change }); }
  parseResult(result) {
    const parsed = providerModelsViewSchema.safeParse(result);
    if (!parsed.success || parsed.data.provider !== 'deepseek' || parsed.data.scope !== undefined
      || parsed.data.compatEditable !== false || parsed.data.rows.some(row => row.compat !== undefined || row.advanced?.reasoningEfforts !== undefined))
      throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}

export class RemoteProviderModelSettings extends RemoteComputerSettings {
  constructor(model, provider, scope) { super(model); this.provider = providerRouteSchema.parse(provider); this.scope = scope;
    this.discovery = new RemoteProviderModelDiscovery(model, this.provider); }
  get supported() { return this.model.transport.capabilities?.[this.scope ? 'providerModelOverrides' : 'providerModels'] === true; }
  async read(signal) { return this.request({ method: 'remote.providerModelsRead', provider: this.provider, ...(this.scope ? { scope: this.scope } : {}) }, signal, false); }
  writeOperation(view, change) { return providerModelsWriteSchema.safeParse({ method: 'remote.providerModelsWrite', provider: this.provider,
    ...(this.scope ? { scope: this.scope } : {}),
    snapshot: view.snapshot, expectedRevision: view.revision, change }); }
  parseResult(result) {
    const parsed = providerModelsViewSchema.safeParse(result);
    if (!parsed.success || parsed.data.provider !== this.provider || parsed.data.scope !== this.scope) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}

/** 候选读取独立于编辑快照，获取目录不能使当前未保存表单失效。 */
export class RemoteProviderModelDiscovery extends RemoteComputerSettings {
  constructor(model, provider) { super(model); this.provider = providerRouteSchema.parse(provider); }
  get supported() { return this.model.transport.capabilities?.providerModelDiscovery === true; }
  async read(signal) { return this.request({ method: 'remote.providerModelsDiscover', provider: this.provider }, signal, false); }
  parseResult(result) {
    const parsed = providerModelsDiscoveryViewSchema.safeParse(result);
    if (!parsed.success || parsed.data.provider !== this.provider) throw new Error('remote_settings_invalid');
    return parsed.data;
  }
}
