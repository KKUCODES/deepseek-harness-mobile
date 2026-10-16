import { createParser } from 'eventsource-parser';

export class StreamFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = code => { throw new StreamFailure(code); };
const aborted = () => new DOMException('Request stopped', 'AbortError');
const cancelBody = body => { if (body && !body.locked) void body.cancel().catch(() => {}); };

/** 只解析公开 Chat Completions 字节协议；不持有 Key、不请求 Host、不重连。 */
export async function* readCompletionEvents(body, signal) {
  if (!body) fail('missing_response_body');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let events = [];
  let trailingCR = false;
  const parser = createParser({
    maxBufferSize: 1024 * 1024,
    onEvent: event => {
      if (event.data.length > 1024 * 1024) fail('event_too_large');
      events.push(event);
    },
    onError: error => { if (error.type === 'max-buffer-size-exceeded') fail('event_too_large'); },
  });
  const stop = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', stop, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw aborted();
      const chunk = await reader.read();
      if (signal.aborted) throw aborted();
      let text;
      try { text = decoder.decode(chunk.value, { stream: !chunk.done }); }
      catch { fail('invalid_utf8'); }
      if (text) trailingCR = text.endsWith('\r');
      parser.feed(text);
      // 3.1.0 会保留尾部 CR 等待可能的 LF。EOF 时配成 CRLF，只结算已有换行；
      // 不对其他残片补换行，否则会把尚未结束的事件误认为完整响应。
      if (chunk.done && trailingCR) parser.feed('\n');
      for (const event of events) {
        if (signal.aborted) throw aborted();
        if (event.event && event.event !== 'message') fail('unexpected_event');
        yield event.data;
        if (event.data === '[DONE]') return;
      }
      events = [];
      // 不补齐未终止事件，也不把连接关闭当成正常完成。
      if (chunk.done) fail('stream_closed');
    }
  } finally {
    signal.removeEventListener('abort', stop);
    stop();
    reader.releaseLock();
  }
}

const active = status => status === 'sending' || status === 'streaming';
const terminalReasons = new Set(['stop', 'length', 'content_filter', 'tool_calls', 'insufficient_system_resource', 'aborted']);

/** 一个实例只拥有一次普通聊天请求；切换页面不能改写归属，停止后不接收迟到分片。 */
export class OrdinaryTurn {
  #state;
  #listeners = new Set();
  #abort = new AbortController();
  #disposed = false;

  constructor({ mode, chatId, requestId }) {
    if (mode !== 'ordinary' || ![chatId, requestId].every(value => typeof value === 'string' && value.length > 0)) {
      throw new Error('invalid_ordinary_turn_owner');
    }
    this.#state = Object.freeze({ mode, chatId, requestId, status: 'idle', content: '', reasoning: '',
      responseId: null, finishReason: null, usage: null, error: null });
  }

  getSnapshot = () => this.#state;
  subscribe = listener => {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #publish(patch) {
    this.#state = Object.freeze({ ...this.#state, ...patch });
    for (const listener of this.#listeners) listener();
  }

  stop() {
    if (!active(this.#state.status)) return;
    this.#publish({ status: 'interrupted', error: 'stopped' });
    this.#abort.abort();
  }

  dispose() { this.stop(); this.#disposed = true; this.#listeners.clear(); }

  async run(openResponse) {
    if (this.#disposed || this.#state.status !== 'idle') throw new Error('turn_already_used');
    this.#publish({ status: 'sending' });
    const signal = this.#abort.signal;
    let rejectOnAbort;
    const stopped = new Promise((_, reject) => { rejectOnAbort = () => reject(aborted()); });
    signal.addEventListener('abort', rejectOnAbort, { once: true });
    // 受控 transport 由后续平台层提供。即使它晚返回，已停止的请求也只会关闭 body。
    const pending = Promise.resolve().then(() => {
      if (signal.aborted) throw aborted();
      return openResponse(signal);
    });
    void pending.then(response => { if (signal.aborted) cancelBody(response.body); }, () => {});
    try {
      const response = await Promise.race([pending, stopped]);
      if (signal.aborted) { cancelBody(response.body); throw aborted(); }
      if (!response.ok) { cancelBody(response.body); fail(`http_${response.status}`); }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
        cancelBody(response.body); fail('unexpected_content_type');
      }
      for await (const data of readCompletionEvents(response.body, signal)) {
        if (!active(this.#state.status)) break;
        if (data === '[DONE]') {
          if (!this.#state.finishReason) fail('missing_finish_reason');
          const reason = this.#state.finishReason;
          const interrupted = ['aborted', 'insufficient_system_resource'].includes(reason);
          this.#publish({ status: interrupted ? 'interrupted' : reason === 'content_filter' ? 'failed' : 'completed',
            error: reason === 'stop' ? null : reason });
          break;
        }
        this.#accept(data);
      }
    } catch (error) {
      if (active(this.#state.status)) {
        const code = error instanceof StreamFailure ? error.code : signal.aborted ? 'stopped' : 'transport_failed';
        this.#publish({ status: ['stream_closed', 'transport_failed', 'stopped'].includes(code) ? 'interrupted' : 'failed', error: code });
      }
    } finally { signal.removeEventListener('abort', rejectOnAbort); }
    return this.#state;
  }

  #accept(data) {
    let chunk;
    try { chunk = JSON.parse(data); } catch { fail('invalid_json'); }
    if (!chunk || typeof chunk !== 'object') fail('invalid_chunk');
    if (chunk.error) fail('provider_error');
    if (chunk.object !== 'chat.completion.chunk' || typeof chunk.id !== 'string' || !chunk.id ||
        !Array.isArray(chunk.choices) || chunk.choices.length > 1) fail('invalid_chunk');
    if (this.#state.responseId !== null && this.#state.responseId !== chunk.id) fail('response_id_changed');
    // OpenAI 兼容流可在 finish_reason 后独立发送 usage，choices 此时为空。
    if (chunk.choices.length === 0) {
      if (!this.#state.finishReason || !chunk.usage) fail('invalid_chunk');
      const fields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
      if (!fields.every(field => Number.isSafeInteger(chunk.usage[field]) && chunk.usage[field] >= 0)) fail('invalid_usage');
      this.#publish({ usage: Object.freeze(Object.fromEntries(fields.map(field => [field, chunk.usage[field]]))) });
      return;
    }
    const choice = chunk.choices[0];
    const delta = choice?.delta;
    if (choice?.index !== 0 || !delta || typeof delta !== 'object' || Array.isArray(delta)) fail('invalid_chunk');
    if (delta.tool_calls != null || choice.finish_reason === 'tool_calls') fail('tools_not_supported');
    if (delta.role != null && delta.role !== 'assistant') fail('invalid_role');
    for (const field of ['content', 'reasoning_content']) {
      if (delta[field] != null && typeof delta[field] !== 'string') fail('invalid_delta');
    }
    if (choice.finish_reason != null && !terminalReasons.has(choice.finish_reason)) fail('unknown_finish_reason');
    if (this.#state.finishReason !== null) fail('chunk_after_finish');
    let usage = this.#state.usage;
    if (chunk.usage != null) {
      const fields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
      if (!fields.every(field => Number.isSafeInteger(chunk.usage[field]) && chunk.usage[field] >= 0)) fail('invalid_usage');
      usage = Object.freeze(Object.fromEntries(fields.map(field => [field, chunk.usage[field]])));
    }
    this.#publish({ status: 'streaming', responseId: chunk.id,
      content: this.#state.content + (delta.content ?? ''), reasoning: this.#state.reasoning + (delta.reasoning_content ?? ''),
      finishReason: choice.finish_reason ?? null, usage });
  }
}
