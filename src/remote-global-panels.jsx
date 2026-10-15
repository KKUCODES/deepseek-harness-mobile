import React, { useCallback, useRef, useSyncExternalStore } from 'react';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots';
import { LayoutController } from '@upstream/ui-layout/src/client/service.ts';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { PanelSurface } from './remote-plugin-panels.jsx';
import { useTranslate } from './ui/locale.jsx';
import { useSceneMotion } from './ui/motion.jsx';
import { mainPanelFillsViewport } from './remote-panel-layout.mjs';

/** 保留原导航契约，几何报告留在手机环境，不安装桌面 AppFrame。 */
export function installRemoteGlobalPanels(model) {
  const { ctx } = model;
  const state = createSnapshotStore({ panelInfo: { activePanelId: null }, sidebarOpen: false, panels: [], rightbar: null });
  const update = patch => state.set({ ...state.getSnapshot(), ...patch });
  const panelInfo = { subscribe: state.subscribe, getSnapshot: () => state.getSnapshot().panelInfo };
  const controller = new LayoutController({
    selectPanel: id => update({ panelInfo: { activePanelId: id }, sidebarOpen: false }),
    toggleSidebar: () => update({ sidebarOpen: !state.getSnapshot().sidebarOpen }),
    openRightbar: (track, fullscreen) => update({ rightbar: { track, fullscreen } }),
    closeRightbar: () => update({ rightbar: null }),
  }, id => ctx.slots.entries('main').some(entry => entry.options.key === id), panelInfo);
  const sync = () => {
    const keys = new Set(ctx.slots.entries('main').map(entry => entry.options.key));
    const panels = ctx.slots.entriesOfSlot('sidebar.panellist')
      .filter(entry => keys.has(entry.options.id))
      .map(({ options }) => ({ id: options.id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? options.id }))
      .sort((a, b) => a.order - b.order);
    if (JSON.stringify(panels) !== JSON.stringify(state.getSnapshot().panels)) update({ panels });
    const selected = state.getSnapshot().panelInfo.activePanelId;
    if (selected !== null && !keys.has(selected)) controller.selectPanel(null);
  };
  ctx.provide('layout', controller);
  ctx.slots.provideRoot({ hooks: { panelInfo } });
  ctx.effect(() => ctx.slots.subscribe('main', sync));
  ctx.effect(() => ctx.slots.subscribe('sidebar.panellist', sync));
  ctx.effect(() => ctx.locale.subscribe(sync));
  ctx.effect(() => () => controller.dispose());
  sync();
  model.globalPanels = { state, controller };
}

export function RemoteGlobalPanels({ model, renderSlot, SessionProvider }) {
  const t = useTranslate(), { state, controller } = model.globalPanels;
  const { panelInfo, sidebarOpen, panels } = useSyncExternalStore(state.subscribe, state.getSnapshot);
  const selected = panelInfo.activePanelId;
  const close = useCallback(() => controller.selectPanel(null), [controller]);
  const open = sidebarOpen || selected !== null;
  const content = useRef(null);
  useSceneMotion(content, sidebarOpen ? 'menu' : selected, sidebarOpen ? 0 : 1);
  const title = sidebarOpen ? t('插件页面') : panels.find(panel => panel.id === selected)?.label ?? t('插件页面');
  const fill = !sidebarOpen && mainPanelFillsViewport(selected);
  return <PanelSurface open={open} title={title} onClose={close} model={model} backKey="pluginGlobalBack" global>
    <header><h2>{title}</h2><Button onClick={close}>{t('返回聊天')}</Button></header>
    <div ref={content} className={`remote-plugin-panel-content${fill ? ' is-document' : ''}`}>
      {sidebarOpen && <nav aria-label={t('插件页面')}>
        {panels.length === 0 && <p role="status">{t('暂无可用的插件页面')}</p>}
        {panels.map(panel => <Button key={panel.id} aria-label={panel.label} aria-pressed={selected === panel.id} onClick={() => controller.selectPanel(panel.id)}>
          <span className="remote-global-panel-icon" aria-hidden="true">{renderSlot('sidebar.panellist', { size: 20, active: selected === panel.id }, { only: panel.id })}</span>{panel.label}
        </Button>)}
      </nav>}
      {/* 全局页面保留电脑原 root 作用域，不能误领用当前聊天的 Session。 */}
      {selected !== null && <div className={mainPanelFillsViewport(selected) ? 'remote-document-tab' : undefined} hidden={sidebarOpen}>
        <SessionProvider session={undefined} empty={() => renderSlot('main', {}, { entryKey: selected })}/>
      </div>}
    </div>
  </PanelSurface>;
}
