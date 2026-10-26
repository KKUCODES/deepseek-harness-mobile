import test from 'node:test';
import assert from 'node:assert/strict';
import { PhonePlugins, PhonePluginHost, pluginStatus } from '../src/phone-plugins.mjs';
import { LocalPluginBackend } from '../src/phone-plugin-records.mjs';

function storage() {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const catalog = [
  { id: 'one', host: 'ordinary', version: '1.0.0' },
  { id: '@example/home', host: 'remote', group: 'sample.home', version: '1.0.0' },
  { id: '@example/other', host: 'remote', group: 'sample.home', version: '1.0.0', defaultEnabled: false },
];
function setup(disk = storage()) {
  const backend = new LocalPluginBackend(disk);
  const client = host => new PhonePlugins({ bridge: backend.bridge(host), host, catalog, storage: disk });
  return { backend, client, disk };
}

test('both hosts use install/uninstall/enable/disable and running requires actual activation', async () => {
  const { client } = setup(), phone = client('ordinary'), remote = client('remote');
  await phone.start(); await remote.start();
  assert.equal(pluginStatus(phone.getSnapshot().record.one), '待加载');
  let active = false;
  const runtime = new PhonePluginHost(phone, { one: async enabled => { active = enabled; } });
  await runtime.ready; assert.equal(phone.running('one'), true);
  for (const action of ['disable', 'enable', 'uninstall', 'install']) {
    await phone.change('one', action); await tick();
    assert.equal(active, ['enable', 'install'].includes(action));
    assert.equal(phone.running('one'), active);
  }
  let remoteActive = false;
  const remoteHost = new PhonePluginHost(remote, { '@example/home': async enabled => { remoteActive = enabled; }, '@example/other': async () => {} });
  await remoteHost.ready; await tick();
  assert.equal(phone.running('@example/home'), true);
  await phone.change('@example/home', 'uninstall'); await tick();
  assert.equal(remoteActive, false); assert.equal(phone.getSnapshot().record['@example/home'].installed, false);
  await phone.change('@example/home', 'install'); await tick(); assert.equal(phone.running('@example/home'), true);
  await runtime.dispose(); await remoteHost.dispose(); await tick(); assert.equal(phone.running('@example/home'), false);
});

test('persist failure keeps prior desired state and runtime; arbitrary packages are rejected', async () => {
  const disk = storage(), { client } = setup(disk), phone = client('ordinary');
  const runtime = new PhonePluginHost(phone, { one: async () => {} }); await runtime.ready;
  disk.setItem = () => { throw Error('full'); };
  await assert.rejects(phone.change('one', 'uninstall'));
  assert.equal(phone.enabled('one'), true); assert.equal(phone.running('one'), true);
  await assert.rejects(phone.change('https://untrusted/script.js', 'install'), /unsupported_plugin/);
  await runtime.dispose();
});

test('old ordinary uninstall/disable and remote default preferences migrate without resurrection', async () => {
  const { client, disk } = setup();
  disk.setItem('dshm:ordinary:plugins:v1', JSON.stringify({ one: { installed: false, enabled: false } }));
  disk.setItem('dshm.mobile-interface.v1', 'null');
  const phone = client('ordinary'), remote = client('remote'); await phone.start(); await remote.start();
  assert.equal(phone.getSnapshot().record.one.installed, false); assert.equal(remote.enabled('@example/home'), false);
  await phone.change('@example/home', 'uninstall');
  const reopened = client('remote'); await reopened.start();
  assert.equal(reopened.getSnapshot().record['@example/home'].installed, false);
});

test('late activation cannot report running after uninstall and serial cleanup converges', async () => {
  const { client } = setup(), phone = client('ordinary'), gate = Promise.withResolvers();
  let active = false;
  const runtime = new PhonePluginHost(phone, { one: async enabled => { if (enabled) await gate.promise; active = enabled; } });
  await tick(); assert.equal(pluginStatus(phone.getSnapshot().record.one, phone.getSnapshot().runtime.one), '正在加载…');
  await phone.change('one', 'uninstall'); gate.resolve(); await runtime.ready; await tick();
  assert.equal(phone.running('one'), false); assert.equal(active, false);
  await runtime.dispose();
});

test('failed activation is distinct from enabled, and generic retry recovers', async () => {
  const { client } = setup(), phone = client('ordinary'); let fail = true;
  const runtime = new PhonePluginHost(phone, { one: async enabled => { if (enabled && fail) throw Error('load'); } });
  await runtime.ready;
  assert.equal(phone.enabled('one'), true); assert.equal(phone.running('one'), false);
  assert.equal(pluginStatus(phone.getSnapshot().record.one, phone.getSnapshot().runtime.one), '加载失败');
  fail = false; await phone.change('one', 'retry'); await tick(); assert.equal(phone.running('one'), true);
  await runtime.dispose();
});

test('replacement host lease rejects late release/results and group selection is generic', async () => {
  const { client } = setup(), phone = client('ordinary'), remote = client('remote'); await phone.start();
  const handlers = { '@example/home': async () => {}, '@example/other': async () => {} };
  const old = new PhonePluginHost(remote, handlers); await old.ready;
  const current = new PhonePluginHost(remote, handlers); await current.ready;
  await old.dispose(); await tick(); assert.equal(phone.running('@example/home'), true);
  await phone.change('@example/other', 'enable'); await tick();
  assert.equal(phone.enabled('@example/home'), false); assert.equal(phone.running('@example/other'), true);
  await current.dispose();
});

test('runtime notifications never reactivate a host, and restart restores installation only', async () => {
  const { client, disk } = setup(), phone = client('ordinary'); let starts = 0;
  const runtime = new PhonePluginHost(phone, { one: async enabled => { if (enabled) starts++; } }); await runtime.ready;
  await phone.change('@example/home', 'disable'); await tick(); assert.equal(starts, 1);
  const rebooted = new PhonePlugins({ bridge: new LocalPluginBackend(disk).bridge('ordinary'), catalog, storage: disk }); await rebooted.start();
  assert.equal(rebooted.enabled('one'), true); assert.equal(rebooted.running('one'), false);
  await runtime.dispose();
});

test('failed stop and uninstall stay visibly failed until the same lifecycle is retried', async () => {
  for (const action of ['disable', 'uninstall']) {
    const { client } = setup(), phone = client('ordinary'); let fail = true;
    const runtime = new PhonePluginHost(phone, { one: async enabled => { if (!enabled && fail) throw Error('cleanup'); } });
    await runtime.ready; await phone.change('one', action); await tick();
    assert.equal(pluginStatus(phone.getSnapshot().record.one, phone.getSnapshot().runtime.one), action === 'disable' ? '停止失败' : '卸载失败');
    assert.equal(phone.running('one'), false);
    fail = false; await phone.change('one', 'retry'); await tick();
    assert.equal(pluginStatus(phone.getSnapshot().record.one, phone.getSnapshot().runtime.one), action === 'disable' ? '已停用' : '未安装');
    await runtime.dispose();
  }
});
