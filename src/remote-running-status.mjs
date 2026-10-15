/** 用电脑记录的最近开放轮次起点计时；缺失边界时不以手机挂载时间冒充开始时间。 */
export function runningTurnStartTime(timeline) {
  let start;
  for (const turn of timeline?.turns.values() ?? []) {
    if (turn.status === 'open') start = Number.isFinite(turn.start?.time) ? turn.start.time : undefined;
  }
  return start;
}
