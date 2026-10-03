import React, { useSyncExternalStore } from 'react';
import { MobileComposer } from './MobileComposer.jsx';
import { IconButton } from './Surface.jsx';
import { useTranslate } from './locale.jsx';
import { RemoteEmptyComposerBar, RemoteHeroPreset, useRemoteConversationLayout } from '../remote-plugin-slots.jsx';
import { RemoteHeroBrand } from './RemoteConversationHero.jsx';
import { RemoteWorkspaceChoice } from './RemoteWorkspaceChoice.jsx';

/** 无会话时没有输入状态或发送目标；选用真实工作区后进入同一主聊天流程。 */
export function RemoteEmptyConversation({ model }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const { workspacePickerOpen: open, setWorkspacePickerOpen: setOpen } = useRemoteConversationLayout();
  const connected = state.connectionState === 'connected';
  const placeholder = t('先选择工作区，再开始聊天');
  const fallback = <MobileComposer value="" onChange={() => {}} onSend={() => {}} onAttach={() => setOpen(true)}
    IconButton={IconButton} disabled inputProps={{ disabled: true }} placeholder={placeholder}
    label={t('消息')} sendLabel={t('发送消息')} attachLabel={t('添加附件')}/>;
  return <div className="remote-empty-conversation" data-testid="remote-empty-conversation">
    <div className="welcome"><RemoteHeroBrand/><p>{t('选择电脑上的工作区开始聊天')}</p>
      <RemoteWorkspaceChoice model={model} state={state} unbound/>
      {connected && <RemoteHeroPreset unbound/>}
    </div>
    {!connected && <p role="status">{t('电脑连接已断开，恢复连接后将重新同步。')}</p>}
    {state.error && <p role="alert">{t(state.error)}</p>}
    <RemoteEmptyComposerBar variant="hero" disabled placeholder={placeholder}
      workspacePickerOpen={open} onRequestWorkspace={() => setOpen(true)}>{fallback}</RemoteEmptyComposerBar>
  </div>;
}
