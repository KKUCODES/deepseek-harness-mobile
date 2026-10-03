import { fileError } from './remote-files.mjs';

export const DOCUMENT_BYTES = 32 * 1024 * 1024;

/** 完整字节预览仍走已授权的小块读取；版本核对完成前不向原预览器交付。 */
export async function readDocumentBytes(model, file, signal) {
  try {
    const value = await model.files.document(file.sessionId, file.path, signal, { maxBytes: DOCUMENT_BYTES });
    return { ok: true, value: { ...value, offset: 0, eof: true } };
  } catch (error) {
    if (signal.aborted) throw error;
    if (error.code?.startsWith('workspace-file/')) return { ok: false, error };
    return { ok: false, error: {
      code: error.message === 'remote_file_preview_too_large' ? 'workspace-file/too-large' : 'gateway/internal',
      message: fileError(error), details: { path: file.path, limit: DOCUMENT_BYTES },
    } };
  }
}
