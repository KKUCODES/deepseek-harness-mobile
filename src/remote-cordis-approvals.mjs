/** 只投影原运行器的待审批状态；批准与拒绝仍由原 CordisPanel 执行。 */
export function installRemoteCordisApprovals(model) {
  model.ctx.inject(['dynamicCordisRunner'], ctx => {
    const source = ctx.dynamicCordisRunner.activeRuns;
    const refresh = () => model.publish({ cordisApprovals: [...source.getSnapshot().values()]
      .filter(value => value.phase === 'awaiting-approval')
      .map(({ requestId, agentId, name }) => ({ requestId, agentId, name })) });
    ctx.effect(() => source.subscribe(refresh));
    ctx.effect(() => () => model.publish({ cordisApprovals: [] }));
    refresh();
  });
}
