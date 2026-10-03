import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { rankByName } from '@upstream/ui-primitives/src/rank-by-name.ts';

export function RemoteSkillPicker({ skills, sessionId, onPick, onSource }) {
  const t = useTranslate();
  const state = useSyncExternalStore(skills.subscribe, skills.getSnapshot);
  const [query, setQuery] = useState('');
  useEffect(() => { void skills.load(); }, [skills, sessionId]);
  const items = rankByName(state.items, query.trim());
  return <section className="remote-skills">
    <input className="sheet-editor" type="search" aria-label={t("搜索技能")} placeholder={t("搜索技能")} value={query} onChange={event => setQuery(event.target.value)}/>
    <p className="muted">{t("选择技能后，可继续填写要求并发送。")}</p>
    {state.status === 'loading' && <p role="status">{t("正在读取电脑上的技能…")}</p>}
    {state.status === 'error' && <p role="alert">{t('无法读取技能：{error}', { error: state.error })}</p>}
    {state.status === 'unavailable' && <p role="status">{t("当前聊天暂不支持选择技能。")}</p>}
    {state.status === 'ready' && !items.length && <p role="status">{t(query.trim() ? '没有找到匹配的技能' : '此聊天没有可用技能')}</p>}
    {state.status === 'ready' && items.map(skill => <div className="remote-skill" key={skill.name}>
      <Button className="option remote-skill-pick" aria-label={t('使用技能 {name}', { name: skill.name })} disabled={!!skill.unavailable} onClick={() => onPick(skill.name, sessionId)}>
        <strong>{skill.name}</strong><span>{skill.description}</span>
        {!skill.modelInvocable && <small>{t("仅手动调用")}</small>}
        {skill.unavailable && <small>{t(skill.unavailable)}</small>}
      </Button>
      {skill.path && <Button className="remote-skill-source" aria-label={t('查看技能 {name}', { name: skill.name })} onClick={() => onSource(skill.path)}>{t("查看说明")}</Button>}
    </div>)}
    {['ready', 'error'].includes(state.status) && <Button onClick={() => void skills.load()}>{t("重新读取技能")}</Button>}
  </section>;
}
