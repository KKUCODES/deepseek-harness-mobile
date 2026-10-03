import { parseFileAddress } from '../../deepseek-harness/packages/util/workspace-path/src/file-address.ts';

export const ATTACHMENT_DOCUMENT_PROTOCOL = 'dshm-attachment';
const prefix = `dsh-resource://${ATTACHMENT_DOCUMENT_PROTOCOL}/`;

/** 附件地址只有身份，没有磁盘路径；显示名始终编码为单独一段。 */
export function attachmentDocumentAddress(file) {
  const ref = file?.attachment;
  if (typeof file?.sessionId !== 'string' || !file.sessionId || file.sessionId.length > 200
    || !['file', 'image'].includes(ref?.kind) || typeof ref.attachmentId !== 'string'
    || !ref.attachmentId || ref.attachmentId.length > 512
    || typeof file.path !== 'string' || !file.path || file.path.length > 255
    || (ref.kind === 'file' && ref.name !== file.path)) throw new Error('remote_attachment_invalid');
  return prefix + [file.sessionId, ref.kind, ref.attachmentId, file.path].map(encodeURIComponent).join('/');
}

export function parseAttachmentDocumentAddress(address) {
  if (typeof address !== 'string' || !address.startsWith(prefix)) return undefined;
  try {
    const parts = address.slice(prefix.length).split('/').map(decodeURIComponent);
    if (parts.length !== 4) return undefined;
    const [sessionId, kind, attachmentId, path] = parts;
    const file = { sessionId, path, attachment: { kind, attachmentId, ...(kind === 'file' ? { name: path } : {}) } };
    // 拒绝非规范编码，防止同一引用以不同URL绕过标签身份与读取并发限制。
    return attachmentDocumentAddress(file) === address ? file : undefined;
  } catch { return undefined; }
}

/** 原文件地址保持原语义；新增附件分支绝不落到workspaceFiles。 */
export function resolveDocumentAddress(address) {
  const attachment = parseAttachmentDocumentAddress(address);
  if (attachment) return attachment;
  const file = parseFileAddress(address);
  if (file?.scope !== 'session') throw new Error('remote_document_address_invalid');
  return { sessionId: file.sessionId, path: file.path };
}
