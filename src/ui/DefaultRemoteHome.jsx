import React, { useLayoutEffect, useRef } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronDownOutline14, IconChevronLeftOutline14, IconEllipsisOutline16, IconFolderClose16, IconNewChatOutline16, IconSearchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton } from './Surface.jsx';
import { formatRelativeChatTime } from '../remote-home-workspaces.mjs';

/** 发布版首页作为无插件兜底；数据和操作与插件使用同一个公开契约。 */
export function DefaultRemoteHome({ home }) {
  const { view, actions, t, locale } = home, scroll = useRef(null);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = actions.readScroll(); }, [view.key]);
  const connected = view.connection === 'connected';
  const phrase = view.query.trim();
  const grouped = view.grouped === true && !view.workspace;
  const workspaceGroups = view.workspaceGroups ?? [];
  /** 渲染首页会话行；分组视图与平铺最近列表共用。 */
  const sessionRow = (item, relative = false) => {
    const dated = <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(locale?.startsWith('en') ? 'en' : 'zh-CN')}</time>;
    const relativeLabel = relative ? formatRelativeChatTime(item.updatedAt, view.now, t) : null;
    return <button className="remote-session-row" key={item.id} disabled={view.busy || !connected} onClick={() => actions.session(item.id)}>
      {relative && <i className={`remote-session-status${item.running ? ' is-running' : item.unread ? ' is-unread' : ' is-empty'}`} aria-hidden="true">{item.running ? <i className="remote-session-pulse"/> : item.unread ? <i className="remote-session-dot"/> : null}</i>}
      <span className="remote-session-summary"><span>{item.title}</span>{item.snippet && <span className="remote-search-snippet">{item.snippet}</span>}</span>
      <small>{relative ? relativeLabel ?? dated : item.running ? t('进行中') : dated}</small>
    </button>;
  };
  return <div className="remote-home-surface" data-testid="remote-home-default">
    <header className="topbar remote-topbar"><IconButton label={t('返回')} disabled={view.busy} onClick={actions.back}><IconChevronLeftOutline14/></IconButton><div className="remote-heading"><strong>{view.title}</strong></div><IconButton label={t('Remote 选项')} onClick={actions.menu}><IconEllipsisOutline16/></IconButton></header>
    <button className="connection-strip" onClick={actions.connection}><span className={`connection-dot${connected ? ' online' : ''}`}/><strong role="status">{t(connected ? '已连接电脑' : view.connection === 'connecting' ? '正在连接电脑…' : '电脑连接已断开')}</strong></button>
    <section className="remote-scroll remote-home" ref={scroll} onScroll={event => actions.rememberScroll(event.currentTarget.scrollTop)}>
      {grouped ? <>
        <h2>{t(phrase ? '搜索结果' : view.archived ? '已归档' : '项目')}</h2>
        {!view.ready && <p role="status">{t('正在读取电脑会话…')}</p>}
        {view.ready && phrase && view.searching && <p role="status" className="muted">{t('正在搜索聊天内容…')}</p>}
        {view.searchError && <div className="remote-search-error" role="alert"><p>{t(view.searchError)}</p><Button onClick={actions.retrySearch}>{t('重新搜索')}</Button></div>}
        {view.ready && !phrase && !view.archived && !workspaceGroups.length && <p className="muted">{t('电脑还没有工作区，请先在电脑添加。')}</p>}
        {view.ready && view.archived && !phrase && !workspaceGroups.length && <p className="muted">{t('还没有聊天记录')}</p>}
        {view.ready && phrase && !view.searching && !view.searchError && !workspaceGroups.length && <p className="muted">{t('没有找到匹配的聊天，试试其他关键词。')}</p>}
        {workspaceGroups.map(group => {
          const expanded = group.expanded === true;
          return <div className={`remote-workspace-group${expanded ? ' is-expanded' : ''}`} key={group.id}>
            {phrase
              ? <div className="remote-workspace-heading" data-remote-home-workspace={group.id}><IconFolderClose16 size={22}/><span>{group.kind === 'orphan' ? t('其他会话') : group.title}</span><small>{group.total}</small></div>
              : <button className="remote-project-row" data-remote-home-workspace={group.id} aria-expanded={expanded} onClick={() => actions.toggleWorkspace(group.id)}><IconFolderClose16 size={22}/><span>{group.kind === 'orphan' ? t('其他会话') : group.title}</span><IconChevronDownOutline14 className="remote-workspace-toggle"/></button>}
            {expanded && <div className="remote-workspace-sessions">
              {group.sessions.length ? group.sessions.map(item => sessionRow(item, true)) : <p className="remote-workspace-empty" role="status">{t('这个工作区还没有会话。')}</p>}
              {!phrase && group.mode === 'preview' && group.hiddenCount > 0 && <button className="remote-workspace-more" onClick={() => actions.expandWorkspace(group.id)}>{t('展开其余 {count} 个会话', { count: group.hiddenCount })}</button>}
              {!phrase && group.mode === 'all' && group.hiddenCount > 0 && <button className="remote-workspace-more" onClick={() => actions.collapseWorkspace(group.id)}>{t('收起其余 {count} 个会话', { count: group.hiddenCount })}</button>}
            </div>}
          </div>;
        })}
        {view.hasMore && <p role="status" className="muted">{t('匹配内容较多，目前仅显示部分结果。请输入更具体的关键词。')}</p>}
      </> : <>
        {!view.workspace && <><h2>{t('项目')}</h2>{view.workspaces.map(item => <button className="remote-project-row" key={item.id} onClick={() => actions.workspace(item.id)}><IconFolderClose16 size={22}/><span>{item.title}</span></button>)}</>}
        <h2>{t(view.query.trim() ? '搜索结果' : view.archived ? '已归档' : '最近')}</h2>
        {!view.ready && <p role="status">{t('正在读取电脑会话…')}</p>}
        {view.ready && view.searching && <p role="status" className="muted">{t('正在搜索聊天内容…')}</p>}
        {view.searchError && <div className="remote-search-error" role="alert"><p>{t(view.searchError)}</p><Button onClick={actions.retrySearch}>{t('重新搜索')}</Button></div>}
        {view.sessions.map(item => sessionRow(item))}
        {view.hasMore && <p role="status" className="muted">{t('匹配内容较多，目前仅显示部分结果。请输入更具体的关键词。')}</p>}
        {view.ready && !view.sessions.length && !view.searching && !view.searchError && !view.hasMore && <p className="muted">{t(view.query.trim() ? '没有找到匹配的聊天，试试其他关键词。' : '还没有聊天记录')}</p>}
      </>}
    </section>
    <footer className="remote-home-actions"><label><IconSearchOutline16/><input aria-label={t('搜索远程聊天')} placeholder={t('搜索聊天')} value={view.query} onChange={event => actions.query(event.target.value)}/></label><IconButton label={t('在已有工作区新建聊天')} disabled={!connected || view.busy} onClick={actions.newSession}><IconNewChatOutline16 size={22}/></IconButton></footer>
  </div>;
}
