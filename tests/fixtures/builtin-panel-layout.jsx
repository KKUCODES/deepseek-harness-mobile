import * as plan from '@upstream/ui-plan/src/client/index.ts';
import * as schedule from '@upstream/ui-schedule/src/client/index.ts';
import * as manager from '@upstream/ui-plugin-manager/src/client/index.ts';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { changesReviewAddress } from '@upstream/ui-deliverables/src/changes.ts';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { NativePanelFrame } from '../../src/ui/NativePanelFrame.jsx';

/** 仅供尺寸回放：原插件负责注册和渲染，读取结果是显式夹具，禁止调用写接口。 */
export function builtinPanelFixture(model) {
  model.ctx.slots.onEntryError((slot, entry, error) => { window.builtinPanelErrors ??= []; window.builtinPanelErrors.push({ slot, error: error.message, stack: error.stack }); });
  let initialized = false, state = 'ready';
  const pending = new Set();
  const records = Array.from({ length: 40 }, (_, index) => ({
    id: `panel-task-${index}`, sessionId: 'two', status: 'active', kind: 'after',
    title: `查看项目进展 ${index}`, prompt: '请检查项目中的变更与验证结果。\n'.repeat(60),
    afterSeconds: 60, scheduledAt: '2099-01-01T00:00:00.000Z',
  }));
  const read = async value => {
    if (state === 'loading') await new Promise(resolve => { pending.add(resolve); });
    return state === 'error' ? { ok: false, error: { code: 'fixture/read', message: '隔离尺寸回放读取失败' } } : { ok: true, value };
  };
  return {
    async builtinPanels() {
      if (initialized) return;
      initialized = true;
      await window.fixture.fileLayout('warmup.txt', 'DSHM_PANEL_LAYOUT');
      await model.ctx.plugin({ name: '@fixture/panel-read-results', apply(ctx) {
        ctx.provide('workspaces', { list: model.workspaces });
        ctx.provide('configForms', { describe: () => createSnapshotStore([]), get: () => { throw Error('No fixture config write'); } });
        ctx.provide('remote.schedule', { catalog: () => read(state === 'empty' ? [] : records), history: () => read({ id: records[0].id, records: [], earlierRecordsUnavailable: false, earlierRecordsPruned: false, retention: { days: 30, records: 200 } }) });
        ctx.provide('remote.pluginInventory', { list: () => read({ managementAvailable: true }) });
        ctx.provide('remote.pluginManager', { listBundles: () => read([]), listPlugins: () => read([]) });
        ctx.provide('remote.pluginRegistryProbe', {});
      } }).await();
      for (const [name, module] of [['plan', plan], ['schedule', schedule], ['plugin-manager', manager]]) {
        const missing = module.inject.filter(key => model.ctx.get(key) === undefined);
        if (missing.length) throw Error(`${name}: missing ${missing.join(',')}`);
        await model.ctx.plugin({ ...module, name: `@deepseek-ai/dsh-client-ui-${name}` }).await();
      }
    },
    builtinGuide: () => model.pluginPanels.openTab('guide'),
    builtinPlan: (markdown, expired = false) => model.pluginPanels.openResource('dsh-resource://plan-review/two/layout', {
      params: expired ? undefined : { planReview: { title: '项目检查计划', markdown } },
    }),
    builtinTask: () => model.pluginPanels.openTab('scheduleTask', { params: { sessionId: 'two', id: records[0].id } }),
    builtinReview: () => model.pluginPanels.openResource(changesReviewAddress({ sessionId: 'two', seq: 80, turn: 2 })),
    builtinGlobal: id => { model.pluginPanels.close(); model.globalPanels.controller.selectPanel(id); },
    builtinReadState: next => { state = next; for (const release of pending) release(); pending.clear(); model.ctx.emit('connection/reset'); },
    async builtinMainReplacement() {
      const replacement = model.ctx.plugin({ name: '@fixture/main-replacement', inject: ['slots'], apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'plugins', priority: -100 }, () =>
          <button data-testid="main-replacement" style={{ width: 720, height: 900 }} onClick={event => { event.currentTarget.dataset.clicked = 'yes'; }}>第三方全局页面</button>));
      } });
      await replacement.await();
      window.fixture.builtinReplacementFit = value => model.pluginSlots.layout.setUser('@fixture/main-replacement', value);
      window.fixture.builtinReplacementOff = () => replacement.dispose();
      model.globalPanels.controller.selectPanel('plugins');
    },
    builtinTypographyProbe() {
      const node = document.createElement('div'); document.body.append(node);
      const root = createRoot(node);
      const draw = size => root.render(<NativePanelFrame view="probe" flow>
        <p data-testid="native-heading" style={{ fontSize: 22 }}>保持原有标题层级</p>
        <NativePanelFrame view="nested" flow><p data-testid="native-nested" style={{ fontSize: size }}>嵌套说明</p></NativePanelFrame>
        <div data-plugin-frame="third-party"><p data-testid="third-party-small" style={{ fontSize: 10 }}>插件作者控制</p></div>
      </NativePanelFrame>);
      draw(10);
      window.fixture.builtinTypographyChange = () => draw(20);
      window.fixture.builtinTypographyOff = () => { root.unmount(); node.remove(); };
    },
  };
}
