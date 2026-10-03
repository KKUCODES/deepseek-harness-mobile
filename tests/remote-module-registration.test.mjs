import assert from 'node:assert/strict';
import test from 'node:test';
import { remoteModuleRegistration } from '../src/remote-module-registration.mjs';

function fixture(generation = 'current') {
  const controller = new AbortController(), accepted = [], invalidated = [];
  let script = null;
  const modules = { invalidate: id => { invalidated.push(id); } };
  const bridge = remoteModuleRegistration({ target: { load: row => accepted.push(row.id) }, signal: controller.signal,
    generation, currentScript: () => script });
  bridge.bind(modules);
  return { ...bridge, controller, accepted, invalidated, modules, script: id => { script = id === null ? null : { dataset: { dshmGeneration: id } }; },
    load: id => bridge.facade.load({ id, factory() {} }) };
}

test('当前脚本允许登记，旧脚本及无脚本的静态登记拒绝', () => {
  const f = fixture(); f.script('current'); f.load('static');
  f.script('old'); f.load('old'); f.script(null); f.load('untagged');
  f.modules.invalidate('static'); f.load('static');
  assert.deepEqual(f.accepted, ['static']);
});
test('动态注册限同一模块表同步 invalidate 后一次，错误ID不消费正确名额', async () => {
  const f = fixture(); f.load('dyn/p'); f.modules.invalidate('dyn/p');
  f.load('dyn/other'); f.load('dyn/p'); f.load('dyn/p');
  f.modules.invalidate('dyn/late'); await Promise.resolve(); f.load('dyn/late');
  assert.deepEqual(f.accepted, ['dyn/p']);
  assert.deepEqual(f.invalidated, ['dyn/p', 'dyn/late']);
});
test('断开后旧 facade 和旧模块表都不能向新连接登记', () => {
  const old = fixture('old'), next = fixture('next');
  old.modules.invalidate('dyn/p'); old.controller.abort(); old.load('dyn/p');
  old.modules.invalidate('dyn/p'); next.load('dyn/p');
  assert.deepEqual(old.accepted, []); assert.deepEqual(next.accepted, []);
  next.modules.invalidate('dyn/p'); next.load('dyn/p'); assert.deepEqual(next.accepted, ['dyn/p']);
});
test('旧脚本不能借用动态名额；invalidate 失败不能登记', () => {
  const f = fixture(); f.modules.invalidate('dyn/p'); f.script('old'); f.load('dyn/p');
  assert.deepEqual(f.accepted, []);
  const broken = { invalidate() { throw Error('rejected'); } }; f.bind(broken);
  assert.throws(() => broken.invalidate('dyn/failed'), /rejected/);
  f.script(null); f.load('dyn/failed'); assert.deepEqual(f.accepted, []);
});
