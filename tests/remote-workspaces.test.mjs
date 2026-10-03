import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteWorkspaceActions } from '../src/remote-workspaces.mjs';

function fixture() {
  const original = { workspaceId: 'w', title: '项目', updatedAt: '2026-09-24' };
  const calls = [], state = { generation: 1, connected: 'connected', items: [original, { workspaceId: 'other', title: '另一个' }] };
  const write = async (...args) => { calls.push(args); return { ok: true, value: {} }; };
  const model = { transport: { capabilities: { workspaceManagement: true, management: true, endpoints: { calls: ['workspace/rename', 'workspace/delete', 'workspace/insertBefore'] } } },
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => state.connected } }, lifetime: new AbortController(),
    workspaces: { getSnapshot: () => ({ items: state.items }), rename: write, delete: write, insertBefore: write } };
  return { original, calls, state, model, actions: new RemoteWorkspaceActions(model) };
}
test('工作区管理拒绝旧Host、普通权限、无确认删除和已变化目标', async () => {
  const f = fixture();
  f.model.transport.capabilities.workspaceManagement = false;
  await assert.rejects(f.actions.change('rename', f.original, '新名'), /管理权限/);
  f.model.transport.capabilities.workspaceManagement = true; f.model.transport.capabilities.management = false;
  await assert.rejects(f.actions.change('rename', f.original, '新名'), /管理权限/);
  f.model.transport.capabilities.management = true;
  await assert.rejects(f.actions.change('remove', f.original, false), /确认/);
  await assert.rejects(f.actions.change('move', f.original, 'missing'), /排序/);
  f.state.items[0] = { ...f.original, title: '电脑已改名' };
  await assert.rejects(f.actions.change('remove', f.original, true), /已变化/);
  assert.deepEqual(f.calls, []);
});
test('在途写入不重复执行，未知结果在本连接内不允许重发', async () => {
  const f = fixture(); let reject;
  f.model.workspaces.rename = () => new Promise((_, fail) => { f.calls.push('rename'); reject = fail; });
  const writing = f.actions.change('rename', f.original, '新名称');
  await assert.rejects(f.actions.change('remove', f.original, true), /稍候/);
  reject(new Error('connection closed'));
  await assert.rejects(writing, /尚未确认/);
  await assert.rejects(f.actions.change('remove', f.original, true), /尚未确认/);
  assert.deepEqual(f.calls, ['rename']);
  f.state.generation++;
  await f.actions.change('remove', f.original, true);
  assert.deepEqual(f.calls, ['rename', ['w']]);
});
test('确定业务拒绝允许修正重试；断线或换代不宣称成功', async () => {
  const f = fixture();
  f.model.workspaces.rename = async () => ({ ok: false, error: { code: 'workspace/name-conflict' } });
  await assert.rejects(f.actions.change('rename', f.original, '重复'), /同名/);
  f.model.workspaces.rename = async (...args) => { f.calls.push(args); return { ok: true, value: {} }; };
  await f.actions.change('rename', f.original, ' 新名称 ');
  assert.deepEqual(f.calls, [['w', '新名称']]);
  f.state.connected = 'disconnected';
  await assert.rejects(f.actions.change('remove', f.original, true), /连接/);
  f.state.connected = 'connected';
  f.model.workspaces.delete = async () => { f.state.generation++; return { ok: true, value: {} }; };
  await assert.rejects(f.actions.change('remove', f.original, true), /尚未确认/);
});
