// 仅读取已登记创作会话和手机状态；不提交消息、切换模式或修改授权。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
const seed = JSON.parse(await readFile(resolve(runtime, 'latest-live-source-creator-seed.json'), 'utf8'));
assert.equal(seed.home, state.home); process.kill(state.hostPid, 0);
const url = new URL(JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8')).loginURL);
assert.equal(url.hostname, '127.0.0.1');
const login = await fetch(url, { redirect: 'manual' }); assert.equal(login.status, 303);
const cookie = login.headers.get('set-cookie').split(';')[0];
for (const [method, args] of [['session/list', { _request: {} }], ['session/projections', { request: { sessionId: seed.sessionId } }]]) {
  const rpcId = randomUUID();
  const response = await fetch(new URL('/api/' + method, url), { method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }) });
  assert.equal(response.status, 200); const frame = await response.json();
  assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true);
  console.log(JSON.stringify({ method, value: method === 'session/list' ? frame.result.value.items.filter(row => row.blank || row.sessionId === seed.sessionId)
    : { seq: frame.result.value.asOfSeq, title: frame.result.value.values.sessionListMetadata, preset: frame.result.value.values.agentPreset } }));
}
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554'); assert.ok(device);
try {
  const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.latesttest')).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/')); assert.ok(page);
  console.log(JSON.stringify(await page.getByTestId('remote-workspace').evaluate((element, id) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      return { selected: state.selected, selectedRow: state.list.byId[state.selected], recorded: state.list.byId[id], workspaces: state.workspaces.items };
    }
    throw Error('creator_inspect_model_missing');
  }, seed.sessionId)));
} finally { await device.close(); }
setTimeout(() => process.exit(0), 200);
