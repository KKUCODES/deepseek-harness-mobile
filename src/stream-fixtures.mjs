// 明确标识的协议夹具，仅供离线边界验证；不作为模型回复或 API 连通性证据。
export const fixtureChunk = (delta, finishReason = null, extra = {}) => JSON.stringify({
  id: 'offline-protocol-fixture', object: 'chat.completion.chunk', created: 0, model: 'offline-fixture',
  choices: [{ index: 0, delta, finish_reason: finishReason }], ...extra,
});
export const fixtureEvent = data => `data: ${data}\r\n\r\n`;
export const fixtureText = '中文与 emoji 🧪 跨字节分片。';
export const fixtureReasoning = '这是协议测试字段，不是真实模型推理。';

export function replayResponse(scenario, { delayMs = 4, packetBytes = 17 } = {}) {
  const initial = ': offline fixture\r\n\r\n' + fixtureEvent(fixtureChunk({ reasoning_content: fixtureReasoning })) +
    fixtureEvent(fixtureChunk({ content: fixtureText }));
  const tail = scenario === 'complete' ? fixtureEvent(fixtureChunk({}, 'stop', {
    usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
  })) + fixtureEvent('[DONE]') : '';
  const bytes = new TextEncoder().encode(initial + tail);
  let offset = 0;
  let cancelled = false;
  let release;
  const body = new ReadableStream({
    async pull(controller) {
      if (offset === bytes.length) {
        if (scenario === 'stalled') await new Promise(resolve => { release = resolve; });
        else controller.close();
        return;
      }
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      if (cancelled) return;
      controller.enqueue(bytes.slice(offset, offset + packetBytes));
      offset = Math.min(bytes.length, offset + packetBytes);
    },
    cancel() { cancelled = true; release?.(); },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
}
