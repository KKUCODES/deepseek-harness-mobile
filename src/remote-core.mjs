import { installConnection } from '../../deepseek-harness/packages/client/connection/src/client/index.ts';
import { apply as installGateway } from '../../deepseek-harness/packages/api/gateway/src/client/index.ts';
import { TypertRegistry } from '../../deepseek-harness/packages/typert/registry/src/service.ts';
import { typertOwnedValue } from '../../deepseek-harness/packages/typert/protocol/src/index.ts';
import { PendingApproval } from '../../deepseek-harness/packages/client/ui-approval/src/client/contract/slots.ts';
import { PendingQuestion } from '../../deepseek-harness/packages/client/ui-user-questions/src/client/contract/slots.ts';
import { validateRemoteHistoryPage } from './remote-history-page.mjs';

/** 原 Gateway 独占事件连接；数据服务及 Agent 归属装好后才开始接收。 */
export function installRemoteCore(model) {
  const { ctx, transport, lifetime } = model;
  const opened = Promise.withResolvers();
  const signalOf = signal => AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]);
  new TypertRegistry(ctx);
  installConnection(ctx, {
    location: { hostname: 'remote.dshm.invalid' },
    transport: { ownsHost: false, rpc: {
      async call(channel, endpoint, payload, signal) {
        const combined = signalOf(signal);
        const result = await transport.call(channel, endpoint, payload, combined);
        combined.throwIfAborted();
        if (endpoint === 'session/page' && result?.ok) validateRemoteHistoryPage(payload?.args?.request, result.value);
        return result;
      },
      async *open(channel, endpoint, payload, signal) {
        const combined = signalOf(signal);
        if (endpoint === '$events') await until(opened.promise, combined);
        yield* transport.stream(channel, endpoint, payload, combined);
      },
    } },
  });
  installGateway(ctx);
  // 原生 socket 已失效时立即撤回原连接世代，使插件丢弃旧读取。
  // 等事件流的异步失败会留下“插件在线、实际载体离线”的窗口；只重建订阅，不重放 RPC。
  ctx.effect(() => transport.client?.subscribe(frame => {
    if (frame.type === 'closed' || frame.type === 'ready') ctx.connection.reconnect();
  }), 'remote: synchronize carrier and connection generation');
  return { open: () => opened.resolve(), connection: ctx.connection };
}

export function bindRemoteSessions(model) {
  const { ctx, sessions, remote } = model;
  ctx.typert.contexts.registerClient('agent', {
    identity: candidate => sessions.sessionOf(candidate)?.sessionId,
    resolve: sessionId => {
      const reference = sessions.retainAgentScope(sessionId);
      return typertOwnedValue(reference.binding.ctx, () => reference.release());
    },
  });
  const handlers = { 'api-session/added': 'handleSessionAdded', 'api-session/removed': 'handleSessionRemoved',
    'api-session/status': 'handleSessionStatus', 'api-session/activity': 'handleSessionActivity', 'api-session/error': 'handleSessionError' };
  for (const [event, method] of Object.entries(handlers)) remote.$on(event, (...args) => sessions[method](...args));
  model.interactions = new Map();
  let publishInteraction;
  for (const event of ['approval/request', 'user-questions/request']) {
    remote.$on(event, async function(request, next) {
      // 无界面协议客户端保留原载体接口；正式App由已初始化的原UI插件接管。
      if (model.interactionUiOwnsEvents) return next();
      const sessionId = sessions.sessionOf(this)?.sessionId;
      if (!sessionId) return next();
      const pending = event === 'approval/request' ? new PendingApproval(sessionId, request)
        : new PendingQuestion(sessionId, request.questions, request.signal);
      // key 仅是手机展示标识。wire eventId/clientId 完全由原 Gateway 持有和回传。
      model.interactions.set(pending.key, pending);
      if (!publishInteraction && ctx.get('uiSession')) publishInteraction = ctx.uiSession.registerPendingInteraction(item => item.kind === 'approval' ? 0 : item.kind === 'plan-review' ? 2 : 1);
      const completed = Promise.withResolvers();
      const unregister = publishInteraction?.(pending, async () => { pending.delegate(); await completed.promise; });
      model.publish({ events: [...model.snapshot.events, { eventId: pending.key, agentId: sessionId, event,
        request: event === 'approval/request' ? { toolName: pending.toolName, callId: pending.callId, reason: pending.reason } : { questions: pending.questions } }] });
      try { return await pending.result; }
      catch (error) { if (pending.isDelegation(error)) return next(); throw error; }
      finally {
        unregister?.(); model.interactions.delete(pending.key);
        model.publish({ events: model.snapshot.events.filter(item => item.eventId !== pending.key) });
        completed.resolve();
      }
    });
  }
}

export function until(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
