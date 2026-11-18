/** 思考块没有正文时与原渲染器一致不生成行；否则会落进未知块的兜底展示。 */
export function visibleAssistantBlock(block) {
  return block.kind !== 'reasoning' || block.text.trim() !== '';
}

/** 除工具头外是否还有可显示的正文；运行中与已中断的回复仍保留状态提示。 */
export function assistantHasVisibleContent(blocks) {
  return blocks.some(block => block.kind !== 'tool-call' && visibleAssistantBlock(block));
}
