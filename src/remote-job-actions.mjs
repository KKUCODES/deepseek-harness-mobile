/** 停止单个后台任务；结果由原控制流回传，不把接收请求等同于进程已退出。 */
export class RemoteJobActions {
  pending = new Set();
  uncertain = new Map();
  constructor(model) { this.model = model; }
  key(sessionId, job) { return `${sessionId}:${job.id}:${job.startedAt}`; }
  get available() { return typeof this.model.transport.capabilities?.jobControlGeneration === 'string'; }
  async stop(sessionId, job) {
    const model = this.model, state = model.getSnapshot(), key = this.key(sessionId, job);
    const generation = model.connection.generation.getSnapshot()?.id;
    if (!this.available || generation === undefined || state.connectionState !== 'connected') throw new Error('请连接支持停止后台任务的电脑。');
    if (this.pending.has(key)) throw new Error('正在请求停止，请稍候。');
    if (this.uncertain.get(key) === generation) throw new Error('停止结果尚未确认，请重新连接并核对任务状态。');
    const current = state.list?.jobsBySession[sessionId]?.find(item => item.id === job.id);
    if (state.selected !== sessionId || state.session?.openState !== 'open' || !current
      || current.startedAt !== job.startedAt || current.status !== 'running') throw new Error('任务状态已变化，请重新查看。');
    this.pending.add(key); model.publish();
    try {
      const result = await model.client.request({ method: 'remote.jobStop', sessionId, jobId: job.id,
        startedAt: job.startedAt, generation: model.transport.capabilities.jobControlGeneration }).promise;
      if (!['requested', 'already-stopping', 'already-finished'].includes(result?.status)) throw new Error('invalid_stop_result');
      return result.status;
    } catch (error) {
      if (['remote_job_stale', 'remote_job_missing', 'remote_job_session_closed'].includes(error.message)) throw new Error('电脑上的任务已变化，请重新查看。');
      if (error.message === 'remote_job_control_unavailable') throw new Error('电脑暂不支持停止后台任务，请重新连接。');
      this.uncertain.set(key, generation);
      throw new Error('停止结果尚未确认，请重新连接并核对任务状态。');
    } finally { this.pending.delete(key); model.publish(); }
  }
}
