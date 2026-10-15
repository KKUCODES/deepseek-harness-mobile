import React, { useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { useTranslate } from './locale.jsx';
import { useRemoteConversationLayout } from '../remote-plugin-slots.jsx';

/** 仅在已有空聊天选择电脑登记过的工作区；转移沿同一真实导航服务。 */
export function RemoteWorkspaceChoice({ model, state, unbound = false }) {
  const t = useTranslate();
  const layout = useRemoteConversationLayout();
  const { workspacePickerOpen: open, setWorkspacePickerOpen: setOpen, renderSlot } = layout;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false), anchorRef = useRef(null);
  const disabled = busy || state.connectionState !== 'connected' || model.draftTransfers.has(state.selected);
  const choose = async id => {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await layout.selectWorkspace(id); setOpen(false); }
    // 插件可自绘或使用 portal；失败时收起选择器，让宿主错误始终可见。
    catch (failure) { setOpen(false); setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  };
  return <>
    <Button ref={anchorRef} disabled={disabled} aria-label={t(unbound ? '选择工作区' : '切换工作区')}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      {layout.workspaceTitle ?? t('选择工作区')}
    </Button>
    {renderSlot('conversation.hero.workspace', { open, anchorRef, selectedId: layout.workspaceId,
      onPick: id => { void choose(id); }, onClose: () => setOpen(false) }, { fallback: <SurfacePresence>{open && <Surface title={t('选择工作区')} onClose={() => setOpen(false)}>
      <header><h2>{t('选择工作区')}</h2><IconButton label={t('关闭窗口')} onClick={() => setOpen(false)}><IconCloseOutline16/></IconButton></header>
      {busy && <p role="status">{t(unbound ? '正在打开聊天…' : '正在转移草稿…')}</p>}
      {state.workspaces?.phase !== 'ready' && <p role="status">{t('正在读取电脑工作区…')}</p>}
      {state.workspaces?.phase === 'ready' && !state.workspaces.items.length && <p role="status">{t('电脑还没有工作区，请先在电脑添加。')}</p>}
      {state.workspaces?.items.map(item => <Button className="option" key={item.workspaceId} disabled={disabled}
        onClick={() => void choose(item.workspaceId)}>{item.title}</Button>)}
    </Surface>}</SurfacePresence> })}
    {error && <p role="alert">{t(error)}</p>}
  </>;
}
