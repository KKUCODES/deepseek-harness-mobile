export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const fail = code => { throw new Error(code); };

/** 持久化和导入共用字段白名单；不接受外部 URL、本地路径或可执行内容。 */
export function cleanAttachment(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id || value.id.length > 80 ||
      typeof value.name !== 'string' || !value.name || value.name.length > 200 ||
      !Number.isSafeInteger(value.size) || value.size < 0 || value.size > MAX_IMAGE_BYTES ||
      !['photo', 'file'].includes(value.source)) fail('invalid_attachment');
  const base = { id: value.id, name: value.name, size: value.size, source: value.source, kind: value.kind };
  if (value.kind === 'text') {
    if (typeof value.text !== 'string' || value.text.length > 100000 || value.text.includes('\0')) fail('invalid_attachment');
    return { ...base, mime: 'text/plain', text: value.text };
  }
  if (value.kind !== 'image' || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(value.mime) ||
      typeof value.data !== 'string' || value.data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32 ||
      !value.data.startsWith(`data:${value.mime};base64,`)) fail('invalid_attachment');
  const encoded = value.data.slice(value.data.indexOf(',') + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) fail('invalid_attachment');
  let bytes;
  try { bytes = atob(encoded); } catch { fail('invalid_attachment'); }
  if (bytes.length !== value.size) fail('invalid_attachment');
  const starts = values => values.every((byte, index) => bytes.charCodeAt(index) === byte);
  const valid = value.mime === 'image/png' ? starts([137, 80, 78, 71, 13, 10, 26, 10]) :
    value.mime === 'image/jpeg' ? starts([255, 216, 255]) :
    value.mime === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(bytes.slice(0, 6)) : bytes.slice(0, 4) === 'RIFF' && bytes.slice(8, 12) === 'WEBP';
  if (!valid) fail('invalid_attachment');
  return { ...base, mime: value.mime, data: value.data };
}

export function cleanAttachments(values = []) {
  if (!Array.isArray(values) || values.length > MAX_ATTACHMENTS) fail('attachment_limit');
  const clean = values.map(cleanAttachment);
  if (new Set(clean.map(value => value.id)).size !== clean.length) fail('invalid_attachment');
  return clean;
}

export function userContent(prompt, attachments = [], model) {
  const clean = cleanAttachments(attachments);
  const images = clean.filter(value => value.kind === 'image');
  if (images.length && model !== 'deepseek-flash') fail('model_no_vision');
  const text = [prompt, ...clean.filter(value => value.kind === 'text').map(value => `附件：${value.name}\n${value.text}`)].filter(Boolean).join('\n\n');
  if (text.length > 100000) fail('context_limit');
  if (!images.length) return text;
  return [...(text ? [{ type: 'text', text }] : []), ...images.map(value => ({ type: 'image_url', image_url: { url: value.data } }))];
}
