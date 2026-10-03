import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CardForm, numberField } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/card-form.ts';
import { PluginConfigForm } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/PluginConfigForm.tsx';
import { ValueField } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/fields.tsx';
import { RemotePluginSettingsScope } from './remote-plugin-settings.mjs';
import { RemoteComputerKey } from './ui/RemoteComputerKey.jsx';
import { RemoteComputerEndpoint } from './ui/RemoteComputerEndpoint.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './ui/locale.jsx';

/** 次数复用原控件；敏感字段走现有原生密码/目的地址确认边界，不向原 Web 密码框注入凭据服务。 */
export function WebSearchSettingsCard({ model, t }) {
  const translate = useTranslate();
  const binding = useMemo(() => {
    const scope = new RemotePluginSettingsScope(model, 'web-search-deepseek');
    const numeric = numberField('maxUses');
    const form = new CardForm(scope, [{ ...numeric, parse: text => {
      const write = numeric.parse(text);
      return write?.kind !== 'set' || Number.isSafeInteger(write.value) && write.value > 0 ? write : undefined;
    } }]);
    const store = form.bind(() => ({ ...form.shell(), maxUses: form.field('maxUses') }));
    return { scope, store, actions: form.actions() };
  }, [model]);
  const { scope, store, actions } = binding;
  const scopeState = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => { void scope.load(); return () => scope.dispose(); }, [scope]);
  return <>
    <RemoteComputerKey model={model} service={model.searchKey} />
    <RemoteComputerEndpoint model={model} service={model.searchEndpoint} />
    {scopeState.error && <p role="status">{translate(scopeState.error)}</p>}
    <PluginConfigForm t={t} state={state} onSave={actions.save} onDiscard={actions.discard}>
      <ValueField id="plugin-config-web-search-max-uses" label={t('webSearchMaxUses')} hint={t('webSearchMaxUsesHint')}
        overriddenLabel={t('overridden')} resetLabel={t('reset')} invalidLabel={t('invalidNumber')}
        numeric disabled={!state.writable || state.saving} {...state.maxUses}
        onEdit={text => actions.edit('maxUses', text)} onReset={() => actions.resetField('maxUses')} />
    </PluginConfigForm>
    <div style={{ marginTop: 12 }}><Button disabled={scopeState.busy} onClick={() => { actions.discard(); void scope.load(); }}>
      {translate('重新读取设置')}
    </Button></div>
  </>;
}
