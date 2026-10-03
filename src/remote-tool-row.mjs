import { toolRowModel } from '../../deepseek-harness/packages/client/ui-tool/src/client/tool/models/tool-call-model.ts';

/** 只依据Host持久结果，取消前未执行与执行中停止不能混为同一承诺。 */
export function remoteToolCancellation(tool) {
  if (tool.kind !== 'tool-result' || !tool.isError) return null;
  if (tool.error?.code === 'ABORTED_BEFORE_DISPATCH') return '已取消，工具尚未执行';
  if (tool.error?.code === 'ABORTED' || tool.error?.code === 'interrupted') return '工具调用已停止';
  return null;
}

export function remoteToolVisibleContent(tool) {
  if (!remoteToolCancellation(tool)) return tool.content ?? [];
  // 只移除原运行时两条固定取消诊断，部分输出及附件仍保留。
  return (tool.content ?? []).filter(block => block.type !== 'text'
    || !['Error: tool call aborted', 'Error: tool call aborted before dispatch'].includes(block.text));
}

/** Host tools 的取消码与 ui-chat 合成的 interrupted 均表示停止；不从错误正文猜测。 */
export function remoteToolRow(toolName, tool) {
  const row = toolRowModel(toolName, tool);
  // 对应上游 packages/core/tools/src/index.ts，避免把 Host 工具运行时打进手机。
  const aborted = remoteToolCancellation(tool) !== null;
  return aborted ? { ...row, state: 'stopped', errorSummary: null } : row;
}
