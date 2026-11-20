import { parseGfmWithMath } from '../../deepseek-harness/packages/client/ui-primitives/src/markdown/parse.ts';
import { parseFileLink } from '../../deepseek-harness/packages/client/ui-primitives/src/markdown/file-link.ts';
import { IMAGE_PREVIEW_BYTES } from './remote-files.mjs';
import { imageFailureReason, imageFailureReasonFromError } from './remote-image-failure.mjs';

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

/** 工作区未知时以原目标作为失败键，避免与绝对路径冲突。 */
function rawKey(path) {
  return `raw:${path}`;
}

/** 解析正文一次，返回图片目标与引用式定义。 */
function parseImageText(text) {
  if (typeof text !== 'string' || text === '') return undefined;
  let tree;
  try {
    tree = parseGfmWithMath(text);
  } catch { return undefined; }
  const definitions = new Map();
  const visitDefinitions = node => {
    if (node.type === 'definition' && !definitions.has(node.identifier.toUpperCase())) {
      definitions.set(node.identifier.toUpperCase(), node.url);
    }
    if (Array.isArray(node.children)) for (const child of node.children) visitDefinitions(child);
  };
  visitDefinitions(tree);
  return { tree, definitions };
}

/** 收集Markdown正文中的图片目标，含引用式定义的图片；解析失败时不预取。 */
export function markdownImageDestinations(text) {
  const parsed = parseImageText(text);
  if (parsed === undefined) return [];
  const destinations = [];
  const visit = node => {
    if (node.type === 'image') destinations.push(node.url);
    else if (node.type === 'imageReference') {
      const url = parsed.definitions.get(node.identifier.toUpperCase());
      if (url !== undefined) destinations.push(url);
    }
    if (Array.isArray(node.children)) for (const child of node.children) visit(child);
  };
  visit(parsed.tree);
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

/** 生成带错误码的错误，供原因归类使用。 */
function codedError(code) {
  return Object.assign(new Error(code), { code });
}

/**
 * 把已结束的正文按失败图片段落切开。
 * 只处理顶层、段落里只有这一张图片的情况，避免破坏行内图片、表格和引用块；
 * 其他失败图片仍走原Markdown的替代文字。
 * @param {string} text Markdown 正文
 * @param {(destination: string, alt: string) => object | undefined} failureFor 目标对应的失败信息
 * @returns {Array<{ type: 'markdown', text: string } | { type: 'failure', failure: object }> | undefined} 切片；没有失败图片时为 undefined
 */
export function markdownImageFailureBlocks(text, failureFor) {
  const parsed = parseImageText(text);
  if (parsed === undefined) return undefined;
  const blocks = [];
  const replaced = new Set();
  let cursor = 0;
  for (const node of parsed.tree.children) {
    if (node.type !== 'paragraph' || node.position?.start.offset === undefined || node.position?.end.offset === undefined) continue;
    const meaningful = node.children.filter(child => child.type !== 'text' || child.value.trim() !== '');
    if (meaningful.length !== 1) continue;
    const child = meaningful[0];
    let destination, alt;
    if (child.type === 'image') {
      destination = child.url;
      alt = child.alt ?? '';
    } else if (child.type === 'imageReference') {
      destination = parsed.definitions.get(child.identifier.toUpperCase());
      alt = child.alt ?? '';
    } else continue;
    if (destination === undefined) continue;
    const failure = failureFor(destination, alt);
    if (failure === undefined) continue;
    replaced.add(node);
    const start = node.position.start.offset, end = node.position.end.offset;
    if (start > cursor && text.slice(cursor, start).trim() !== '') blocks.push({ type: 'markdown', text: text.slice(cursor, start) });
    blocks.push({ type: 'failure', failure });
    cursor = end;
  }
  if (cursor === 0) return undefined;
  // 其他段落的引用可能依赖切片之外的定义；交给原渲染器整段解析。
  const needsDefinitions = node => !replaced.has(node) && (
    ['linkReference', 'imageReference', 'footnoteReference'].includes(node.type)
    || node.children?.some(needsDefinitions)
  );
  if (needsDefinitions(parsed.tree)) return undefined;
  if (cursor < text.length && text.slice(cursor).trim() !== '') blocks.push({ type: 'markdown', text: text.slice(cursor) });
  return blocks;
}

/** 会话内正文图片的授权读取缓存；字节只在本机生成blob URL，不跨会话共享。 */
export class RemoteMarkdownImages {
  /** 已就绪或失败的目标，按绝对路径（工作区未知时按原目标）索引。 */
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
  /** 等待重试结束的调用方。 */
  waiters = new Map();
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
      if (recovered) this.retryText();
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

  /** 把Markdown目标解析成本地图片；非本地图片或未知图片类型返回undefined。 */
  localImage(destination, decode = false) {
    const path = localDestination(destination, decode);
    if (path === undefined) return undefined;
    const name = path.split(/[/\\]/).pop() ?? '';
    const mediaType = mediaTypes[name.split('.').pop()?.toLowerCase()];
    if (mediaType === undefined) return undefined;
    const absolute = absolutePath(this.cwd, path);
    return { path: absolute ?? path, raw: path, mediaType, absolute: absolute !== undefined };
  }

  /** 把Markdown目标解析成读取键；非本地图片、未知图片类型或工作区未知返回undefined。 */
  key(destination, decode = false) {
    const image = this.localImage(destination, decode);
    return image?.absolute ? { path: image.path, mediaType: image.mediaType } : undefined;
  }

  /** 失败目标、就绪URL与工作区未知共用的索引键。 */
  entryKey(image) {
    return image.absolute ? image.path : rawKey(image.raw);
  }

  /** 同步返回已就绪的URL或失败占位；未读取的目标只返回undefined，由原Markdown回退到替代文本。 */
  resolve(destination) {
    const image = this.localImage(destination);
    if (image === undefined) return undefined;
    const entry = this.entries.get(this.entryKey(image));
    if (entry === undefined) return undefined;
    return entry.failed ? FAILED_IMAGE_URL : entry.url;
  }

  /**
   * 返回一个目标当前的失败信息，供正文失败块使用。
   * @param {string} destination Markdown 里的图片目标
   * @param {string} [alt] 图片替代文字
   * @returns {{ key: string, destination: string, path: string, alt: string, reason: string, code: string, retryable: boolean, retrying: boolean } | undefined} 失败信息
   */
  failureFor(destination, alt = '') {
    const image = this.localImage(destination, true);
    if (image === undefined) return undefined;
    const entry = this.entries.get(this.entryKey(image));
    if (entry?.failed !== true) return undefined;
    const reason = imageFailureReason(entry.reason);
    return {
      key: this.entryKey(image),
      destination,
      path: entry.path ?? image.path,
      alt,
      reason: entry.reason ?? 'read',
      code: reason.code,
      retryable: entry.retryable ?? reason.retryable,
      retrying: entry.retrying === true,
    };
  }

  /** 登记正文中出现的目标并按并发上限读取；同一路径只读一次。 */
  prefetch(text) {
    if (this.disposed) return;
    let changed = false;
    for (const destination of markdownImageDestinations(text)) {
      const image = this.localImage(destination, true);
      if (image === undefined) continue;
      const key = this.entryKey(image);
      if (this.entries.has(key) || this.pending.has(key)) continue;
      // 工作区未知的本地图片无法定位，直接登记为失败，仍允许展开看到原因。
      if (!image.absolute) {
        this.entries.set(key, { failed: true, reason: 'no_cwd', path: image.raw, retryable: false });
        changed = true;
        continue;
      }
      const controller = new AbortController();
      this.pending.set(key, { key: { path: image.path, mediaType: image.mediaType }, controller });
      this.queue.push(key);
    }
    if (changed) this.notify();
    this.pump();
  }

  /** 只重试暂时读取错误；连续重画不会重试，也不自动重读格式错误或超限文件。 */
  retryText(text) {
    if (this.disposed) return;
    const paths = text === undefined ? [...this.entries.keys()] : markdownImageDestinations(text).map(value => this.key(value, true)?.path);
    for (const path of paths) {
      const entry = this.entries.get(path);
      if (text !== undefined || entry?.reason === 'read') void this.retryPath(path);
    }
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
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw codedError('remote_image_invalid');
      if (bytes.length > this.maxBytes) throw codedError('remote_image_too_large');
      if (this.bytes + bytes.length > this.budget) throw codedError('remote_image_memory_full');
      const url = URL.createObjectURL(new Blob([bytes], { type: key.mediaType }));
      if (this.disposed) { URL.revokeObjectURL(url); return; }
      this.bytes += bytes.length;
      this.entries.set(path, { url, size: bytes.length });
    } catch (error) {
      if (this.disposed || controller.signal.aborted) return;
      const reason = imageFailureReasonFromError(error);
      const retryable = imageFailureReason(reason).retryable;
      this.entries.set(path, { failed: true, reason, path, key, retryable });
      recovered = reason === 'read' && generation !== this.generation && this.isConnected();
    } finally {
      this.pending.delete(path);
      const settle = this.waiters.get(path);
      if (settle !== undefined) { this.waiters.delete(path); settle(true); }
      this.notify();
      if (recovered) void this.retryPath(path);
    }
  }

  /**
   * 重新读取一个失败目标；成功后就绪URL替换失败占位，失败则更新原因。
   * @param {string} destination Markdown 里的图片目标
   * @returns {Promise<boolean>} 是否真正发起了一次重试；发起后无论成功失败都 resolve
   */
  retry(destination) {
    return this.retryPath(this.key(destination, true)?.path);
  }

  retryPath(path) {
    const entry = this.entries.get(path);
    if (this.disposed || !entry?.retryable || this.pending.has(path)) return Promise.resolve(false);
    this.entries.set(path, { ...entry, retrying: true });
    this.pending.set(path, { key: entry.key, controller: new AbortController() });
    this.queue.push(path);
    const completion = new Promise(resolve => { this.waiters.set(path, resolve); });
    this.notify();
    this.pump();
    return completion;
  }

  /**
   * 标记一个已发布URL在浏览器解码失败；同一URL只处理一次。
   * @param {string} url 失败的blob URL
   * @returns {boolean} 是否命中了当前缓存的图片
   */
  decodeFailed(url) {
    if (this.disposed || typeof url !== 'string' || !url.startsWith('blob:')) return false;
    for (const [path, entry] of this.entries) {
      if (entry.url !== url) continue;
      URL.revokeObjectURL(url);
      if (typeof entry.size === 'number') this.bytes = Math.max(0, this.bytes - entry.size);
      this.entries.set(path, { failed: true, reason: 'decode', path, retryable: false });
      this.notify();
      return true;
    }
    return false;
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
    for (const settle of this.waiters.values()) settle(false);
    this.waiters.clear();
    for (const entry of this.entries.values()) if (entry.url !== undefined) URL.revokeObjectURL(entry.url);
    this.entries.clear();
    this.listeners.clear();
    this.bytes = 0;
  }
}
