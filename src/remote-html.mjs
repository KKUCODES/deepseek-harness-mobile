/** 与 Host readRelated 同样使用原文件目录；最终规范化及权限检查仍交给 Host。 */
export function htmlRelatedPath(absolute, reference) {
  const suffix = reference.search(/[?#]/u);
  const path = decodeURIComponent(suffix === -1 ? reference : reference.slice(0, suffix));
  if (!path || /^(?:[a-z][a-z\d+.-]*:|[/\\])/iu.test(path) || path.includes('\0') || path.includes('\\')) throw new Error('html_relative_invalid');
  if (!/^(?:\/|[a-z]:[/\\]|\\\\)/iu.test(absolute)) throw new Error('remote_file_invalid');
  const cut = Math.max(absolute.lastIndexOf('/'), absolute.lastIndexOf('\\'));
  return absolute.slice(0, cut + 1) + path;
}

/** 原生层给独立沙箱提供文档响应；不向 HTML 暴露 Host 回调或 Remote 桥。 */
export async function stageHtml(client, html, signal) {
  const bytes = new TextEncoder().encode(html);
  if (bytes.length > 64 * 1024 * 1024) throw new Error('remote_file_preview_too_large');
  signal.throwIfAborted();
  const { previewId } = await client.call('html.begin');
  if (typeof previewId !== 'string' || !/^[0-9a-f-]{36}$/.test(previewId)) throw new Error('html_failed');
  const release = () => { void client.call('html.close', { previewId }).catch(() => {}); };
  signal.addEventListener('abort', release, { once: true });
  try {
    signal.throwIfAborted();
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      const chunk = bytes.subarray(offset, offset + 65536);
      let binary = ''; for (const byte of chunk) binary += String.fromCharCode(byte);
      const result = await client.call('html.chunk', { previewId, offset, data: btoa(binary) });
      signal.throwIfAborted();
      if (result.bytes !== offset + chunk.length) throw new Error('html_failed');
    }
    const { url } = await client.call('html.finish', { previewId, bytes: bytes.length });
    signal.throwIfAborted();
    if (url !== `https://preview.dshm.invalid/document/${previewId}.html`) throw new Error('html_failed');
    return { url, dispose() { signal.removeEventListener('abort', release); release(); } };
  } catch (error) { signal.removeEventListener('abort', release); release(); throw error; }
}
