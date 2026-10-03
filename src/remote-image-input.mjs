import { MAX_UPLOAD_BYTES } from '../../backend/packages/protocol/dist/index.js';

const formats = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
/** 文件选择器可能没有 MIME；这里只选择声明，真实格式/尺寸仍由 DSH 解码校验。 */
export function inputImageType(file, requireImage = false) {
  const type = Object.values(formats).includes(file.type) ? file.type : formats[file.name?.split('.').at(-1)?.toLowerCase()];
  if (!type && requireImage) throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
  return type;
}

export async function imagePromptPart(item, signal) {
  signal.throwIfAborted();
  // 提前挡住显然无法装入传输正文的源文件，避免不必要的 base64 分配。
  if (Math.ceil(item.bytes / 3) * 4 > MAX_UPLOAD_BYTES) throw new Error('图片过大，请选择较小的图片。');
  const bytes = new Uint8Array(await item.source.arrayBuffer());
  signal.throwIfAborted();
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return { type: 'image', mediaType: item.mediaType, name: item.name, data: btoa(binary) };
}
