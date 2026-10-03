import React, { useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';

export function RemoteWorkspaceManager({ model }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const [selected, setSelected] = useState(null), [mode, setMode] = useState(null);
  const [title, setTitle] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const items = state.workspaces?.items ?? [], actions = model.workspaceActions;
  const current = selected && items.find(item => item.workspaceId === selected.workspaceId);
  const stale = selected && (!current || current.title !== selected.title || current.updatedAt !== selected.updatedAt);
  const locked = busy || stale || !actions.permitted || state.connectionState !== 'connected';
  const reset = () => { setSelected(null); setMode(null); setConfirmed(false); setError(''); };
  const act = async (kind, value) => {
    if (locked) return;
    setBusy(true); setError('');
    try { await actions.change(kind, selected, value); reset(); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  return <section className="remote-workspace-manager" data-testid="remote-workspace-manager">
    <p className="muted">{t("这里的更改会同步到电脑。手机只管理已有工作区。")}</p>
    {state.connectionState !== 'connected' ? <RemoteConnectionNotice state={state}/>
      : !actions.supported ? <p role="status">{t("请更新电脑插件和网关后管理工作区。")}</p>
      : !actions.permitted ? <p role="status">{t("请在电脑 DSH Mobile 插件中，为此设备授予管理权限。")}</p> : <>
        {error && <p role="alert">{t(error)}</p>}
        {stale && <p role="alert">{t("工作区已变化，请返回列表重新选择。")}</p>}
        {!selected ? <>{items.length === 0 && <p role="status">{t("电脑还没有工作区，请先在电脑添加。")}</p>}
          {items.map(item => <Button key={item.workspaceId} className="option" disabled={busy} onClick={() => { setSelected(item); setTitle(item.title); setMode(null); setError(''); }}>{item.title}</Button>)}</>
          : <><h3>{selected.title}</h3>
            {!mode && <><Button className="option" disabled={locked} onClick={() => setMode('rename')}>{t("重命名工作区")}</Button><Button className="option" disabled={locked || items.length < 2} onClick={() => setMode('move')}>{t("调整排序")}</Button><Button className="option" disabled={locked} onClick={() => setMode('remove')}>{t("移除工作区注册")}</Button></>}
            {mode === 'rename' && <><input className="sheet-editor" aria-label={t("工作区名称")} maxLength={200} value={title} disabled={busy || stale} onChange={event => setTitle(event.target.value)}/><Button variant="primary" disabled={locked || !title.trim()} onClick={() => void act('rename', title)}>{t("保存工作区名称")}</Button></>}
            {mode === 'move' && <><p>{t("选择新的位置")}</p>{items.filter(item => item.workspaceId !== selected.workspaceId).map(item => <Button key={item.workspaceId} className="option" disabled={locked} onClick={() => void act('move', item.workspaceId)}>{t('移到「{name}」前面', { name: item.title })}</Button>)}<Button className="option" disabled={locked} onClick={() => void act('move', undefined)}>{t("移到最后")}</Button></>}
            {mode === 'remove' && <><p>{t("移除后，这个工作区将从电脑和手机的项目列表中消失。电脑目录、文件和聊天记录都会保留。")}</p><label className="remote-workspace-confirm"><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)}/>{t('我确认移除「{name}」的工作区注册', { name: selected.title })}</label><Button variant="primary" disabled={locked || !confirmed} onClick={() => void act('remove', confirmed)}>{t("确认移除注册")}</Button></>}
            <Button disabled={busy} onClick={reset}>{t("返回工作区列表")}</Button>
          </>}
      </>}
  </section>;
}
