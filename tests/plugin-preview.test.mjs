import test from 'node:test';
import assert from 'node:assert/strict';
import { createPluginDemo, pluginState } from '../docs/design/ordinary-preview/plugin-demo.mjs';

function operation(state, action, overrides = {}) {
  const event = { type: 'begin', target: 'phone', id: 'prompts', action, token: 'operation', ...overrides };
  return pluginState(pluginState(state, event), { type: 'finish', token: event.token });
}
test('phone settings, update and uninstall do not change the computer copy', () => {
  let state = createPluginDemo();
  const computer = state.computer;
  state = operation(state, 'save', { value: '新的提示词' });
  state = operation(state, 'update');
  assert.equal(state.phone.prompts.setting, '新的提示词');
  assert.equal(state.phone.prompts.version, '1.1.0');
  state = operation(state, 'uninstall');
  assert.equal(state.phone.prompts, undefined);
  assert.equal(state.computer, computer);
});
test('failure keeps the last confirmed version, enabled state and settings', () => {
  const state = createPluginDemo();
  for (const action of ['save', 'update', 'disable', 'uninstall']) {
    const next = operation(state, action, { fail: true, value: '未保存' });
    assert.deepEqual(next.phone, state.phone);
    assert.equal(next.result.error, true);
  }
  assert.equal(operation(state, 'install', { id: 'outline', fail: true }).phone.outline, undefined);
  assert.equal(operation(state, 'install', { id: 'outline' }).phone.outline.enabled, true);
});
test('readonly, offline and incompatible plugins refuse mutations', () => {
  const state = createPluginDemo();
  assert.equal(operation(state, 'disable', { target: 'computer' }).computer.prompts.enabled, true);
  const offline = pluginState(state, { type: 'environment', change: { permission: true, online: false } });
  assert.equal(operation(offline, 'uninstall', { target: 'computer' }).computer.prompts.enabled, true);
  assert.equal(operation(state, 'install', { id: 'workspace' }).phone.workspace, undefined);
  const allowed = pluginState(state, { type: 'environment', change: { permission: true } });
  assert.equal(operation(allowed, 'install', { target: 'computer', id: 'legacy' }).computer.legacy, undefined);
  assert.equal(operation(allowed, 'enable', { target: 'computer', id: 'dependency' }).computer.dependency.enabled, false);
});
test('revocation or disconnect during a write rejects late success and never replays', () => {
  for (const change of [{ permission: false }, { online: false }]) {
    let state = pluginState(createPluginDemo(), { type: 'environment', change: { permission: true } });
    state = pluginState(state, { type: 'begin', action: 'uninstall', target: 'computer', id: 'prompts', token: 'old' });
    state = pluginState(state, { type: 'environment', change });
    assert.equal(state.pending, null);
    assert.equal(state.result.error, true);
    state = pluginState(state, { type: 'environment', change: { online: true, permission: true } });
    state = pluginState(state, { type: 'finish', token: 'old' });
    assert.ok(state.computer.prompts);
  }
});
