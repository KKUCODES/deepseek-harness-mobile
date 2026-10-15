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
import { IconEllipsisOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton } from './ui/Surface.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteFilePreview } from './ui/RemoteFilePreview.jsx';
import { useTranslate } from './ui/locale.jsx';
import { installRemoteDocumentPreviews, TEXTPREVIEW_ID } from './remote-document-previews.jsx';
import { RemoteDocumentActions } from './ui/RemoteDocumentActions.jsx';
import { RemoteDesktopOpen } from './ui/RemoteDesktopOpen.jsx';
import { canOpenDesktopFile } from './remote-desktop.mjs';
import { installRemoteReviewPreview } from './remote-review-preview.jsx';
import { installRemoteDeliverables } from './remote-deliverables.jsx';
import { RemotePanelMemory } from './remote-panel-memory.mjs';
import { retainRemoteSurface } from './remote-surface-inert.mjs';
import { SurfacePresence, useSurfaceMotion, useSceneMotion } from './ui/motion.jsx';
import { panelFillsViewport } from './remote-panel-layout.mjs';

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
  ctx.slots.register({ name: 'sidebar.right.pane.tab', key: GUIDE_ID, locale: 'sidebarRight',
    children: {
      'sidebar.right.tab.guide.entry': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: guideTabInfoFactory } } },
      'sidebar.right.tab.guide': { kind: 'chain', scope: 'session', inject: { hooks: { tabInfo: guideTabInfoFactory } } },
    }, inject: () => ({ hooks: { shortcuts: ctx.get('shortcuts')?.catalog ?? emptyShortcutCatalog,
      guideEntries: { subscribe: listener => tabs.subscribe(listener), getSnapshot: () => tabs.guide() } } }),
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
  useSceneMotion(content, layout?.nodes[layout?.activePaneId]?.activeTabId, 1);
  const close = useCallback(() => actions.setExpanded(sessionId, false), [actions, sessionId]);
  useLayoutEffect(() => {
    if (measure) { measure(sessionId, () => false); return; }
    return controller.bind({ sessionId, actions, surfaces, canSplitPane: () => false });
  }, [controller, sessionId, actions, surfaces, measure]);
  useEffect(() => { if (!surface) actions.open(sessionId); }, [actions, sessionId, surface]);
  useEffect(() => { setMenu(null); }, [sessionId, layout?.expanded, layout?.activePaneId && layout.nodes[layout.activePaneId]?.activeTabId]);
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
  return <><PanelSurface title={t('插件面板')} model={model} onClose={close} open={layout.expanded && !fileActive}>
    <header><h2>{t('插件面板')}</h2><Button onClick={close}>{t('返回聊天')}</Button>
      {active && <IconButton label={t('面板操作')} aria-haspopup="menu" aria-expanded={!!menu}
        onClick={event => setMenu({ tabId: active.id, anchor: event.currentTarget })}><IconEllipsisOutline16/></IconButton>}
    </header>
    <nav aria-label={t('已打开的面板')}>
      {records.map(tab => <Button key={tab.id} aria-pressed={tab.id === active?.id} onClick={() => controller.focus(tab.id)}>
        <PanelTab {...props} tab={tab} title active={layout.expanded && tab.id === active?.id} fallback={tab.title}/>
      </Button>)}
      <Button onClick={() => controller.openTab('guide')}>{t('打开面板')}</Button>
    </nav>
    {file && layout.expanded && <React.Fragment key={active.id}>
      {canOpenDesktopFile(model, file) && <RemoteDesktopOpen model={model} file={file}/>}
      <RemoteDocumentActions model={model} file={file}/>
    </React.Fragment>}
    <div ref={content} className={`remote-plugin-panel-content${fillsPanel(active) ? ' is-document' : ''}`}>{records.filter(tab => types.find(type => type.kind === tab.kind)?.id !== FILE_ID).map(tab => <div className={fillsPanel(tab) ? 'remote-document-tab' : undefined} key={tab.id} hidden={tab.id !== active?.id}>
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
    onClose={active.kind === 'guide' ? undefined : () => { dismissMenu(); controller.close(active.id); }} onDismiss={dismissMenu}
    extras={renderSlot('sidebar.right.tab.menu.item', { tab: active, dismiss: dismissMenu })}/>}
  <SurfacePresence>{layout.expanded && fileActive && <PanelTab {...props} tab={active} active/>}</SurfacePresence></>;
}
