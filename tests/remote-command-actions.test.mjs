import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteCommandActions } from '../src/remote-command-actions.mjs';

function fixture() {
  let child, generation = 1, resolve;
  const state = { selected: 'one', connectionState: 'connected', session: { openState: 'open' } };
  const opened = [];
  const model = {
    lifetime: new AbortController(), reference: { sessionId: 'one' }, publish() {}, getSnapshot: () => state,
    sessions: { subagentAddress: () => child }, connection: { generation: { getSnapshot: () => generation } },
    remote: { commands: { list: () => new Promise(done => { resolve = done; }) } },
  };
  const actions = new RemoteCommandActions(model);
  const decoration = { name: 'feedback', available: () => true, ui: { kind: 'action', run: session => opened.push(session.sessionId) } };
  const remove = actions.register(decoration);
  return { actions, model, state, opened, decoration, remove,
    resolve: value => resolve(value ?? { ok: true, value: [{ name: 'feedback' }] }),
    child: () => { child = {}; }, reconnect: () => { generation++; },
  };
}

test('menu invokes the original local action only after the host confirms its catalog entry', async () => {
  const f = fixture();
  const opening = f.actions.open('feedback');
  assert.deepEqual(f.opened, []);
  f.resolve(); await opening;
  assert.deepEqual(f.opened, ['one']);
  assert.equal(f.actions.available('shell'), false);
  await assert.rejects(f.actions.open('shell'));
});

test('late catalog results cannot open feedback after navigation, reconnect, unload, or disposal', async () => {
  for (const change of [f => { f.model.reference = { sessionId: 'two' }; }, f => f.reconnect(),
    f => f.remove(), f => f.model.lifetime.abort(), f => { f.state.connectionState = 'disconnected'; }]) {
    const f = fixture(), opening = f.actions.open('feedback');
    change(f); f.resolve(); await assert.rejects(opening);
    assert.deepEqual(f.opened, []);
  }
});

test('absent catalog entry, business refusal, and child/read-only sessions never fall back to command execution', async () => {
  for (const result of [{ ok: false }, { ok: true, value: [] }]) {
    const f = fixture(), opening = f.actions.open('feedback');
    f.resolve(result); await assert.rejects(opening); assert.deepEqual(f.opened, []);
  }
  for (const change of [f => f.child(), f => { f.state.session.openState = 'closed'; },
    f => { f.decoration.available = () => false; }, f => { f.decoration.ui.kind = 'popupSelect'; }]) {
    const f = fixture(); change(f); const opening = f.actions.open('feedback');
    if (f.actions.available('feedback')) f.resolve();
    await assert.rejects(opening); assert.deepEqual(f.opened, []);
  }
});
