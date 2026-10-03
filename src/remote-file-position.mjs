/** 行号沿用原 DSH 的 1-based 契约，不把无效值强行转成另一个位置。 */
export const fileLine = value => Number.isSafeInteger(value) && value > 0 ? value : undefined;

/** 只切出目标行，避免对最大 2 MiB 文本为每一行创建 DOM。保留原始换行字节。 */
export function fileLineRange(text, requested) {
  const line = fileLine(requested);
  if (line === undefined) return null;
  let start = 0;
  for (let current = 1; current < line; current++) {
    const newline = text.indexOf('\n', start);
    if (newline === -1) return null;
    start = newline + 1;
  }
  let end = text.indexOf('\n', start);
  if (end === -1) end = text.length;
  if (end > start && text[end - 1] === '\r') end--;
  return { start, end };
}
