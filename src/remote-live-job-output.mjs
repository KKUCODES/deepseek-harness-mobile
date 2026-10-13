import { RemoteOutputAnsi } from './remote-output-ansi.mjs';
import { remoteJobs } from './remote-jobs.mjs';

const live = status => status === 'running' || status === 'stopping';
const LIMIT = 65536;
const WINDOW = 128 * 1024;

/** 每个打开的输出页有独立游标；离开、断线或任务身份变化后取消在途只读请求。 */
export class RemoteLiveJobOutput {
  listeners = new Set();
  snapshot = { text: '', phase: 'idle', offset: 0, total: 0, gap: false, trimmed: false, status: 'running' };
  decoder = new TextDecoder();
  ansi = new RemoteOutputAnsi();
  task = null;
  timer = null;
  disposed = false;
  constructor(model, target, stream = 'stdout', mode = 'live', resume) {
    this.model = model; this.target = target; this.stream = stream; this.mode = mode;
    this.generation = this.currentGeneration();
    this.connection = model.connection.generation.getSnapshot()?.id;
    if (resume) {
      this.generation = resume.generation;
      this.decoder = resume.decoder;
      this.ansi = resume.ansi ?? new RemoteOutputAnsi();
      // 旧客户端的内存交接尚无显示状态；从已保留文本恢复，避免 EOF 空读清空原内容。
      const display = resume.ansi ? {} : this.ansi.append(resume.snapshot.text, { limit: WINDOW });
      // 页面交接仅暂停读取；连接和任务是否有效由 start/retry 重新核验。
      this.snapshot = { ...resume.snapshot, ...display, phase: 'paused', error: '' };
      this.resumed = true;
    }
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  currentGeneration() { return this.model.transport.capabilities?.jobControlGeneration; }
  coordinates() { return this.model.transport.capabilities?.jobOutputCoordinates === 'ring' ? 'ring' : 'channel'; }
  operation() {
    return { method: 'remote.jobOutput', sessionId: this.target.sessionId, jobId: this.target.id,
      startedAt: this.target.startedAt, generation: this.generation, stream: this.stream,
      fromByte: this.snapshot.offset, maxBytes: LIMIT };
  }
  acceptIdentity(_result) {}
  deferReadError(_error) { return false; }
  get unsupportedText() { return '这个任务未提供独立输出，可以查看聊天中的输出记录。'; }
  getSnapshot = () => this.snapshot;
  publish(patch) { if (!this.disposed) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); } }
  valid(resume = false) {
    const model = this.model, state = model.getSnapshot();
    if (state.connectionState !== 'connected') return '连接已断开，恢复连接后可继续读取。';
    const current = remoteJobs(state, this.target.sessionId).find(job => job.id === this.target.id);
    if (state.selected !== this.target.sessionId || state.session?.openState !== 'open' || !current || current.startedAt !== this.target.startedAt
      || this.generation !== model.transport.capabilities?.jobControlGeneration) return '任务已变化，请返回任务列表重新查看。';
    if (model.transport.capabilities?.jobOutput !== true) return '电脑暂不支持独立读取输出。';
    const connection = model.connection.generation.getSnapshot()?.id;
    if (connection === undefined || this.connection !== connection && !resume) return '连接已变化，请重新读取输出。';
    // 只允许用户在同一 Host 代次、同一任务仍存在时恢复已确认游标，不重放旧请求。
    if (resume) this.connection = connection;
    return null;
  }
  start() {
    this.unsubscribe = this.model.subscribe(() => {
      const error = this.valid();
      if (error) { this.stop(); this.publish({ phase: 'error', error }); }
    });
    if (this.resumed) {
      const error = this.valid();
      if (error) this.publish({ phase: 'error', error });
    } else void this.read();
  }
  // 仅在旧 reader 随页面卸载后交给新 reader，保留 UTF-8 尾字节和 ANSI 状态，不携带请求或凭据。
  checkpoint() { return { generation: this.generation, decoder: this.decoder, ansi: this.ansi, snapshot: { ...this.snapshot } }; }
  stop() { clearTimeout(this.timer); this.timer = null; this.task?.cancel(); this.task = null; }
  dispose() { this.disposed = true; this.stop(); this.unsubscribe?.(); this.listeners.clear(); }
  retry() {
    if (this.disposed || this.task) return;
    const error = this.valid(true);
    if (error) { this.publish({ phase: 'error', error }); return; }
    return this.read();
  }
  async read() {
    if (this.disposed || this.task) return;
    clearTimeout(this.timer); this.timer = null;
    const invalid = this.valid();
    if (invalid) { this.publish({ phase: 'error', error: invalid }); return; }
    this.publish({ phase: 'reading', error: '' });
    let task = null;
    try {
      task = this.model.client.request(this.operation());
      this.task = task;
      const result = await task.promise;
      if (this.disposed || this.task !== task || this.valid()) return;
      if (!result || !['running', 'stopping', 'completed', 'killed', 'failed'].includes(result.status)) throw Error('invalid_output');
      this.acceptIdentity(result);
      if (result.state === 'unsupported') { this.publish({ phase: 'unsupported', error: this.unsupportedText }); return; }
      if (result.state === 'pending') { this.publish({ phase: 'waiting', status: result.status }); }
      else {
        if (result.state !== 'available' || typeof result.data !== 'string' || result.data.length > 87384
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.data)
          || ![result.startOffset, result.nextOffset, result.totalBytes].every(n => Number.isSafeInteger(n) && n >= 0)
          || result.startOffset < this.snapshot.offset || result.nextOffset < result.startOffset || result.nextOffset > result.totalBytes
          || typeof result.lossy !== 'boolean' || result.lossy !== (result.startOffset > this.snapshot.offset)) throw Error('invalid_output');
        const raw = atob(result.data), bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
        const ring = this.coordinates() === 'ring';
        if (bytes.length > LIMIT || result.nextOffset - result.startOffset > LIMIT && ring) throw Error('invalid_output');
        if (ring) {
          if (result.coordinate !== 'ring' || !Number.isSafeInteger(result.skippedBytes) || result.skippedBytes < 0
            || typeof result.producerGap !== 'boolean' || bytes.length + result.skippedBytes !== result.nextOffset - result.startOffset) throw Error('invalid_output');
        } else if (result.coordinate === 'ring' || bytes.length !== result.nextOffset - result.startOffset) throw Error('invalid_output');
        const gap = result.lossy || ring && result.producerGap;
        if (gap) this.decoder = new TextDecoder();
        const atEnd = !live(result.status) && result.nextOffset === result.totalBytes;
        const text = this.decoder.decode(bytes, { stream: !atEnd });
        const combined = this.mode === 'history' ? (!bytes.length && !text && !gap ? this.snapshot.text : text)
          : this.snapshot.text + (gap ? '\n…部分输出已丢失…\n' : '') + text;
        const retained = combined.length > WINDOW ? combined.slice(-WINDOW).replace(/^[\uDC00-\uDFFF]/u, '') : combined;
        const display = this.ansi.append(text, { history: this.mode === 'history', gap, end: atEnd,
          preserve: !bytes.length && !text, limit: WINDOW });
        this.publish({ text: retained, ...display, offset: result.nextOffset,
          total: result.totalBytes, gap: this.snapshot.gap || gap, trimmed: this.snapshot.trimmed || combined.length > WINDOW,
          status: result.status, phase: atEnd ? 'ended' : 'ready' });
      }
      if (this.mode === 'live') this.timer = setTimeout(() => void this.read(), this.snapshot.offset < this.snapshot.total ? 40 : 750);
      if (this.snapshot.phase === 'ended') { clearTimeout(this.timer); this.timer = null; }
    } catch (error) {
      if (!this.disposed && this.task === task && !this.valid() && this.deferReadError(error)) return;
      if (!this.disposed && this.task === task) this.publish({ phase: 'error', error: error.message?.startsWith('remote_command_')
        ? '电脑已不再提供这条命令的实时输出，可查看执行结果。' : error.message?.startsWith('remote_job_')
          ? '电脑上的任务或输出已变化，请返回任务列表重新查看。' : '读取输出失败，请检查连接后重试。' });
    } finally { if (this.task === task) this.task = null; }
  }
}
