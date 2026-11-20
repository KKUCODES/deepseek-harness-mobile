const statusPrefix = /^\s*(?:http\s*)?([1-5]\d{2})\s*:?\s*/i;

/**
 * 解析本轮失败的原始错误文本，提取可读消息、HTTP 状态码和原始内容。
 * @param {unknown} message 电脑端记录的失败原文
 * @returns {{ raw: string, message: string, status: string, extracted: boolean }} 原文、可读消息、状态码以及是否成功提取消息
 */
export function turnErrorDetail(message) {
  const raw = typeof message === 'string' ? message : '';
  const prefix = statusPrefix.exec(raw);
  const body = raw.slice(prefix?.[0].length ?? 0).trim();
  // 只有整段剩余内容是 JSON 时才解析，避免把普通错误文本中的花括号误当作结构化错误。
  if (!body.startsWith('{') || !body.endsWith('}')) return { raw, message: raw, status: '', extracted: false };
  let payload;
  try { payload = JSON.parse(body); } catch { return { raw, message: raw, status: '', extracted: false }; }
  const text = payloadMessage(payload);
  if (!text) return { raw, message: raw, status: prefix?.[1] ?? '', extracted: false };
  return { raw, message: text, status: prefix?.[1] ?? '', extracted: true };
}

/**
 * 从供应方错误载荷中读取可读消息。
 * @param {unknown} payload 解析后的错误对象
 * @returns {string} 去掉首尾空白的消息，缺失时返回空字符串
 */
function payloadMessage(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const direct = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (direct) return direct;
  const error = payload.error;
  if (typeof error === 'string') return error.trim();
  return error && typeof error === 'object' && typeof error.message === 'string' ? error.message.trim() : '';
}