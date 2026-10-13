import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowMemberTarget } from '../src/remote-workflows.mjs';

const target = { parentSessionId: 'parent', childSessionId: 'child', mode: 'one-shot' };
const state = () => ({ selected: 'parent', connectionState: 'connected',
  list: { ids: ['parent', 'child'], byId: { child: { id: 'child', origin: 'subagent', parentId: 'parent', running: true } } },
  conversation: { order: ['run'], nodes: new Map([['run', { kind: 'workflow-run', visibility: 'visible',
    data: { phases: [{ members: [{ childId: 'child', status: 'running' }] }] } }]]) } });

test('工作流成员导航保留原直接父子地址，只打开真实运行中的成员', () => {
  assert.deepEqual(workflowMemberTarget(state(), target), target);
  for (const mutate of [
    s => { s.selected = 'other'; }, s => { s.connectionState = 'disconnected'; },
    s => { s.list.byId.child.parentId = 'other'; }, s => { s.list.byId.child.running = false; },
    s => { s.list.byId.child.origin = 'user'; }, s => { s.list.ids = ['parent']; },
    s => { s.conversation.nodes.get('run').visibility = 'hidden'; },
    s => { s.conversation.nodes.get('run').data.phases[0].members[0].status = 'completed'; },
    s => { s.conversation = null; }, s => { s.list = null; },
  ]) { const value = state(); mutate(value); assert.throws(() => workflowMemberTarget(value, target)); }
  assert.throws(() => workflowMemberTarget(state(), { ...target, mode: 'continuable' }));
});

test('新版工作流保留官方可继续身份，缺失、冲突或未知身份不接受导航', () => {
  const value = state(), address = { ...target, mode: 'continuable' };
  value.list.projectionsBySession = { child: { values: { subagent: { mode: 'continuable' } } } };
  assert.deepEqual(workflowMemberTarget(value, address), address);
  assert.throws(() => workflowMemberTarget(value, target));
  value.list.projectionsBySession.child.values.subagent = null;
  assert.throws(() => workflowMemberTarget(value, address));
  assert.throws(() => workflowMemberTarget(value, target));
  value.list.projectionsBySession.child.values.subagent = { mode: 'external' };
  assert.throws(() => workflowMemberTarget(value, { ...target, mode: 'external' }));
  for (const mode of ['one-shot', 'continuable']) {
    value.list.projectionsBySession.child.values.subagent = { mode };
    assert.deepEqual(workflowMemberTarget(value, { ...target, mode }), { ...target, mode });
    value.list.byId.child.parentId = 'other';
    assert.throws(() => workflowMemberTarget(value, { ...target, mode }));
    value.list.byId.child.parentId = 'parent';
  }
});
