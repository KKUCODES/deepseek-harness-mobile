import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { desktopAppsRequest } from '../src/remote-desktop-apps.mjs';

function fixture() {
  const state = { selected: 'own', connectionState: 'connected' }, calls = [];
  const replies = [], lifetime = new AbortController();
  const model = { lifetime, getSnapshot: () => state,
    transport: { generation: 1, lifetime: new AbortController(), capabilities: { desktopApps: true } },
    client: { request(operation) { calls.push(operation); return replies.shift(); } } };
  const respond = value => replies.push({ promise: Promise.resolve(value), cancel() {} });
  const view = { name: 'pc', available: true, workspacePath: 'C:/work', apps: ['vscode'] };
  const request = (action, value, signal = new AbortController().signal) => desktopAppsRequest(model, 'own', action, value, signal);
  return { model, state, calls, replies, respond, view, request };
}

test('list, prepare and confirm send only fixed selectors; returned workspace paths never enter commands', async () => {
  const f = fixture(); f.respond(f.view); assert.equal((await f.request('list')).workspacePath, 'C:/work');
  const snapshot = randomUUID(); f.respond({ ...f.view, appId: 'vscode', snapshot });
  const prepared = await f.request('prepare', 'vscode'); f.respond({ opened: true });
  assert.deepEqual(await f.request('open', prepared), { opened: true });
  assert.deepEqual(f.calls, [{ method: 'remote.desktopApps', sessionId: 'own' },
    { method: 'remote.prepareDesktopApp', sessionId: 'own', appId: 'vscode' },
    { method: 'remote.openDesktopApp', sessionId: 'own', snapshot, confirmed: true }]);
});

test('old connection, changed chat, unsupported host and invalid selectors do not send', async () => {
  const f = fixture();
  await assert.rejects(f.request('open', { sessionId: 'own', generation: 0, snapshot: randomUUID() }), /stale/);
  await assert.rejects(f.request('prepare', 'C:/app.exe'), /invalid/);
  f.state.selected = 'another'; await assert.rejects(f.request('list'), /stale/);
  f.state.selected = 'own'; f.model.transport.capabilities.desktopApps = false;
  await assert.rejects(f.request('list'), /unavailable/);
  f.state.connectionState = 'connecting'; await assert.rejects(f.request('list'), /not_connected/);
  assert.equal(f.calls.length, 0);
});

test('disconnect cancels the in-flight request and rejects its late success; unknown launch is never resent', async () => {
  const f = fixture(); let resolve, cancellations = 0;
  f.replies.push({ promise: new Promise(done => { resolve = done; }), cancel() { cancellations++; } });
  const pending = f.request('list'); f.model.transport.lifetime.abort(); resolve(f.view);
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(cancellations, 1);
  f.model.transport.lifetime = new AbortController();
  f.replies.push({ promise: Promise.reject(new Error('unknown')), cancel() {} });
  await assert.rejects(f.request('open', { sessionId: 'own', generation: 1, snapshot: randomUUID() }), /unknown/);
  assert.equal(f.calls.length, 2);
});

test('malformed catalogs and mismatched confirmation replies cannot become selectable', async () => {
  const f = fixture();
  for (const value of [{ ...f.view, apps: ['--command'] }, { ...f.view, available: false }, { ...f.view, workspacePath: '' }]) {
    f.respond(value); await assert.rejects(f.request('list'), /invalid/);
  }
  f.respond({ ...f.view, snapshot: randomUUID(), appId: 'explorer' });
  await assert.rejects(f.request('prepare', 'vscode'), /invalid/);
});

test('icons require explicit capability, matching app and bounded image bytes', async () => {
  const f = fixture();
  await assert.rejects(f.request('icon', 'vscode'), /unavailable/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.desktopAppIcons = true;
  f.respond({ appId: 'vscode', contentType: 'image/png', data: 'YWJj' });
  assert.equal(await f.request('icon', 'vscode'), 'data:image/png;base64,YWJj');
  assert.deepEqual(f.calls[0], { method: 'remote.desktopAppIcon', sessionId: 'own', appId: 'vscode' });
  f.respond({ appId: 'vscode', contentType: null, data: null }); assert.equal(await f.request('icon', 'vscode'), null);
  for (const patch of [{ appId: 'explorer' }, { contentType: 'text/html' }, { data: 'https://host/icon.png' },
    { data: 'YWJj\n' }, { data: Buffer.alloc(256 * 1024 + 1).toString('base64') }]) {
    f.respond({ appId: 'vscode', contentType: 'image/png', data: 'YWJj', ...patch });
    await assert.rejects(f.request('icon', 'vscode'), /icon_invalid/);
  }
});

test('late icon replies after disconnect never produce an image URL', async () => {
  const f = fixture(); f.model.transport.capabilities.desktopAppIcons = true;
  let resolve, cancelled = 0;
  f.replies.push({ promise: new Promise(done => { resolve = done; }), cancel() { cancelled++; } });
  const pending = f.request('icon', 'vscode'); f.model.transport.lifetime.abort();
  resolve({ appId: 'vscode', contentType: 'image/png', data: 'YWJj' });
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(cancelled, 1);
});
