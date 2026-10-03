import React from 'react';
import { FishLogo } from '@upstream/ui-primitives/src/FishLogo.tsx';
import { RemoteHeroPreset, useRemoteConversationLayout } from '../remote-plugin-slots.jsx';
import { RemoteWorkspaceChoice } from './RemoteWorkspaceChoice.jsx';
import { RemoteAgentPresetLabel } from './RemoteAgentPresets.jsx';
import { useTranslate } from './locale.jsx';

export function RemoteHeroBrand() {
  const t = useTranslate(), { renderSlot } = useRemoteConversationLayout();
  return <div className="welcome-title">
    <span className="remote-hero-brand">{renderSlot('conversation.hero.brand.mark', { size: 34 }, { fallback: <FishLogo size={34}/> })}</span>
    <h1>{t('探索未至之境')}</h1>
  </div>;
}

/** 阶段沿原工厂传入值；已有输入和正文不会随欢迎区出现/消失而重建。 */
export function RemoteBoundHero({ model, state, onPreset }) {
  const t = useTranslate(), layout = useRemoteConversationLayout();
  if (!layout?.hero) return null;
  return <div className="welcome remote-bound-hero" data-testid="remote-bound-hero">
    <RemoteHeroBrand/><p>{t('有什么想聊的？')}</p>
    <div className="remote-hero-options">
      <RemoteWorkspaceChoice model={model} state={state}/>
      <div className="remote-hero-mode">{state.connectionState === 'connected'
        ? <RemoteHeroPreset><RemoteAgentPresetLabel model={model} onOpen={onPreset}/></RemoteHeroPreset>
        : <RemoteAgentPresetLabel model={model} onOpen={onPreset}/>}</div>
    </div>
  </div>;
}

export function RemoteActivePreset({ children }) {
  return useRemoteConversationLayout()?.hero ? null : children;
}
