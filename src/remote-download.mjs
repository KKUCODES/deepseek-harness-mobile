const DOWNLOAD_LIMIT = 256 * 1024 * 1024;

function encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** 复用原文件读取和原生暂存；保存的是本次重新读取的完整字节，绝不使用预览文字或差异。 */
export async function downloadRemoteFile({ files, client, sessionId, path, signal, onProgress = () => {} }) {
  return transferRemoteFile({ files, client, sessionId, path, signal, onProgress }, false);
}

export async function shareRemoteFile(options) { return transferRemoteFile(options, true); }

async function transferRemoteFile({ files, client, sessionId, path, signal, onProgress = () => {} }, share) {
  const callerSignal = signal;
  // 包括读取后的原生暂存确认；原连接已失效时不自动弹出保存或分享窗口。
  signal = files.scopedSignal?.(signal) ?? signal;
  signal.throwIfAborted();
  const name = path.split(/[\\/]/).at(-1)?.slice(0, 180) || 'download';
  const { downloadId } = await client.call('file.begin', { name });
  if (typeof downloadId !== 'string' || !downloadId) throw new Error('download_failed');
  const abort = () => { void client.call('file.abort', { downloadId }).catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  let bytes = 0;
  try {
    signal.throwIfAborted();
    onProgress({ phase: 'reading', bytes });
    for await (const chunk of files.read(sessionId, path, signal, { maxBytes: DOWNLOAD_LIMIT })) {
      signal.throwIfAborted();
      if (chunk.length) {
        const result = await client.call('file.chunk', { downloadId, offset: bytes, data: encode(chunk) });
        if (result.bytes !== bytes + chunk.length) throw new Error('download_incomplete');
        bytes += chunk.length;
      }
      signal.throwIfAborted(); onProgress({ phase: 'reading', bytes });
    }
    signal.throwIfAborted();
    await client.call('file.finish', { downloadId, bytes });
    signal.throwIfAborted(); onProgress({ phase: share ? 'sharing' : 'saving', bytes });
    // 系统保存窗口由用户选择位置，需要比普通桥调用更长的交互时间。
    const result = await client.call(share ? 'file.share' : 'file.save', { downloadId }, 300000);
    // Android 只能确认分享面板已打开，无法保证接收 App 已发送或保存。
    // 原生已确认交付后，迟到的取消不能把已发生的操作描述为未发生。
    if (share && result.opened === true) return { opened: true, bytes };
    if (!share && result.saved === true) return { saved: true, bytes };
    signal.throwIfAborted();
    throw new Error('download_failed');
  } catch (error) {
    // 目标位置已存在半成品时，迟到的取消或断线不能掩盖原生清理失败。
    if (error.message === 'download_cleanup_failed') throw error;
    if (signal.aborted && !callerSignal.aborted) throw new Error('remote_file_connection_changed', { cause: error });
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    await client.call('file.abort', { downloadId }).catch(() => {});
  }
}

export function downloadError(error, action = '下载') {
  if (error.message === 'download_cleanup_failed') return '保存未完成，目标位置可能留有不完整文件，请检查后重新下载。';
  if (error.name === 'AbortError' || error.message === 'download_canceled') return `已取消${action}。`;
  if (['remote_file_preview_too_large', 'download_too_large'].includes(error.message)) return `文件超过当前 256 MiB ${action}上限。`;
  if (error.message === 'remote_file_changed') return `${action}时文件发生变化，请重新${action}。`;
  if (error.code === 'workspace-file/not-found') return `文件已被删除或移动，无法${action}。`;
  if (error.message === 'share_cache_full') return '分享暂存空间已满，请稍后再试，或下载文件后从文件管理器分享。';
  if (['download_busy', 'picker_busy'].includes(error.message)) return '请先完成或取消当前保存操作。';
  return `${action}未完成，请检查连接、文件权限和手机存储后重试。`;
}
