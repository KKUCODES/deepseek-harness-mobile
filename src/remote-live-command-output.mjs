import { RemoteLiveJobOutput } from './remote-live-job-output.mjs';
import { commandOutputTarget } from './remote-commands.mjs';

/** 共用有界字节读取/解码/取消；前台身份来自原工具，不注册或伪装为后台任务。 */
export class RemoteLiveCommandOutput extends RemoteLiveJobOutput {
  constructor(model, target, stream = 'stdout', mode = 'live', resume) {
    super(model, target, stream, mode, resume);
    this.outputId = resume?.outputId;
  }
  checkpoint() { return { ...super.checkpoint(), outputId: this.outputId }; }
  currentGeneration() { return this.model.transport.capabilities?.commandOutputGeneration; }
  get unsupportedText() { return '这条命令未提供实时输出，可查看执行结果。'; }
  operation() {
    return { method: 'remote.commandOutput', sessionId: this.target.sessionId, rootCallId: this.target.rootCallId,
      rootCallTime: this.target.rootCallTime, callId: this.target.callId, generation: this.generation,
      ...(this.outputId ? { outputId: this.outputId } : {}), stream: this.stream, fromByte: this.snapshot.offset, maxBytes: 65536 };
  }
  acceptIdentity(result) {
    if (typeof result.outputId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.outputId)
      || this.outputId && result.outputId !== this.outputId) throw Error('remote_command_stale');
    this.outputId = result.outputId;
  }
  valid(resume = false) {
    const state = this.model.getSnapshot();
    if (state.connectionState !== 'connected') return '连接已断开，恢复连接后可继续读取。';
    if (!this.currentGeneration()) return '电脑暂不支持前台实时输出，可查看执行结果。';
    const current = commandOutputTarget(state, this.target);
    if (state.session?.openState !== 'open' || !current || current.rootCallId !== this.target.rootCallId
      || current.rootCallTime !== this.target.rootCallTime || this.generation !== this.currentGeneration()) return '命令已变化，请重新打开命令详情。';
    const connection = this.model.connection.generation.getSnapshot()?.id;
    if (connection === undefined || this.connection !== connection && !resume) return '连接已变化，请重新读取输出。';
    if (resume) this.connection = connection;
    return null;
  }
}
