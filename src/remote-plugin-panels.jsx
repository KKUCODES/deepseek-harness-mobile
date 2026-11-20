import React, { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createSidebarRightController } from '@upstream/ui-sidebar-right/src/client/service.ts';
import { SidebarRightTabRegistry } from '@upstream/ui-sidebar-right/src/client/tab-registry.ts';
import { createSidebarRightStore } from '@upstream/ui-sidebar-right/src/client/stores.ts';
import { tabInfoFactory, guideTabInfoFactory } from '@upstream/ui-sidebar-right/src/client/tab-info.ts';
import { defaultSeed } from '@upstream/ui-sidebar-right/src/client/contract/seed.ts';
import { GUIDE_ID, guideDefinition } from '@upstream/ui-sidebar-right/src/client/tabs/guide/definition.ts';
import { GuideBody } from '@upstream/ui-sidebar-right/src/client/tabs/guide/GuideBody.tsx';
import { GuideTitle } from '@upstream/ui-sidebar-right/src/client/tabs/guide/GuideTitle.tsx';
import { zh, en } from '@upstream/ui-sidebar-right/src/client/locales.ts';
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { resolveDocumentAddress } from './remote-document-address.mjs';
import { TabMenu } from '@upstream/ui-dockkit/src/components/TabMenu.tsx';
import { IconChevronLeftOutline14, IconCloseOutline16, IconEllipsisOutline16, IconPlusOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton } from './ui/Surface.jsx';
import { RemoteFilePreview } from './ui/RemoteFilePreview.jsx';
import { useTranslate } from './ui/locale.jsx';
import { installRemoteDocumentPreviews, TEXTPREVIEW_ID } from './remote-document-previews.jsx';
import { RemoteDocumentActions } from './ui/RemoteDocumentActions.jsx';
import { RemoteDesktopOpen } from './ui/RemoteDesktopOpen.jsx';
import { canOpenDesktopFile, canRevealDesktopFile } from './remote-desktop.mjs';
import { installRemoteReviewPreview } from './remote-review-preview.jsx';
import { installRemoteDeliverables } from './remote-deliverables.jsx';
import { RemotePanelMemory } from './remote-panel-memory.mjs';
import { retainRemoteSurface } from './remote-surface-inert.mjs';
import { SurfacePresence, useSurfaceMotion, useSceneMotion } from './ui/motion.jsx';
import { panelFillsViewport } from './remote-panel-layout.mjs';
import { guideInject } from '@dshm/guide-inject';

const FILE_ID = 'dshm/file-preview';
// 旧版没有快捷键目录；新版读取真实客户端服务，不能以电脑目录代替手机绑定。
const EMPTY_SHORTCUTS = Object.freeze([]);
const emptyShortcutCatalog = { subscribe: () => () => {}, getSnapshot: () => EMPTY_SHORTCUTS };
export const RemotePanelActive = createContext(false);
export const RemotePanelIdentity = createContext(null);

/** 原标签域和会话状态保持完整，手机只负责窗口外壳及已有文件读取入口。 */
export function installRemotePluginPanels(model) {
  const { ctx } = model;
  ctx.locale.register('sidebarRight', { zh, en });
  const tabs = new SidebarRightTabRegistry(ctx);
  const { controller, adopt, forget, show, measure } = createSidebarRightController(tabs, (address, signal) => {
    const resources = ctx.get('resources');
    if (!resources) throw new Error('Plugin resources are not ready');
    resources.pin(address, signal);
  }, { autoFullscreen: () => true, openWithFocus: (_id, open) => open(), closeWithFocus: (_id, _pane, close) => close() });
  ctx.provide('sidebarRightTabs', tabs);
  ctx.provide('sidebarRight', controller);
  model.pluginPanels = controller;
  const memory = model.panelMemory = new RemotePanelMemory();
  const adoptions = [], snapshots = memory.layouts, subscriptions = new Map();
  if (show) {
    // 新版控制器由组合层指定屏幕上的 Session；React 只报告尺寸，不再反向绑定 controller。
    const sync = () => show(model.globalPanels.state.getSnapshot().panelInfo.activePanelId === null
      ? model.getSnapshot().selected ?? undefined : undefined);
    ctx.effect(() => model.subscribe(sync));
    ctx.effect(() => model.globalPanels.state.subscribe(sync));
    ctx.effect(() => () => show(undefined));
    sync();
  }
  ctx.effect(() => () => {
    controller.tabDomain.dispose();
    for (const release of adoptions) release();
    for (const release of subscriptions.values()) release();
    memory.dispose(); subscriptions.clear();
  });
  tabs.register(guideDefinition(ctx.locale.bind('sidebarRight')));
  const handle = createSidebarRightStore(() => defaultSeed(tabs));
  const store = { ...handle, create(scopeKey) {
    // 标签只在本次已认证模型内保留，不使用仅按 sessionId 分区的电脑端 localStorage。
    const instance = handle.create(undefined);
    if (scopeKey !== undefined) {
      subscriptions.get(scopeKey)?.();
      const saved = snapshots.get(scopeKey);
      if (saved) instance.store.set(saved);
      snapshots.set(scopeKey, instance.getSnapshot());
      subscriptions.set(scopeKey, instance.subscribe(() => snapshots.set(scopeKey, instance.getSnapshot())));
      adoptions.push(adopt(scopeKey, instance));
    }
    return { ...instance, clearPersisted() {
      if (scopeKey !== undefined) { snapshots.delete(scopeKey); forget(scopeKey); }
    } };
  } };
  ctx.slots.register({ name: 'dshm.sidebar', locale: 'sidebarRight', store,
    children: {
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: tabInfoFactory } } },
      'sidebar.right.pane.tab.title': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: tabInfoFactory } } },
      'sidebar.right.tab.menu.item': { kind: 'list', scope: 'session' },
    },
    inject: sessionId => ({ controller, model, measure,
      hooks: { shortcuts: ctx.get('shortcuts')?.catalog ?? emptyShortcutCatalog,
        tabTypes: { subscribe: listener => tabs.subscribe(listener), getSnapshot: () => tabs.entries() } },
      keyedHooks: { tabNavigation: key => controller.tabDomain.occurrence(sessionId, { id: key }).navigation },
    }),
  }, MobilePluginPanels);
  const guideExtra = guideInject(ctx);
  ctx.slots.register({ name: 'sidebar.right.pane.tab', key: GUIDE_ID, locale: 'sidebarRight',
    children: {
      'sidebar.right.tab.guide.actions': { kind: 'list', scope: 'root' },
      'sidebar.right.tab.guide.entry': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: guideTabInfoFactory } } },
      'sidebar.right.tab.guide': { kind: 'chain', scope: 'session', inject: { hooks: { tabInfo: guideTabInfoFactory } } },
    }, inject: () => ({ hooks: { shortcuts: ctx.get('shortcuts')?.catalog ?? emptyShortcutCatalog,
      guideEntries: { subscribe: listener => tabs.subscribe(listener), getSnapshot: () => tabs.guide() }, ...guideExtra.hooks },
      setPinned: guideExtra.setPinned }),
  }, GuideBody);
  ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: GUIDE_ID }, GuideTitle);
  if (!installRemoteDocumentPreviews(model)) {
    tabs.register({ id: FILE_ID, kind: FILE_ID, priority: 'fallback', patterns: ['dsh-resource://file/**'],
      canOpen: address => !!parseFileAddress(address), title: address => parseFileAddress(address)?.path.split('/').at(-1) ?? '' });
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: FILE_ID, inject: () => ({ model, controller }) }, MobileFileTab);
  }
  installRemoteDeliverables(model, installRemoteReviewPreview(model));
}

function MobileFileTab({ sessionId, useTabInfo, model, controller }) {
  const { tab } = useTabInfo();
  const address = parseFileAddress(tab.navigation.address);
  const file = useMemo(() => address && ({ sessionId: address.scope === 'session' ? address.sessionId : sessionId,
    path: address.path, line: tab.navigation.params?.line }), [tab.navigation, sessionId]);
  return file && <RemoteFilePreview file={file} model={model} onClose={() => { if (controller.isExpanded()) controller.toggleExpanded(); }}/>;
}

function PanelTab({ tab, title = false, active = false, controller, sessionId, useStore, useTabNavigation, useTabTypes, useShortcuts, renderSlot, fallback }) {
  const occurrence = controller.tabDomain.occurrence(sessionId, tab);
  const definition = useTabTypes(types => types.find(item => item.kind === tab.kind));
  const shortcuts = useShortcuts(entries => entries);
  const hookContext = useMemo(() => ({ tabId: tab.id, title, fullscreen: true, active, shortcuts, signal: occurrence.signal,
    actions: occurrence.tabActions, useStore, useTabNavigation }), [tab.id, title, active, shortcuts, occurrence, useStore, useTabNavigation]);
  return renderSlot(title ? 'sidebar.right.pane.tab.title' : 'sidebar.right.pane.tab', {}, { entryKey: definition?.id ?? tab.kind, hookContext, fallback });
}

/** 原插件把菜单和 Modal portal 到 body；外壳不能将它们置于 native dialog 的 inert 区外。 */
export function PanelSurface({ open, title, onClose, model, children, backKey = 'pluginPanelBack', global = false, role = 'region', className = '', priority = global ? 70 : 50 }) {
  const panel = useRef(null);
  const { mounted, present } = useSurfaceMotion(panel, open, 'panel', className);
  const current = useRef(null); current.current = { present, onClose };
  useEffect(() => {
    if (!present) return;
    const releaseSurface = retainRemoteSurface(panel.current, priority);
    const visible = selector => [...document.querySelectorAll(selector)].some(element => element !== panel.current
      && element.dataset.motionPresence !== 'closed' && element.getClientRects().length > 0);
    const escape = event => {
      if (backKey === 'pluginPanelBack' && model.pluginGlobalBack) return;
      if (event.key !== 'Escape') return;
      if (!current.current.present) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (visible('[role="menu"]')) {
        // 原 Menu/TabMenu 都有外部 pointerdown 关闭契约；避免 Escape 同时关闭原 Modal。
        event.preventDefault(); event.stopImmediatePropagation();
        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      } else if (!visible('dialog[open], [role="dialog"][aria-modal="true"]')) {
        event.preventDefault(); event.stopImmediatePropagation(); current.current.onClose();
      }
    };
    window.addEventListener('keydown', escape, true);
    const back = () => {
      const dialog = [...document.querySelectorAll('dialog[open]')].findLast(element => element.dataset.motionPresence !== 'closed' && element.getClientRects().length > 0);
      // 合成Escape没有浏览器默认取消行为；Android返回需沿原生dialog的cancel契约关闭。
      if (dialog && !visible('[role="menu"]')) {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      } else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    };
    model[backKey] = back;
    return () => {
      window.removeEventListener('keydown', escape, true);
      if (model[backKey] === back) delete model[backKey];
      releaseSurface();
    };
  }, [present, model, backKey, priority]);
  return createPortal(<section ref={panel} tabIndex={-1} role={role} aria-modal={role === 'dialog' ? true : undefined} aria-label={title}
    className={`remote-plugin-panel${global ? ' remote-global-panel' : ''} ${className}`} hidden={!mounted}>{children}</section>, document.body);
}

function MobilePluginPanels(props) {
  const { sessionId, useStore, actions, controller, useTabTypes, model, renderSlot, footer, measure } = props;
  const [menu, setMenu] = useState(null);
  const t = useTranslate(), surfaces = useStore(state => state.bySession);
  const types = useTabTypes(types => types);
  const surface = surfaces[sessionId], layout = surface?.layout;
  const content = useRef(null);
  const desktopActions = useRef(null), transferActions = useRef(null);
  const [desktopBusy, setDesktopBusy] = useState(false), [transferBusy, setTransferBusy] = useState(false);
  useSceneMotion(content, layout?.nodes[layout?.activePaneId]?.activeTabId, 1);
  const close = useCallback(() => actions.setExpanded(sessionId, false), [actions, sessionId]);
  useLayoutEffect(() => {
    if (measure) { measure(sessionId, () => false); return; }
    return controller.bind({ sessionId, actions, surfaces, canSplitPane: () => false });
  }, [controller, sessionId, actions, surfaces, measure]);
  useEffect(() => { if (!surface) actions.open(sessionId); }, [actions, sessionId, surface]);
  useEffect(() => { setMenu(null); }, [sessionId, layout?.expanded, layout?.activePaneId && layout.nodes[layout.activePaneId]?.activeTabId]);
  const tabScroll = useRef(null);
  // 新开或切换标签时把选中标签滚入可视区，避免停留在首个标签
  useLayoutEffect(() => {
    const container = tabScroll.current;
    if (!container || !layout?.expanded) return;
    const chip = container.querySelector('.remote-panel-chip.is-active');
    if (!chip) return;
    const box = container.getBoundingClientRect(), item = chip.getBoundingClientRect();
    const left = item.left - box.left + container.scrollLeft, right = left + item.width;
    const margin = 8, viewLeft = container.scrollLeft, viewRight = viewLeft + container.clientWidth;
    if (left < viewLeft + margin) container.scrollTo({ left: Math.max(0, left - margin), behavior: 'smooth' });
    else if (right > viewRight - margin) container.scrollTo({ left: right - container.clientWidth + margin, behavior: 'smooth' });
  }, [layout?.expanded, layout?.nodes[layout?.activePaneId]?.activeTabId]);
  if (!layout) return null;
  const records = Object.values(layout.tabs);
  const activeId = layout.nodes[layout.activePaneId]?.activeTabId;
  const active = layout.tabs[activeId] ?? records[0];
  const documentActive = active && types.find(type => type.kind === active.kind)?.id === TEXTPREVIEW_ID;
  const fillsPanel = tab => panelFillsViewport(types.find(type => type.kind === tab?.kind)?.id, tab?.kind);
  const file = documentActive ? model.documentFiles?.get(active.contentId) ?? resolveDocumentAddress(active.contentId) : undefined;
  const fileActive = active && types.find(type => type.kind === active.kind)?.id === FILE_ID;
  // 收起窗口或临时看文件时保留插件组件，局部表单不因外壳切换丢失。
  const dismissMenu = () => { setMenu(null); menu?.anchor.focus(); };
  // 文件操作收进面板菜单，触发器由对应操作组件经 ref 暴露
  const fileMenuItems = file ? [
    ...(canOpenDesktopFile(model, file) ? [<button key="open" type="button" role="menuitem" disabled={desktopBusy} className="remote-panel-menu-item" onClick={() => { dismissMenu(); desktopActions.current?.open(); }}>{t('在电脑打开')}</button>] : []),
    ...(canRevealDesktopFile(model, file) ? [<button key="reveal" type="button" role="menuitem" disabled={desktopBusy} className="remote-panel-menu-item" onClick={() => { dismissMenu(); desktopActions.current?.reveal(); }}>{t('在电脑文件夹中显示')}</button>] : []),
    <button key="download" type="button" role="menuitem" disabled={transferBusy} className="remote-panel-menu-item" onClick={() => { dismissMenu(); transferActions.current?.download(); }}>{t(file.diffs ? '下载最新完整文件' : '下载完整文件')}</button>,
    <button key="share" type="button" role="menuitem" disabled={transferBusy} className="remote-panel-menu-item" onClick={() => { dismissMenu(); transferActions.current?.share(); }}>{t(file.diffs ? '分享最新完整文件' : '分享完整文件')}</button>,
  ] : [];
  return <><PanelSurface title={t('插件面板')} model={model} onClose={close} open={layout.expanded && !fileActive}>
    <header>
      <IconButton label={t('返回聊天')} onClick={close}><IconChevronLeftOutline14/></IconButton>
      <h2 className="remote-panel-title">{t('插件面板')}</h2>
      <span className="remote-panel-header-actions">
        {active && <IconButton label={t('面板操作')} aria-haspopup="menu" aria-expanded={!!menu}
          onClick={event => setMenu({ tabId: active.id, anchor: event.currentTarget })}><IconEllipsisOutline16/></IconButton>}
      </span>
    </header>
    <nav aria-label={t('已打开的面板')}>
      <div className="remote-panel-tab-scroll" ref={tabScroll}>
        {records.map(tab => <div key={tab.id} className={`remote-panel-chip${tab.id === active?.id ? ' is-active' : ''}`}>
          <button type="button" className="remote-panel-chip-select" aria-pressed={tab.id === active?.id} onClick={() => controller.focus(tab.id)}>
            <span className="remote-panel-chip-name"><PanelTab {...props} tab={tab} title active={layout.expanded && tab.id === active?.id} fallback={tab.title}/></span>
          </button>
          {tab.kind !== 'guide' && <button type="button" className="remote-panel-chip-close" aria-label={t('关闭 {title}', { title: tab.title ?? '' })} onClick={() => controller.close(tab.id)}><IconCloseOutline16/></button>}
        </div>)}
      </div>
      <IconButton label={t('打开面板')} className="remote-panel-add" onClick={() => controller.openTab('guide')}><IconPlusOutline16/></IconButton>
    </nav>
    {file && layout.expanded && <React.Fragment key={active.id}>
      {canOpenDesktopFile(model, file) && <RemoteDesktopOpen model={model} file={file} presentation="panel" actionsRef={desktopActions} onBusyChange={setDesktopBusy}/>}
      <RemoteDocumentActions model={model} file={file} presentation="panel" actionsRef={transferActions} onBusyChange={setTransferBusy}/>
    </React.Fragment>}
    <div ref={content} className={`remote-plugin-panel-content${fillsPanel(active) ? ' is-document' : ''}`}>{records.filter(tab => types.find(type => type.kind === tab.kind)?.id !== FILE_ID).map(tab => <div className={fillsPanel(tab) ? 'remote-document-tab' : undefined} key={tab.id} hidden={tab.id !== active?.id}>
      {documentActive && tab.id === active.id && <p className="remote-document-failure" role="alert">
        {t('文件预览加载失败。你可以关闭此标签后重试，或下载完整文件。')}
      </p>}
      <RemotePanelActive.Provider value={layout.expanded && tab.id === active?.id}>
      <RemotePanelIdentity.Provider value={{ key: JSON.stringify([sessionId, tab.id]), signal: controller.tabDomain.occurrence(sessionId, tab).signal }}>
        <PanelTab {...props} tab={tab} active={layout.expanded && tab.id === active?.id} fallback={<p role="status">{t('此面板的插件暂不可用。')}</p>}/>
      </RemotePanelIdentity.Provider>
      </RemotePanelActive.Provider>
    </div>)}</div>
    {/* 页脚清单可能按视口定位弹窗；在可见窗口内挂载，审批仍由原运行器跨窗口保留。 */}
    <footer className="remote-plugin-panel-footer">{layout.expanded && !fileActive ? footer : null}</footer>
  </PanelSurface>
  {layout.expanded && !fileActive && menu && menu.tabId === active?.id && <TabMenu labels={{ closeTab: t('关闭当前面板') }} anchor={menu.anchor}
    onClose={undefined} onDismiss={dismissMenu}
    extras={<>
      {fileMenuItems}
      {renderSlot('sidebar.right.tab.menu.item', { tab: active, dismiss: dismissMenu })}
      {active.kind !== 'guide' && <><hr className="remote-panel-menu-divider"/>
        <button type="button" role="menuitem" className="remote-panel-menu-item" onClick={() => { dismissMenu(); controller.close(active.id); }}>{t('关闭当前面板')}</button></>}
    </>}
  />}
  <SurfacePresence>{layout.expanded && fileActive && <PanelTab {...props} tab={active} active/>}</SurfacePresence></>;
}
