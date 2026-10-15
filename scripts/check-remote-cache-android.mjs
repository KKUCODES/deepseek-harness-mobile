import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 只观察自有测试中转的原始收发；不记录正文、资源地址、配对或登录凭据。 */
export function observeCacheWire() {
  const phases = {}, requests = new Map();
  let phase = 'initial';
  const stats = () => phases[phase] ??= { get: 0, head: 0, resourceBytes: 0, full: 0, delta: 0, syncBytes: 0 };
  return { phases, phase: name => { phase = name; stats(); }, attach(socket, request) {
    if (new URL(request.url, 'http://fixture.invalid').pathname !== '/v1/host/socket') return;
    const original = socket.send;
    socket.send = function (raw, ...args) {
      try {
        const frame = JSON.parse(String(raw)), op = frame.operation;
        if (frame.type === 'request') {
          requests.set(frame.id, { method: op.method, phase });
          if (op.method === 'remote.resource') stats()[op.verb === 'HEAD' ? 'head' : 'get']++;
        }
      } catch {}
      return original.call(this, raw, ...args);
    };
    socket.on('message', raw => {
      try {
        const frame = JSON.parse(String(raw)), pending = requests.get(frame.id);
        if (!pending) return;
        const stat = phases[pending.phase] ??= { get: 0, head: 0, resourceBytes: 0, full: 0, delta: 0, syncBytes: 0 };
        if (pending.method === 'remote.resource' && frame.value?.type === 'chunk') stat.resourceBytes += Buffer.from(frame.value.data, 'base64').length;
        if (frame.value?._dshmSync === 1) {
          stat[Object.hasOwn(frame.value, 'delta') ? 'delta' : 'full']++;
          stat.syncBytes += Buffer.byteLength(String(raw));
        }
        if (['end', 'result', 'error'].includes(frame.type)) requests.delete(frame.id);
      } catch {}
    });
  } };
}

export async function checkRemoteCacheAndroid({ page, device, packageName, historySessionId, workspaceId, desktop, wire, output, adb, reconnect }) {
  const model = (page, action, args) => page.getByTestId('remote-workspace').evaluate(async (element, { action, args }) => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model; if (!model?.pluginPanels) continue;
      if (action === 'select') { await model.select(args); return; }
      const state = model.getSnapshot();
      return { pluginsReady: state.plugins?.state === 'ready', cacheVersion: model.transport.capabilities?.syncCacheVersion,
        selected: state.selected, title: state.list?.byId?.[state.selected]?.title,
        workspaces: state.workspaces?.items?.map(item => ({ id: item.workspaceId, title: item.title })),
        messages: state.conversation?.order.length, draft: state.drafts[state.selected] ?? '' };
    }
    throw Error('Remote model missing');
  }, { action, args });
  const ready = async page => {
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    for (let i = 0; i < 200; i++) { if ((await model(page)).pluginsReady) return; await page.waitForTimeout(100); }
    throw Error('Plugins not ready');
  };
  await ready(page); await model(page, 'select', historySessionId);
  const original = await model(page);
  assert.equal(original.cacheVersion, 1); assert.ok(original.messages > 0);
  await page.waitForTimeout(500);
  const initial = { ...wire.phases.initial };
  await writeFile(join(output, 'cache-initial.json'), JSON.stringify({ initial, original }, null, 2));
  assert.ok(initial.get > 0 && initial.resourceBytes > 0 && initial.full > 0, JSON.stringify(initial));
  const cases = [{ phase: 'initial', ...initial, messages: original.messages }];
  wire.phase('unchanged-restart'); page = await reconnect(); await ready(page); await model(page, 'select', historySessionId);
  await page.waitForTimeout(500);
  const unchanged = { ...wire.phases['unchanged-restart'] }, restored = await model(page);
  await writeFile(join(output, 'cache-unchanged.json'), JSON.stringify({ unchanged, restored }, null, 2));
  assert.equal(restored.messages, original.messages); assert.equal(unchanged.get, 0); assert.equal(unchanged.resourceBytes, 0);
  assert.ok(unchanged.head > 0 && unchanged.delta > 0);
  cases.push({ phase: 'unchanged-restart', ...unchanged, messages: restored.messages });
  wire.phase('computer-live');
  await desktop('session/rename', { request: { sessionId: historySessionId, title: '缓存验证：电脑已更新' } });
  await desktop('workspace/rename', { request: { workspaceId, title: '缓存验证工作区' } });
  let changed;
  for (let i = 0; i < 100; i++) {
    changed = await model(page);
    if (changed.title === '缓存验证：电脑已更新' && changed.workspaces.some(item => item.id === workspaceId && item.title === '缓存验证工作区')) break;
    await page.waitForTimeout(100);
  }
  assert.equal(changed.title, '缓存验证：电脑已更新');
  assert.ok(changed.workspaces.some(item => item.title === '缓存验证工作区'));
  wire.phase('changed-restart'); page = await reconnect(); await ready(page); await model(page, 'select', historySessionId);
  const after = await model(page);
  assert.equal(after.title, '缓存验证：电脑已更新'); assert.equal(after.messages, original.messages);
  assert.ok(wire.phases['changed-restart'].delta > 0);
  assert.equal(wire.phases['changed-restart'].resourceBytes, 0);
  cases.push({ phase: 'changed-restart', ...wire.phases['changed-restart'], messages: after.messages });
  await writeFile(join(output, 'cache-connected.png'), await device.screenshot());
  const names = (await adb('shell', 'run-as', packageName, 'ls', 'cache/remote-resources')).split(/\s+/).filter(Boolean);
  assert.ok(names.length > 0 && names.every(name => /^[a-f0-9]{64}\.cache$/.test(name)));
  // 只破坏本轮独立UID的缓存，绑定、草稿、历史和Key存储均不触碰。
  for (const name of names) await adb('shell', 'run-as', packageName, 'truncate', '-s', '1', `cache/remote-resources/${name}`);
  wire.phase('corrupt-restart'); page = await reconnect(); await ready(page); await model(page, 'select', historySessionId);
  assert.ok(wire.phases['corrupt-restart'].get > 0 && wire.phases['corrupt-restart'].resourceBytes > 0);
  assert.equal((await model(page)).messages, original.messages);
  cases.push({ phase: 'corrupt-restart', ...wire.phases['corrupt-restart'] });
  await writeFile(join(output, 'cache-cases.json'), JSON.stringify({ cases, phases: wire.phases, liveUpdates: true, originalHistoryPreserved: true }, null, 2));
  return { cases, liveUpdates: true, originalHistoryPreserved: true, actualProcessRestarts: 3 };
}
