import { Context, Service } from '@deepseek-ai/cordis';
import { TypertRegistry } from '../../../deepseek-harness/packages/typert/registry/src/service.ts';
import { TypertGatewayService } from '../../../deepseek-harness/packages/api/gateway/src/index.ts';

/** 仅供测试：原 Host Gateway + 原 Client Gateway 在本地载体相接，不替代网络/鉴权验收。 */
export async function eventHost() {
  const ctx = new Context(), registered = Promise.withResolvers();
  class LocalCarrier extends Service {
    constructor(scope) {
      super(scope, 'connection');
      this.rpc = { intercept(channel, claims, handler) { registered.resolve({ channel, claims, handler }); return () => {}; } };
    }
  }
  await ctx.plugin(TypertRegistry);
  await ctx.plugin(LocalCarrier);
  await ctx.plugin(TypertGatewayService, {});
  const rpc = await registered.promise;
  const queue = []; let wake;
  const release = ctx.typertGateway.registerRemoteEvents(async function* (signal) {
    const abort = () => wake?.(); signal.addEventListener('abort', abort);
    try {
      while (!signal.aborted) {
        if (queue.length) yield queue.shift();
        else await new Promise(resolve => { wake = resolve; });
      }
    } finally { signal.removeEventListener('abort', abort); }
  }, { home: '/test-only' });
  let barrier;
  const reply = (endpoint, payload, signal) => {
    if (!barrier) return rpc.handler(endpoint, payload, signal);
    signal.throwIfAborted();
    const batch = barrier, completion = Promise.withResolvers();
    batch.requests.push({ endpoint, payload, signal, completion });
    if (batch.requests.length === batch.expected) {
      barrier = undefined;
      // 两个写请求都已在途才交付 Host；模拟另一端 cancel 尚未赶到的网络窗口。
      for (const item of batch.requests) {
        void rpc.handler(item.endpoint, item.payload, item.signal).then(item.completion.resolve, item.completion.reject);
      }
    }
    return completion.promise;
  };
  return {
    holdReplies(expected = 2) { barrier = { expected, requests: [] }; return barrier; },
    connect(transport) {
      const call = transport.call, stream = transport.stream;
      transport.call = (channel, endpoint, payload, signal) => endpoint === '$events/result'
        ? reply(endpoint, payload, signal) : call(channel, endpoint, payload, signal);
      transport.stream = async function* (channel, endpoint, payload, signal) {
        if (endpoint === '$events') yield* await ctx.typertGateway.wireStream.open(endpoint, payload, signal);
        else yield* stream(channel, endpoint, payload, signal);
      };
    },
    dispatch(event, request, agentId) {
      const completion = Promise.withResolvers(), controller = new AbortController();
      const count = { resolved: 0, rejected: 0 }, agent = { ctx: ctx.extend() };
      // 避免拒绝先于断言附加处理器时出现未处理 Promise；原结果仍保留在 completion.promise。
      void completion.promise.catch(() => {});
      queue.push({ event, request: { ...request, agent, signal: controller.signal },
        context: { value: agent.ctx, subject: agent, agentId },
        resolve(value) { count.resolved++; completion.resolve(value); },
        reject(error) { count.rejected++; completion.reject(error); },
      });
      wake?.();
      return { outcome: completion.promise, count, abort: () => controller.abort(new Error('test_host_cancelled')) };
    },
    async dispose() {
      for (const item of barrier?.requests ?? []) item.completion.reject(new Error('test carrier disposed'));
      await release(); await ctx.fiber.dispose();
    },
  };
}
