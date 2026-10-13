import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { shellCard, agentLoopCard, SubagentCard, SubagentLimitsCardController, SubagentModelSelectionCardController,
  subagentCardFace, subagentLocale, webSearchLocale, webSearchLabels, cardLocales, MobileConfigCards, configCardSlot, zh, en } from '@dshm/settings-components';
import { RemotePluginSettingsScope } from './remote-plugin-settings.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './ui/locale.jsx';
import { WebSearchSettingsCard } from './remote-web-search-settings.jsx';
import { PluginsSettingsSection } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.tsx';
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots';

const cards = [
  { id: 'bash', namespace: 'shell', ...shellCard },
  { id: 'agent-loop', namespace: 'agent-loop', ...agentLoopCard },
  { id: 'subagent', title: 'subagentTitle', description: 'subagentDescription', locale: subagentLocale, capability: 'subagentSettings', Component: SubagentSettingsCard },
  { id: 'web-search', title: webSearchLabels.title, description: webSearchLabels.description, locale: webSearchLocale, capability: 'webSearchSettings', Component: WebSearchSettingsCard },
];

export function SubagentSettingsCard({ model, ...props }) {
  const t = useTranslate();
  const binding = useMemo(() => {
    const limits = new RemotePluginSettingsScope(model, 'subagent');
    const models = new RemotePluginSettingsScope(model, 'subagent-model-selection');
    const controller = new SubagentModelSelectionCardController(models, { remote: model.remote });
    const limitsController = new SubagentLimitsCardController(limits);
    const face = subagentCardFace(limitsController.inject(), controller.inject());
    return { limits, models, controller, limitsController, face };
  }, [model]);
  const { limits, models, controller, limitsController, face } = binding;
  const limitsState = useSyncExternalStore(limits.subscribe, limits.getSnapshot);
  const modelsState = useSyncExternalStore(models.subscribe, models.getSnapshot);
  const limitsForm = useSyncExternalStore(face.hooks.subagentLimitsCard.subscribe, face.hooks.subagentLimitsCard.getSnapshot);
  const modelsForm = useSyncExternalStore(face.hooks.subagentModelSelectionCard.subscribe, face.hooks.subagentModelSelectionCard.getSnapshot);
  const [resetConfirmation, setResetConfirmation] = useState(null);
  const canReset = modelsState.writable && !limitsState.busy && !modelsState.busy
    && !limitsForm.dirty && !modelsForm.dirty && !limitsForm.saving && !modelsForm.saving;
  const hasModelOverrides = ['enabled', 'allowedModels'].some(key => Object.hasOwn(modelsState.user ?? {}, key));
  const confirmingReset = resetConfirmation?.binding === binding
    && resetConfirmation.revision === modelsState.revision && canReset && hasModelOverrides;
  useEffect(() => {
    if (!confirmingReset) setResetConfirmation(null);
  }, [confirmingReset]);
  useEffect(() => {
    void limits.load(); void models.load();
    const offs = [model.remote.$on('llm/adapters-updated', () => controller.refreshCatalog()),
      model.remote.$on('settings/document-updated', () => controller.refreshCatalog()),
      model.connection.generation.subscribe(() => { face.discard(); controller.resetConnection(); })];
    return () => { for (const off of offs) off(); controller.dispose(); limitsController.dispose?.(); limits.dispose(); models.dispose(); };
  }, [binding, model]);
  const form = { ...props, ...face,
    useSubagentLimitsCard: selector => selector(useSyncExternalStore(face.hooks.subagentLimitsCard.subscribe, face.hooks.subagentLimitsCard.getSnapshot)),
    useSubagentModelSelectionCard: selector => selector(useSyncExternalStore(face.hooks.subagentModelSelectionCard.subscribe, face.hooks.subagentModelSelectionCard.getSnapshot)),
  };
  return <>
    {[...new Set([limitsState.error, modelsState.error].filter(Boolean))].map(error => <p key={error} role="status">{t(error)}</p>)}
    <SubagentCard {...form} />
    {hasModelOverrides && <div style={{ marginTop: 12 }}>
      {confirmingReset ? <div role="group" aria-label={t('恢复模型选择默认设置')}>
        <p>{t('仅恢复模型选择的默认设置，运行限制不变。')}</p>
        <Button type="button" onClick={() => {
          // 使用用户确认时的版本；恢复继承需同时移除开关和模型列表的覆盖值。
          setResetConfirmation(null);
          void models.mutate([{ op: 'unset', path: ['enabled'] }, { op: 'unset', path: ['allowedModels'] }], resetConfirmation.revision);
        }}>{t('确认恢复默认')}</Button>
        <Button type="button" onClick={() => setResetConfirmation(null)}>{t('取消')}</Button>
      </div> : <Button type="button" disabled={!canReset} onClick={() => {
        setResetConfirmation({ binding, revision: modelsState.revision });
      }}>{t('恢复模型选择默认设置')}</Button>}
    </div>}
    <div style={{ marginTop: 12 }}><Button type="button" disabled={limitsState.busy || modelsState.busy} onClick={() => {
      face.discard(); void limits.load(); void models.load();
    }}>{t('重新读取设置')}</Button></div>
  </>;
}

function PluginSettingsCard({ model, definition, ...props }) {
  const t = useTranslate();
  const { Card, Controller, hook, store } = definition;
  const scope = useMemo(() => new RemotePluginSettingsScope(model, definition.namespace), [model, definition]);
  const controller = useMemo(() => new Controller(scope), [scope, Controller]);
  const face = useMemo(() => controller.inject(), [controller]);
  const state = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
  useEffect(() => { void scope.load(); return () => { controller.dispose?.(); scope.dispose(); }; }, [scope, controller]);
  const form = { ...props, ...face, [hook]: selector => selector(useSyncExternalStore(face.hooks[store].subscribe, face.hooks[store].getSnapshot)) };
  return <>
    {state.error && <p role="status">{t(state.error)}</p>}
    {state.status === 'ready' && <Card {...form} />}
    <div style={{ marginTop: 12 }}><Button type="button" disabled={state.busy} onClick={() => { face.discard(); void scope.load(); }}>{t('重新读取设置')}</Button></div>
  </>;
}

/** 使用原表单与原控制器；注册范围由电脑协商能力决定，缺服务不伪装为可用。 */
export function installRemotePluginSettings(model) {
  const { ctx } = model;
  const registered = new Map();
  ctx.locale.register('settings.plugins', { zh, en });
  for (const [namespace, dictionaries] of Object.entries(cardLocales)) ctx.locale.register(namespace, dictionaries);
  // 手机持有页面入口，分页与插件子插槽沿用原组件；不启用依赖通用凭据的桌面apply。
  let version = -1, revision = -1, tabs = [];
  const tabSource = {
    getSnapshot: () => {
      const nextVersion = ctx.slots.getVersion('settings.plugins.tab');
      const nextRevision = ctx.locale.getSnapshot().revision;
      if (version !== nextVersion || revision !== nextRevision) {
        version = nextVersion; revision = nextRevision;
        tabs = ctx.slots.entries('settings.plugins.tab').map(entry => ({
          id: entry.options.id, order: entry.options.order ?? 0, label: resolveSlotLabel(entry.options.label) ?? '',
        })).sort((a, b) => a.order - b.order);
      }
      return tabs;
    },
    subscribe: listener => {
      const offTabs = ctx.slots.subscribe('settings.plugins.tab', listener), offLocale = ctx.locale.subscribe(listener);
      return () => { offTabs(); offLocale(); };
    },
  };
  ctx.slots.register({ name: 'dshm.plugin-settings', locale: 'settings.plugins',
    inject: () => ({ hooks: { tabs: tabSource } }),
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  }, PluginsSettingsSection);
  if (MobileConfigCards) {
    ctx.locale.register('dshm.settings.cards', { zh: { configuration: '插件配置' }, en: { configuration: 'Plugin configuration' } });
    const source = {
      getSnapshot: () => cards.filter(card => registered.has(card.id)).map(card => ({ id: card.id, label: ctx.locale.bind(card.locale)(card.title) })),
      subscribe: listener => { const off = model.subscribe(listener), offLocale = ctx.locale.subscribe(listener); return () => { off(); offLocale(); }; },
    };
    // selector hook 要求稳定快照，只有卡片身份或语言实际变化时才替换数组。
    let current = [], signature = '';
    const read = source.getSnapshot;
    source.getSnapshot = () => {
      const rows = read(), next = JSON.stringify(rows);
      if (signature !== next) { current = rows; signature = next; }
      return current;
    };
    ctx.slots.register({ name: 'settings.plugins.tab', id: 'dshm-configuration', order: 0, locale: 'dshm.settings.cards',
      label: () => ctx.locale.bind('dshm.settings.cards')('configuration'),
      children: { [configCardSlot]: { kind: 'list', scope: 'root' } },
      inject: () => ({ hooks: { cards: source } }),
    }, MobileConfigCards);
  }
  const sync = () => {
    const capabilities = model.transport.capabilities;
    const available = capabilities?.management === true && capabilities.pluginSettings === true;
    for (const [index, definition] of cards.entries()) {
      const supported = available && (!definition.capability || capabilities[definition.capability] === true);
      const Component = definition.Component ?? PluginSettingsCard;
      if (supported && !registered.has(definition.id)) {
        const disposers = [...new Set([configCardSlot, 'plugins.item'])].map(slot => ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, id: definition.id,
          order: (index + 1) * 10, locale: definition.locale,
          label: () => ctx.locale.bind(definition.locale)(definition.title),
        }, props => props.view === 'summary' ? props.t(definition.description)
          : <Component {...props} model={model} definition={definition} />)));
        registered.set(definition.id, () => { for (const dispose of disposers) dispose(); });
      } else if (!supported && registered.has(definition.id)) {
        registered.get(definition.id)(); registered.delete(definition.id);
      }
    }
  };
  const off = model.subscribe(sync); sync();
  model.disposers.push(() => { off(); for (const dispose of registered.values()) dispose(); registered.clear(); });
}
