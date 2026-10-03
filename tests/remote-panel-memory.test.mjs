import test from 'node:test';
import assert from 'node:assert/strict';
import { RemotePanelMemory } from '../src/remote-panel-memory.mjs';
import { captureConversationResume, captureRemoteResume } from '../src/remote-resume.mjs';

test('旁栏交接保存布局与各标签选择，关闭的阅读窗口不恢复', () => {
  const memory = new RemotePanelMemory(), layout = { bySession: { root: { layout: { expanded: true } } } };
  memory.layouts.set('root', layout);
  const view = { getSnapshot: () => ({ selected: 'child', selectedTarget: { parentSessionId: 'root', childSessionId: 'child', mode: 'continuable' }, selectionTrail: ['root'], events: ['approval'] }),
    captureCommand: () => ({ target: { sessionId: 'child', callId: 'call' }, full: true }) };
  const off = memory.observe('[root,tab]', () => captureConversationResume(view));
  const saved = captureRemoteResume({ panelMemory: memory, sending: new Set(), getSnapshot: () => ({ drafts: {}, attachments: {} }) });
  assert.equal(saved.panels.layouts[0][1], layout);
  assert.equal(saved.panels.views[0][1].command.full, true);
  assert.equal(saved.panels.views[0][1].events, undefined);
  delete view.captureCommand;
  assert.equal(memory.capture().views[0][1].command, undefined);
  off(); assert.deepEqual(memory.capture().views, []);
});

test('新运行环境恢复前再次失败仍保留待恢复视图，销毁不修改已捕获数据', () => {
  const memory = new RemotePanelMemory(), saved = { layouts: [['root', { bySession: {} }]], views: [['one', { selected: 'child' }]] };
  memory.restore(saved);
  assert.deepEqual(memory.capture(), saved);
  memory.observe('one', () => ({ selected: 'parent' }));
  const next = memory.capture(); memory.dispose();
  assert.equal(next.views[0][1].selected, 'parent');
  assert.deepEqual(memory.capture(), { layouts: [], views: [] });
});

test('相同会话不同标签的阅读状态互不覆盖，旧cleanup不删除新持有者', () => {
  const memory = new RemotePanelMemory();
  const stale = memory.observe('tab1', () => ({ selected: 'child' }));
  memory.observe('tab1', () => ({ selected: 'parent' }));
  memory.observe('tab2', () => ({ selected: 'child' })); stale();
  assert.deepEqual(memory.capture().views, [['tab1', { selected: 'parent' }], ['tab2', { selected: 'child' }]]);
});

test('临时卸载保留阅读状态，离屏关闭标签和销毁运行环境都清除', () => {
  const memory = new RemotePanelMemory(), tab = new AbortController();
  const off = memory.observe('tab', () => ({ selected: 'parent', command: { offset: 20 } }), tab.signal);
  off();
  assert.equal(memory.pending.get('tab')?.selected, 'parent');
  assert.equal(memory.capture().views[0][1].command.offset, 20);
  tab.abort();
  assert.deepEqual(memory.capture().views, []);
  const next = new AbortController();
  const late = memory.observe('tab', () => ({ selected: 'child' }), next.signal);
  memory.dispose(); late();
  assert.deepEqual(memory.capture().views, []);
});

test('关闭再打开同名标签不复活旧阅读状态，旧卸载不覆盖新观察者', () => {
  const memory = new RemotePanelMemory(), old = new AbortController(), next = new AbortController();
  const late = memory.observe('tab', () => ({ selected: 'old' }), old.signal);
  old.abort();
  const off = memory.observe('tab', () => ({ selected: 'new' }), next.signal);
  late(); off();
  assert.deepEqual(memory.capture().views, [['tab', { selected: 'new' }]]);
  next.abort();
  assert.deepEqual(memory.capture().views, []);
});
