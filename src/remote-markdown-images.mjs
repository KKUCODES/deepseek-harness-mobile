import { parseGfmWithMath } from '../../deepseek-harness/packages/client/ui-primitives/src/markdown/parse.ts';
import { parseFileLink } from '../../deepseek-harness/packages/client/ui-primitives/src/markdown/file-link.ts';
import { IMAGE_PREVIEW_BYTES } from './remote-files.mjs';

/** 图片解码失败时使用的占位目标；原Markdown按失败样式显示替代文本。 */
export const FAILED_IMAGE_URL = 'data:image/png;base64,AA==';

const mediaTypes = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif',
};

/** 是否为绝对工作区路径，兼容POSIX、Windows盘符与UNC。 */
function isAbsolutePath(value) {
  return value.startsWith('/') || /^[A-Za-z]:[/\\]/.test(value) || value.startsWith('\\\\');
}

/** 相对路径按会话工作区补全，保留原分隔符风格；工作区未知时返回undefined。 */
function absolutePath(cwd, path) {
  if (isAbsolutePath(path)) return path;
  if (typeof cwd !== 'string' || !isAbsolutePath(cwd)) return undefined;
  const separator = /^[A-Za-z]:[/\\]/.test(cwd) && cwd.includes('\\') ? '\\' : '/';
  const relative = path.replace(/^(?:\.?[/\\])+/, '');
  return `${cwd.replace(/[/\\]+$/, '')}${separator}${relative}`;
}

/** 收集Markdown正文中的图片目标，含引用式定义的图片；解析失败时不预取。 */
export function markdownImageDestinations(text) {
  if (typeof text !== 'string' || text === '') return [];
  let tree;
  try {
    tree = parseGfmWithMath(text);
  } catch { return []; }
  const definitions = new Map();
  const visitDefinitions = node => {
    if (node.type === 'definition' && !definitions.has(node.identifier.toUpperCase())) {
      definitions.set(node.identifier.toUpperCase(), node.url);
    }
    if (Array.isArray(node.children)) for (const child of node.children) visitDefinitions(child);
  };
  visitDefinitions(tree);
  const destinations = [];
  const visit = node => {
    if (node.type === 'image') destinations.push(node.url);
    else if (node.type === 'imageReference') {
      const url = definitions.get(node.identifier.toUpperCase());
      if (url !== undefined) destinations.push(url);
    }
    if (Array.isArray(node.children)) for (const child of node.children) visit(child);
  };
  visit(tree);
  return destinations.filter(destination => typeof destination === 'string' && destination !== '');
}

/** 正文图片目标只接受本地文件；外链、data与未知协议都不进入会话文件读取。 */
function localDestination(destination, decode) {
  if (typeof destination !== 'string') return undefined;
  // resolve 收到原渲染器已经解码的文件路径，字面 #/? 不能再次当作 URL 后缀。
  const value = decode ? parseFileLink(destination)?.path : destination;
  if (value === undefined) return undefined;
  if (value === '' || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[a-z]:[/\\]/i.test(value)) return undefined;
  return value;
}

/** 会话内正文图片的授权读取缓存；字节只在本机生成blob URL，不跨会话共享。 */
export class RemoteMarkdownImages {
  /** 已就绪或失败的目标，按绝对路径索引。 */
  entries = new Map();
  /** 正在读取的目标与取消控制。 */
  pending = new Map();
  /** 等待并发名额的目标。 */
  queue = [];
  /** 当前读取数。 */
  active = 0;
  /** 已发布URL的字节总量。 */
  bytes = 0;
  /** 缓存变化订阅者。 */
  listeners = new Set();
  /** 会话或组件释放后不再读取或发布。 */
  disposed = false;

  /**
   * @param {object | null} model - Remote 模型，提供会话生命周期与默认文件读取。
   * @param {string} sessionId - 图片所属会话，也是文件读取的授权范围。
   * @param {object} [options] - 读取策略。
   * @param {string | (() => string | undefined)} [options.cwd] - 会话工作区根，用于补全相对路径。
   * @param {(sessionId: string, path: string, signal: AbortSignal) => Promise<Uint8Array>} [options.read] - 会话文件读取；默认走model.files。
   * @param {number} [options.maxBytes] - 单张图片上限。
   * @param {number} [options.budget] - 已发布图片的总字节预算。
   * @param {number} [options.concurrency] - 同时读取的图片数。
   */
  constructor(model, sessionId, { cwd, read, maxBytes = IMAGE_PREVIEW_BYTES, budget = 64 * 1024 * 1024, concurrency = 2 } = {}) {
    this.model = model;
    this.sessionId = sessionId;
    this.cwdOption = cwd;
    this.maxBytes = maxBytes;
    this.budget = budget;
    this.concurrency = concurrency;
    this.read = read ?? ((session, path, signal) => model.files.bytes(session, path, signal, { maxBytes }));
    this.releaseOnLifetime = () => this.dispose();
    this.connected = this.isConnected();
    this.generation = model?.connection?.generation.getSnapshot()?.id;
    this.releaseConnection = model?.subscribe?.(() => {
      const connected = this.isConnected(), generation = model?.connection?.generation.getSnapshot()?.id;
      const recovered = connected && (!this.connected || generation !== this.generation);
      this.connected = connected; this.generation = generation;
      if (recovered) this.retry();
      if (connected) this.pump();
    });
    model?.lifetime?.signal?.addEventListener('abort', this.releaseOnLifetime, { once: true });
    if (model?.lifetime?.signal?.aborted) this.dispose();
  }

  /** 当前会话工作区根。 */
  get cwd() {
    return typeof this.cwdOption === 'function' ? this.cwdOption() : this.cwdOption;
  }

  isConnected() {
    const state = this.model?.getSnapshot?.();
    return !state || state.connectionState === 'connected' && state.ready !== false;
  }

  /** 把Markdown目标解析成读取键；非本地图片或未知图片类型返回undefined。 */
  key(destination, decode = false) {
    const path = localDestination(destination, decode);
    if (path === undefined) return undefined;
    const absolute = absolutePath(this.cwd, path);
    if (absolute === undefined) return undefined;
    const name = absolute.split(/[/\\]/).pop() ?? '';
    const mediaType = mediaTypes[name.split('.').pop()?.toLowerCase()];
    return mediaType === undefined ? undefined : { path: absolute, mediaType };
  }

  /** 同步返回已就绪的URL或失败占位；未读取的目标只返回undefined，由原Markdown回退到替代文本。 */
  resolve(destination) {
    const key = this.key(destination);
    if (key === undefined) return undefined;
    const entry = this.entries.get(key.path);
    if (entry === undefined) return undefined;
    return entry.failed ? FAILED_IMAGE_URL : entry.url;
  }

  /** 登记正文中出现的目标并按并发上限读取；同一路径只读一次。 */
  prefetch(text) {
    if (this.disposed) return;
    for (const destination of markdownImageDestinations(text)) {
      const key = this.key(destination, true);
      if (key === undefined || this.entries.has(key.path) || this.pending.has(key.path)) continue;
      const controller = new AbortController();
      this.pending.set(key.path, { key, controller });
      this.queue.push(key.path);
    }
    this.pump();
  }

  /** 只重试暂时读取错误；连续重画不会重试，也不自动重读格式错误或超限文件。 */
  retry(text) {
    if (this.disposed) return;
    const paths = text === undefined ? [...this.entries.keys()] : markdownImageDestinations(text).map(value => this.key(value, true)?.path);
    for (const path of paths) {
      const entry = this.entries.get(path);
      if (!entry?.retryable || this.pending.has(path)) continue;
      this.entries.delete(path);
      this.pending.set(path, { key: entry.key, controller: new AbortController() }); this.queue.push(path);
    }
    this.notify(); this.pump();
  }

  canRetry(text) {
    return markdownImageDestinations(text).some(value => this.entries.get(this.key(value, true)?.path)?.retryable);
  }

  /** 订阅缓存变化；图片就绪后原Markdown需要重新解析同一段正文。 */
  subscribe(listener) {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 按并发上限启动排队读取。 */
  pump() {
    while (!this.disposed && this.isConnected() && this.active < this.concurrency && this.queue.length > 0) {
      const path = this.queue.shift();
      const pending = this.pending.get(path);
      if (pending === undefined || pending.controller.signal.aborted) continue;
      this.active++;
      void this.load(path, pending, this.generation).finally(() => { this.active--; this.pump(); });
    }
  }

  /** 读取一张图片并发布blob URL；失败只影响当前图片。 */
  async load(path, { key, controller }, generation) {
    let recovered = false;
    try {
      const bytes = await this.read(this.sessionId, key.path, controller.signal);
      if (this.disposed || controller.signal.aborted) return;
      if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > this.maxBytes) {
        throw new Error('remote_image_invalid');
      }
      if (this.bytes + bytes.length > this.budget) throw new Error('remote_image_memory_full');
      const url = URL.createObjectURL(new Blob([bytes], { type: key.mediaType }));
      if (this.disposed) { URL.revokeObjectURL(url); return; }
      this.bytes += bytes.length;
      this.entries.set(path, { url });
    } catch (error) {
      if (this.disposed || controller.signal.aborted) return;
      const retryable = !['remote_image_invalid', 'remote_image_memory_full', 'remote_file_preview_too_large', 'workspace-file/denied'].includes(error?.code ?? error?.message);
      this.entries.set(path, { failed: true, retryable, key });
      recovered = retryable && generation !== this.generation && this.isConnected();
    } finally {
      this.pending.delete(path);
      this.notify();
      if (recovered) this.retry();
    }
  }

  /** 通知正文重新解析图片目标。 */
  notify() {
    if (this.disposed) return;
    for (const listener of this.listeners) listener();
  }

  /** 释放读取、URL与订阅；会话切换或组件卸载后旧图片不可再显示。 */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseConnection?.();
    this.model?.lifetime?.signal?.removeEventListener('abort', this.releaseOnLifetime);
    for (const { controller } of this.pending.values()) controller.abort();
    this.pending.clear();
    this.queue.length = 0;
    for (const entry of this.entries.values()) if (entry.url !== undefined) URL.revokeObjectURL(entry.url);
    this.entries.clear();
    this.listeners.clear();
    this.bytes = 0;
  }
}
