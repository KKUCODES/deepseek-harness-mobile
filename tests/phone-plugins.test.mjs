import test from 'node:test';
import assert from 'node:assert/strict';
import { PhonePlugins } from '../src/phone-plugins.mjs';

function storage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
}
test('actual lifecycle runs before installed state persists and survives new host creation', async () => {
  const disk = storage(); const actions = [];
  const plugins = new PhonePlugins(disk, async (...args) => actions.push(args));
  await plugins.change('input', 'uninstall');
  assert.equal(plugins.enabled('input'), false);
  const restored = new PhonePlugins(disk, async (...args) => actions.push(args));
  assert.equal(restored.enabled('input'), false);
  await restored.change('input', 'install');
  assert.equal(restored.enabled('input'), true);
  assert.deepEqual(actions, [['input', false], ['input', true]]);
});
test('storage failure restores runtime; broken restoration remains visible instead of a fake success', async () => {
  const disk = storage(); const actions = [];
  disk.setItem = () => { throw new Error('full'); };
  const plugins = new PhonePlugins(disk, async (id, enabled) => { actions.push(enabled); });
  await assert.rejects(plugins.change('input', 'disable'), /plugin_operation_failed/);
  assert.deepEqual(actions, [false, true]); assert.equal(plugins.enabled('input'), true);
  const broken = new PhonePlugins(disk, async () => { throw new Error('runtime'); });
  await assert.rejects(broken.change('input', 'disable'), /plugin_recovery_failed/);
});
test('unverified package names and missing installations cannot receive lifecycle calls', async () => {
  const actions = []; const plugins = new PhonePlugins(storage(), async (...args) => actions.push(args));
  await assert.rejects(plugins.change('https://untrusted/script.js', 'install'), /unsupported_plugin/);
  await plugins.change('theme', 'uninstall');
  await assert.rejects(plugins.change('theme', 'enable'), /plugin_not_installed/);
  assert.deepEqual(actions, [['theme', false]]);
});
