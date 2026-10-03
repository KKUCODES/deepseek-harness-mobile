import React, { useEffect, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

const actions = { 'pluginManager/installBundle': '安装插件', 'pluginManager/removeBundle': '卸载插件',
  'pluginManager/setBundleEnabled': '切换插件包', 'pluginManager/setPluginEnabled': '切换插件组件' };
const outcomes = { applied: '已完成', 'restart-required': '重启电脑 DSH 后生效', cancelled: '已取消', failed: '未完成', overridden: '已被其他配置覆盖' };

/** 展示本设备电脑回执及本次连接的未确认摘要；不提供重试安装或脚本批准。 */
export function RemotePluginOperationHistory({ model, connected }) {
  const t = useTranslate();
  const [open, setOpen] = useState(false), [items, setItems] = useState(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0), [cancelling, setCancelling] = useState(null);
  const [cancelNotice, setCancelNotice] = useState(null);
  useEffect(() => model.transport.pluginOperations.subscribe(() => setRevision(value => value + 1)), [model]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController(); let timer;
    const refresh = async () => {
      try {
        const result = await model.transport.pluginOperations.list(controller.signal);
        if (!controller.signal.aborted) { setItems(result.items.slice().reverse()); setError(''); }
      } catch {
        if (!controller.signal.aborted) { setItems(null); setError('暂时无法读取操作记录，请检查电脑连接。'); }
      }
      finally { if (!controller.signal.aborted && open) timer = setTimeout(refresh, 2000); }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [model, open, connected, revision]);
  const cancel = async item => {
    setCancelling(item.id); setCancelNotice(null);
    try {
      const result = await model.transport.call('/api', 'pluginManager/cancelInstall', { args: { requestId: item.requestId } });
      if (!result.ok) throw new Error('cancel_failed');
      if (result.value?.status === 'too-late') setCancelNotice({ id: item.id, pendingOnly: true, message: '插件正在应用，已无法取消，请等待结果。' });
      setRevision(value => value + 1);
    } catch { setCancelNotice({ id: item.id, message: '尚未确认取消结果，请刷新操作记录。' }); }
    finally { setCancelling(null); }
  };
  const unknown = connected && items?.some(item => item.state === 'unknown');
  return <>
    {unknown && <p role="alert">{t('有插件操作的结果尚未确认，请展开最近插件操作并核对电脑插件列表。')}</p>}
    <details className="remote-plugin-operations" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t('最近插件操作')}</summary>
    {open && <>
      <p className="muted">{t('电脑保留最近一小时的操作结果。电脑重启后，手机仍会提示本次连接中未确认的操作；不会自动重新安装。')}</p>
      {!connected ? <p role="status">{t('电脑连接已断开，重新连接后可继续操作。')}</p> : <>
        <Button onClick={() => setRevision(value => value + 1)}>{t('刷新操作记录')}</Button>
        {error && <p role="alert">{t(error)}</p>}
        {cancelNotice && items?.some(item => item.id === cancelNotice.id &&
          (cancelNotice.pendingOnly ? item.state === 'pending' : item.state !== 'complete')) &&
          <p role="status">{t(cancelNotice.message)}</p>}
        {items === null && !error && <p role="status">{t('正在读取操作记录…')}</p>}
        {items?.length === 0 && !error && <p>{t('暂无操作记录')}</p>}
        <ul>{items?.map(item => <li key={item.id} data-operation-id={item.id} data-operation-state={item.state}>
          <strong>{t(actions[item.endpoint] ?? '插件操作')}</strong><span>{item.target}</span>
          <small>{t(item.state === 'pending' ? '电脑正在处理' : item.state === 'unknown' ? '无法确认结果，请核对电脑插件列表。'
            : item.ok === false ? '未完成' : outcomes[item.application] ?? '处理结束，请核对电脑插件列表。')}</small>
          {item.state === 'pending' && item.endpoint === 'pluginManager/installBundle' && item.requestId &&
            <Button disabled={cancelling !== null} onClick={() => void cancel(item)}>{t(cancelling === item.id ? '正在取消…' : '取消此次安装')}</Button>}
        </li>)}</ul>
      </>}
    </>}
  </details></>;
}
