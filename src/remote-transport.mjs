import { acceptsRemoteDshVersion, isProfileDshVersion } from './remote-dsh-version.mjs';
import { uploadRemote, promptRemote } from './remote-upload.mjs';
import { RemotePluginOperations, longPluginCalls } from './remote-plugin-operations.mjs';

export const isRemoteHostDisconnect = error => error instanceof Error &&
  ['host_offline', 'host_disconnected_outcome_unknown', 'connection_closed_outcome_unknown', 'remote_not_connected'].includes(error.message);

// 使用固定 SDK 与显式核验的宿主组合；不自动接受其他预发布版本。
const mobileSdkVersion = typeof DSHM_MOBILE_SDK_VERSION === 'string' ? DSHM_MOBILE_SDK_VERSION : '0.1.6-alpha.2';

/** DSH 原始 ClientTransportHooks；身份、凭据和 socket 仍由独立 Remote 原生桥持有。 */
export class RemoteTransport {
  constructor(client, { fetchResource = globalThis.fetch.bind(globalThis), loadScript = script, syncCache } = {}) {
    this.client = client;
    this.syncCache = syncCache;
    this.clearCache = () => { void this.syncCache?.clear(); };
    globalThis.addEventListener?.('dshm-cache-clear', this.clearCache);
    this.pluginOperations = new RemotePluginOperations(client, () => this.capabilities);
    this.fetchResource = fetchResource;
    this.loadScript = loadScript;
    this.generation = 0;
    this.hostOffline = false;
    this.lifetime = new AbortController();
    this.unsubscribe = client.subscribe(frame => {
      if (frame.type === 'closed' || frame.type === 'ready') {
        if (['device_revoked', 'permissions_changed', 'credential_expired'].includes(frame.reason)) this.clearCache();
        this.generation++;
        this.hostOffline = frame.type === 'closed' || frame.hostOnline === false;
        this.capabilities = undefined;
        this.lifetime.abort();
        this.lifetime = new AbortController();
      }
    });
    this.hooks = {
      ownsHost: false,
      rpc: {
        call: (channel, endpoint, payload, signal) => this.call(channel, endpoint, payload, signal),
        open: (channel, endpoint, payload, signal) => this.stream(channel, endpoint, payload, signal),
      },
      fetch: (input, init) => this.fetch(input, init),
      loadBundle: url => this.loadBundle(url),
    };
    this.uploadHooks = { fetch: (input, init) => {
      if (!this.capabilities?.channels?.includes('upload')) return Promise.reject(new Error('remote_upload_unavailable'));
      return uploadRemote(this.client, input, init, this.lifetime.signal);
    } };
  }
  pauseHostOperations(error, generation) {
    if (!isRemoteHostDisconnect(error) || this.hostOffline || generation !== this.generation) return;
    // 新载体已在线但能力尚未确认时，订阅的本地前置检查并不代表再次断线。
    // 不能递增世代并取消正在确认能力的请求；真正的远端断线仍结束旧操作。
    if (error.message === 'remote_not_connected' && !this.capabilities && this.client.connected) return;
    this.hostOffline = true;
    this.generation++;
    // 电脑退出时中转仍可保留手机socket；本地保存窗口也必须结束旧传输。
    // 多条订阅会同时失败，只取消一次；保留能力供已加载的聊天继续显示。
    this.lifetime.abort();
    this.lifetime = new AbortController();
  }
  async negotiate({ signal } = {}) {
    signal?.throwIfAborted();
    const generation = this.generation;
    const request = this.client.request({ method: 'remote.negotiate', version: 2 });
    const cancel = () => request.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    let result;
    try { result = await request.promise; signal?.throwIfAborted(); }
    catch (error) { this.pauseHostOperations(error, generation); throw error; }
    finally { signal?.removeEventListener('abort', cancel); }
    if (generation !== this.generation || this.lifetime.signal.aborted) throw new Error('remote_generation_changed');
    if (result?.transport !== 2) throw new Error('unsupported_remote_version');
    if (!acceptsRemoteDshVersion(mobileSdkVersion, result.dshVersion)) throw new Error('unsupported_dsh_version');
    this.capabilities = result;
    this.hostOffline = false;
    return result;
  }
  channel(channel) {
    if (channel !== '/api') throw new Error('unsupported_remote_channel');
    if (!this.capabilities) throw new Error('remote_not_connected');
  }
  async call(channel, endpoint, payload, signal) {
    this.channel(channel); signal?.throwIfAborted();
    // Android GMT系统时区可由Intl报告为+00:00；两者均与UTC等价。
    // 原Host只接受UTC或地区名称，不猜测其他固定偏移对应的地区。
    // 在两种提交共用的边界规范化，覆盖文字/图片且不修改调用者的请求对象。
    if (['session/prompt', 'subagents/prompt'].includes(endpoint) && ['GMT', '+00:00', '-00:00'].includes(payload?.args?.request?.clientTimeZone)) {
      payload = { ...payload, args: { ...payload.args, request: { ...payload.args.request, clientTimeZone: 'UTC' } } };
    }
    if (longPluginCalls.has(endpoint) && this.capabilities.pluginOperationGeneration) {
      const result = await this.pluginOperations.run(endpoint, payload, signal);
      if (result.ok) this.lastReceivedAt = Date.now();
      return result;
    }
    if (['session/prompt', 'subagents/prompt'].includes(endpoint) && payload?.args?.request?.content?.some(part => part.type === 'image')) {
      if (!this.capabilities.channels?.includes('prompt')) throw new Error('请更新电脑插件和网关后发送图片。');
      if (endpoint === 'subagents/prompt' && this.capabilities.subagentPromptUpload !== true) throw new Error('请更新电脑插件和网关后向子会话发送图片。');
      return promptRemote(this.client, payload, this.lifetime.signal, signal, endpoint);
    }
    const generation = this.generation;
    try {
      const result = await this.rpcResult(endpoint, payload, signal, generation);
      signal?.throwIfAborted();
      if (typeof result?.ok !== 'boolean') throw new Error('invalid_remote_result');
      if (result.ok) this.lastReceivedAt = Date.now();
      // 新版生成Client要求原生字节；自有下载器的旧range请求仍保留既有base64契约。
      if (result.ok && isProfileDshVersion(this.capabilities?.dshVersion) && endpoint === 'workspaceFiles/readBytes'
        && Object.hasOwn(payload?.args ?? {}, 'options')) {
        const data = result.value?.data;
        if (typeof data !== 'string' || data.length > Math.ceil(65536 / 3) * 4
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw new Error('invalid_remote_result');
        const raw = atob(data);
        if (raw.length > 65536 || btoa(raw) !== data) throw new Error('invalid_remote_result');
        return { ...result, value: { ...result.value, data: Uint8Array.from(raw, char => char.charCodeAt(0)) } };
      }
      return result;
    } catch (error) { this.pauseHostOperations(error, generation); throw error; }
  }
  async rpcResult(endpoint, payload, signal, generation) {
    const cache = this.capabilities?.syncCacheVersion === 1 ? this.syncCache : undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const hint = cache ? await cache.prepare(endpoint, payload, false, this.capabilities.dshVersion, attempt > 0) : undefined;
      signal?.throwIfAborted();
      if (generation !== this.generation) throw Error('remote_generation_changed');
      const request = this.client.request({ method: 'remote.rpc', endpoint, payload: hint?.payload ?? payload });
      const cancel = () => request.cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        const value = await request.promise;
        return hint ? await cache.decode(value, hint, signal) : value;
      } catch (error) {
        if (!hint || error.dshmSyncDecodeFailure !== true || attempt > 0) throw error;
      } finally { signal?.removeEventListener('abort', cancel); }
    }
  }
  async *stream(channel, endpoint, payload, signal) {
    const generation = this.generation;
    try {
      try { yield* this.readStream(channel, endpoint, payload, signal); }
      catch (error) {
        if (error.dshmSyncDecodeFailure !== true || signal.aborted || generation !== this.generation) throw error;
        yield* this.readStream(channel, endpoint, payload, signal, true);
      }
    }
    catch (error) {
      this.pauseHostOperations(error, generation);
      // 仅恢复只读订阅；写操作仍以原错误结束，不能自动重放。
      if (!signal.aborted && isRemoteHostDisconnect(error)) {
        const carrier = new Error(error.message, { cause: error });
        carrier.dshRemoteStreamFailure = { kind: 'carrier' };
        throw carrier;
      }
      throw error;
    }
  }
  async *readStream(channel, endpoint, payload, signal, forceFull = false) {
    this.channel(channel); signal.throwIfAborted();
    const generation = this.generation;
    const cache = this.capabilities?.syncCacheVersion === 1 ? this.syncCache : undefined;
    const hint = cache ? await cache.prepare(endpoint, payload, true, this.capabilities.dshVersion, forceFull) : undefined;
    signal.throwIfAborted();
    if (generation !== this.generation) throw Error('remote_generation_changed');
    const queue = []; let bytes = 0, ended = false, failure, wake;
    const notify = () => wake?.();
    const request = this.client.request({ method: 'remote.stream', endpoint, payload: hint?.payload ?? payload }, value => {
      const size = JSON.stringify(value).length;
      if (queue.length >= 256 || bytes + size > 8 * 1024 * 1024) {
        failure = new Error('remote_consumer_too_slow'); request.cancel(); notify(); return;
      }
      this.lastReceivedAt = Date.now();
      queue.push({ value, size }); bytes += size; notify();
    }, () => { ended = true; notify(); });
    void request.promise.then(() => { ended = true; notify(); }, error => { failure = error; notify(); });
    const abort = () => { request.cancel(); notify(); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      for (;;) {
        signal.throwIfAborted();
        if (failure) throw failure;
        const item = queue.shift();
        if (item) { bytes -= item.size; yield hint ? await cache.decode(item.value, hint, signal) : item.value; }
        else if (ended) return;
        else await new Promise(resolve => { wake = resolve; });
      }
    } finally { signal.removeEventListener('abort', abort); request.cancel(); }
  }
  resourceUrl(input) {
    const raw = typeof input === 'string' ? input : input.url ?? String(input);
    const url = new URL(raw, 'https://remote.dshm.invalid/');
    if (url.origin !== 'https://remote.dshm.invalid' || url.username || url.password || url.hash || !url.pathname.startsWith('/plugins/')) throw new Error('remote_resource_denied');
    return url.href;
  }
  fetch(input, init) {
    if (!this.capabilities) throw new Error('remote_not_negotiated');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (!['GET', 'HEAD'].includes(method)) throw new Error('remote_resource_denied');
    // Android shouldInterceptRequest 提供认证后的字节；没有转发任意公网 URL 的兜底。
    return this.fetchResource(this.resourceUrl(input), { ...init, method, cache: 'no-store', credentials: 'omit' });
  }
  loadBundle(url, { signal, generation } = {}) {
    if (!this.capabilities) throw new Error('remote_not_negotiated');
    return this.loadScript(this.resourceUrl(url), signal ? AbortSignal.any([this.lifetime.signal, signal]) : this.lifetime.signal, generation);
  }
  dispose() {
    this.unsubscribe(); this.pluginOperations.dispose(); this.generation++; this.capabilities = undefined; this.lifetime.abort();
    globalThis.removeEventListener?.('dshm-cache-clear', this.clearCache); this.syncCache?.close();
  }
}

function script(url, signal, generation) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const element = document.createElement('script'); element.src = url;
    if (generation) element.dataset.dshmGeneration = generation;
    const cleanup = () => { element.remove(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new Error('remote_generation_changed')); };
    element.onload = () => { cleanup(); resolve(); };
    element.onerror = () => { cleanup(); reject(new Error('remote_bundle_unavailable')); };
    signal.addEventListener('abort', abort, { once: true });
    document.head.append(element);
  });
}
