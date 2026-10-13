import assert from 'node:assert/strict';

/** 只记录端点、测试文件名及原元数据版本；全部调用、回调与授权仍由原载体处理。 */
export async function startOfficeObservation(page) {
  await page.getByTestId('remote-workspace').evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    let model;
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.model?.client) { model = fiber.memoizedProps.model; break; }
    }
    if (!model || window.__latestOfficeObservation) throw Error('office_observation_unavailable');
    const client = model.client, original = client.request;
    const calls = [], connections = [];
    const unsubscribe = client.subscribe(frame => {
      if (frame.type === 'ready' || frame.type === 'closed') connections.push({ type: frame.type, reason: frame.reason,
        ...(frame.type === 'ready' ? { management: frame.management } : {}) });
    });
    function observed(operation, ...args) {
      if (calls.length >= 1000) throw Error('office_observation_overflow');
      const entry = { method: operation.method, endpoint: operation.endpoint,
        sessionId: operation.sessionId ?? operation.payload?.args?.workspaceFileScopeId,
        attachmentId: operation.attachmentId,
        path: operation.path ?? operation.name ?? operation.payload?.args?.path, sourceVersions: [], sourceGenerations: [] };
      calls.push(entry);
      if (['remote.office', 'remote.attachmentOffice'].includes(operation.method) && typeof args[0] === 'function') {
        const emit = args[0];
        args[0] = function(value, ...rest) {
          if (value?.type === 'metadata') {
            entry.sourceVersions.push(value.version);
            entry.sourceGenerations.push(value.generation);
            entry.metadata = { absolutePath: value.absolutePath, version: value.version, generation: value.generation,
              attachmentId: value.attachmentId, name: value.name, bytes: value.bytes };
          }
          return emit.call(this, value, ...rest);
        };
      }
      const pending = original.call(this, operation, ...args);
      pending.promise.then(() => { entry.settled = true; }, error => { entry.settled = true; entry.failure = error.message; });
      return pending;
    }
    client.request = observed;
    if (client.request !== observed) throw Error('office_observation_not_installed');
    window.__latestOfficeObservation = { calls, connections, stop() {
      unsubscribe();
      if (client.request === observed) client.request = original;
      delete window.__latestOfficeObservation;
    } };
  });
  const counts = async path => page.evaluate(path => {
    const calls = window.__latestOfficeObservation.calls;
    return { conversions: calls.filter(call => call.method === 'remote.office' && call.path === path).length,
      authorizations: calls.filter(call => call.endpoint === 'workspaceFiles/readBytes' && call.path === path).length,
      generations: calls.filter(call => call.endpoint === 'officeToPdf/generation').length,
      sourceVersions: calls.filter(call => call.method === 'remote.office' && call.path === path).flatMap(call => call.sourceVersions),
      sourceGenerations: calls.filter(call => call.method === 'remote.office' && call.path === path).flatMap(call => call.sourceGenerations) };
  }, path);
  return { counts, reads: () => page.evaluate(() => window.__latestOfficeObservation.calls.filter(call =>
    ['remote.office', 'remote.attachmentOffice'].includes(call.method) || call.endpoint === 'workspaceFiles/readBytes')),
    connections: () => page.evaluate(() => window.__latestOfficeObservation.connections),
    stop: () => page.evaluate(() => window.__latestOfficeObservation?.stop()) };
}

export function assertFreshOfficeRead(before, after, version) {
  assert.equal(after.conversions, before.conversions + 1, '源版本改变后必须实际重新读取转换流');
  assert.ok(after.authorizations > before.authorizations);
  assert.ok(after.generations > before.generations);
  assert.equal(after.sourceVersions.at(-1), version, '显示的转换流必须对应原Host的新版本');
  assert.notEqual(before.sourceVersions.at(-1), version);
}

export function assertCachedOfficeRead(before, after) {
  assert.ok(before.conversions > 0, '首次预览必须实际读取转换流');
  assert.equal(after.conversions, before.conversions, '同一原版本复用缓存，不再读取PDF转换流');
  assert.ok(after.authorizations > before.authorizations, '缓存命中仍重新核验文件读取权限');
  assert.ok(after.generations > before.generations, '缓存命中仍检查原转换器代次');
}
