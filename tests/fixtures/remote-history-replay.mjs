/** 按请求 cut 生成连续的旧事件；不预先在手机中构造整段超长历史。 */
export class RemoteHistoryReplay {
  active = false;
  calls = 0;
  latest = 10000;
  setup({ turns = 2000, paragraphs = 60, sessionId = 'one' } = {}) { this.active = true; this.sessionId = sessionId; this.latest = turns * 5 - 1; this.paragraphs = paragraphs; this.calls = 0; }
  records(first, last) {
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
      const seq = first + index, turn = Math.floor(seq / 5) + 1;
      const types = ['turn/start', 'step/start', 'assistant/message', 'step/end', 'turn/end'];
      const type = types[seq % 5];
      const data = type === 'assistant/message' ? { turn, step: 1, stream: [], message: { id: `history-${turn}`, role: 'assistant',
        content: [{ type: 'text', text: `HISTORY_${turn}\n\n` + '**记录**：保留项目文件、操作和历史。\n\n'.repeat(this.paragraphs) }],
        source: { kind: 'model', provider: 'fixture', model: 'fixture' } } } : type === 'turn/end' ? { turn, reason: { kind: 'completed' } } : { turn, step: 1 };
      return { type: 'event', event: { seq, time: seq, type, data, ...(type === 'assistant/message' ? { surfaceOp: 'append' } : {}) } };
    });
  }
  snapshot() { return { cursor: this.latest, records: this.records(this.latest - 99, this.latest), hasMore: this.latest >= 100 }; }
  async page(request) {
    this.calls++;
    if (this.gate) await this.gate;
    if (this.fail) return { ok: false, error: { code: 'fixture/history', message: 'fixture history read failed' } };
    const end = Math.min(request.throughSeq, (request.beforeSeq ?? request.throughSeq + 1) - 1);
    const first = Math.max(0, Math.floor((end - 59) / 5) * 5);
    return { ok: true, value: { records: this.records(first, end), hasMore: first > 0 } };
  }
  hold() { this.gate = new Promise(resolve => { this.release = () => { this.gate = null; resolve(); }; }); }
}
