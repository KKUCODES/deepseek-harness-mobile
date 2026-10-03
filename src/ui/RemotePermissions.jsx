import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslate, useLocale } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCheckOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { permissionLabel, permissionNeedsConfirmation, permissionCopy, AUTO_REVIEW_PRESET } from '../remote-permissions.mjs';

export function RemotePermissionPicker({ model, sessionId }) {
  const t = useTranslate();
  const locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const catalog = useSyncExternalStore(model.permissions.subscribe, model.permissions.getSnapshot);
  const [confirm, setConfirm] = useState(null), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = state.selected !== sessionId || state.session?.openState !== 'open' || !!state.session?.running;
  useEffect(() => { void model.permissions.load(); }, [model]);
  useEffect(() => { setConfirm(null); setAcknowledged(false); }, [catalog.revision, locked, state.permission?.currentValue]);
  const choose = async (value, accepted = false) => {
    if (busy) return;
    setError('');
    if (value !== state.permission?.currentValue && permissionNeedsConfirmation(value) && !accepted) {
      setConfirm(value); setAcknowledged(false); return;
    }
    setBusy(true); setConfirm(null);
    try { await model.permissions.choose(value, sessionId, accepted); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const copy = permissionCopy(locale);
  const prefix = confirm === AUTO_REVIEW_PRESET ? 'auto.confirm.' : 'confirm.';
  return <section className="remote-permissions">
    <p className="muted">{t("修改当前电脑会话的权限，两端同步生效。")}</p>
    {locked && <p role="status">{t("请等待当前回复结束后切换权限。")}</p>}
    {!model.permissions.writable && <p role="status">{t("请更新电脑插件和网关后切换权限。")}</p>}
    {catalog.status === 'loading' && <p role="status">{t("正在读取电脑权限…")}</p>}
    {(catalog.error || error) && <p role="alert">{error ? t(error) : t('无法读取权限：{error}', { error: t(catalog.error) })}</p>}
    {state.permission && <p>{t('当前权限：{name}', { name: permissionLabel(state.permission.currentValue, catalog.options.find(item => item.value === state.permission.currentValue)?.name, locale) })}</p>}
    {confirm ? <div className="remote-permission-confirm" role="group" aria-label={copy[prefix + 'title']}>
      <h3>{copy[prefix + 'title']}</h3><p>{copy[prefix + 'description']}</p>
      <label><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>{copy[prefix + 'acknowledge']}</label>
      <div className="actions"><Button onClick={() => setConfirm(null)}>{t("取消")}</Button><Button variant="primary" disabled={!acknowledged || locked || busy || catalog.status !== 'ready'} onClick={() => void choose(confirm, true)}>{copy[prefix + 'enable']}</Button></div>
    </div> : <>
      {catalog.status === 'ready' && catalog.options.map(option => <Button key={option.value} className="option remote-permission-option"
        disabled={busy || locked || !model.permissions.writable || !state.permission} aria-pressed={state.permission?.currentValue === option.value}
        aria-label={permissionLabel(option.value, option.name, locale)} onClick={() => void choose(option.value)}>
        <span><strong>{permissionLabel(option.value, option.name, locale)}</strong>{option.description && <small>{option.description}</small>}</span>
        {state.permission?.currentValue === option.value && <IconCheckOutline16/>}
      </Button>)}
      {catalog.status === 'ready' && !catalog.options.length && <p role="status">{t("电脑没有可选权限。")}</p>}
      <Button disabled={busy || catalog.status === 'loading'} onClick={() => { setError(''); void model.permissions.load(true); }}>{t("重新读取权限")}</Button>
    </>}
  </section>;
}
