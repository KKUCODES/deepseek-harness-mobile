import { uploadRemote, promptRemote } from './remote-upload.mjs';
import { RemotePluginOperations, longPluginCalls } from './remote-plugin-operations.mjs';

export const isRemoteHostDisconnect = error => error instanceof Error &&
  ['host_offline', 'host_disconnected_outcome_unknown', 'connection_closed_outcome_unknown', 'remote_not_connected'].includes(error.message);

/** DSH 原始 ClientTransportHooks；身份、凭据和 socket 仍由独立 Remote 原生桥持有。 */
export class RemoteTransport {
  constructor(client, { fetchResource = globalThis.fetch.bind(globalThis), loadScript = script } = {}) {
    this.client = client;
    this.pluginOperations = new RemotePluginOperations(client, () => this.capabilities);
    this.fetchResource = fetchResource;
    this.loadScript = loadScript;
    this.generation = 0;
    this.lifetime = new AbortController();
    this.unsubscribe = client.subscribe(frame => {
      if (frame.type === 'closed' || frame.type === 'ready') {
        this.generation++;
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
  async negotiate({ signal } = {}) {
    signal?.throwIfAborted();
    const generation = this.generation;
    const request = this.client.request({ method: 'remote.negotiate', version: 2 });
    const cancel = () => request.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    let result;
    try { result = await request.promise; signal?.throwIfAborted(); }
    finally { signal?.removeEventListener('abort', cancel); }
    if (generation !== this.generation || this.lifetime.signal.aborted) throw new Error('remote_generation_changed');
    if (result?.transport !== 2) throw new Error('unsupported_remote_version');
    if (result.dshVersion !== '0.1.6-alpha.2') throw new Error('unsupported_dsh_version');
    this.capabilities = result;
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
    const request = this.client.request({ method: 'remote.rpc', endpoint, payload });
    const cancel = () => request.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const result = await request.promise;
      signal?.throwIfAborted();
      if (typeof result?.ok !== 'boolean') throw new Error('invalid_remote_result');
      if (result.ok) this.lastReceivedAt = Date.now();
      return result;
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  async *stream(channel, endpoint, payload, signal) {
    try { yield* this.readStream(channel, endpoint, payload, signal); }
    catch (error) {
      // 仅恢复只读订阅；写操作仍以原错误结束，不能自动重放。
      if (!signal.aborted && isRemoteHostDisconnect(error)) {
        const carrier = new Error(error.message, { cause: error });
        carrier.dshRemoteStreamFailure = { kind: 'carrier' };
        throw carrier;
      }
      throw error;
    }
  }
  async *readStream(channel, endpoint, payload, signal) {
    this.channel(channel); signal.throwIfAborted();
    const queue = []; let bytes = 0, ended = false, failure, wake;
    const notify = () => wake?.();
    const request = this.client.request({ method: 'remote.stream', endpoint, payload }, value => {
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
        if (item) { bytes -= item.size; yield item.value; }
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
  dispose() { this.unsubscribe(); this.pluginOperations.dispose(); this.generation++; this.capabilities = undefined; this.lifetime.abort(); }
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
