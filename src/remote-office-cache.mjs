import { OfficePreviewCache } from '../../deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/office/cache.ts';
import { readOffice } from './remote-office.mjs';
import { attachmentDocumentAddress } from './remote-document-address.mjs';

/** 复用原 Office 缓存；每次命中仍向 Host 核验读取权限、文件版本和转换器代次。 */
export function createRemoteOfficeReader(model) {
  const { ctx, transport } = model;
  const convert = async (file, signal, priority) => {
    const value = await readOffice(model, file.sessionId, file.path, signal, file.attachment, priority);
    return { ok: true, value: file.attachment ? { ...value, version: attachmentDocumentAddress(file) } : value };
  };
  const create = () => new OfficePreviewCache(async (file, signal) => {
    const authorized = await model.remote.workspaceFiles.readBytes(file.sessionId, file.path, { offset: 0, length: 1 }, signal);
    signal.throwIfAborted();
    if (!authorized.ok) return authorized;
    const stat = await model.remote.workspaceFiles.stat(file.sessionId, file.path, signal);
    signal.throwIfAborted();
    if (stat.ok && (stat.value.absolutePath !== authorized.value.absolutePath || stat.value.version !== authorized.value.version))
      throw new Error('remote_file_changed');
    return stat;
  }, convert, 8, 64 * 1024 * 1024, 2, 8, async signal => {
    const result = await transport.call('/api', 'officeToPdf/generation', { args: {} }, signal);
    signal.throwIfAborted();
    if (result.ok && (typeof result.value !== 'string' || !result.value.length || result.value.length > 200))
      throw new Error('remote_office_invalid');
    return result;
  }, () => new Error('remote_office_busy'));
  let cache = create(), generation = transport.generation;
  const retired = new Set();
  const reset = () => {
    const previous = cache;
    cache = create(); generation = transport.generation;
    const closing = previous.dispose().finally(() => retired.delete(closing));
    retired.add(closing);
  };
  // 普通中继断线也废弃缓存，不只等原客户端 connection/reset。
  const unsubscribe = model.client.subscribe(frame => { if (frame.type === 'closed' || frame.type === 'ready') reset(); });
  ctx.on('connection/reset', reset);
  ctx.effect(() => async () => { unsubscribe(); await Promise.all([...retired, cache.dispose()]); });
  return async (file, signal, priority = 'foreground') => {
    signal = AbortSignal.any([signal, ...[model.lifetime?.signal, transport.lifetime?.signal].filter(Boolean)]);
    signal.throwIfAborted();
    if (generation !== transport.generation) reset();
    // 附件没有原文件 stat 契约，继续每次核验原引用并使用电脑转换队列的缓存。
    if (file.attachment || !transport.capabilities?.endpoints?.calls?.includes('officeToPdf/generation'))
      return convert(file, signal, priority);
    return cache.read(file, signal, priority);
  };
}
