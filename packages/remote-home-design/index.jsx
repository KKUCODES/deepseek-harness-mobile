import React, { useLayoutEffect, useRef } from 'react';
import { styles } from './styles.mjs';
import back from './assets/back.svg';
import more from './assets/more.svg';
import monitor from './assets/monitor.svg';
import folder from './assets/folder.svg';
import next from './assets/chevron.svg';
import edit from './assets/edit.svg';
import { RemoteConnection } from './connection.jsx';

export const name = '@dshm/remote-home-design';
export const inject = ['slots'];
export const mobileInterface = { apiVersion: 1, surface: 'dshm.remote.home' };
export function apply(ctx) {
  ctx.slots.register({ name: mobileInterface.surface }, RemoteHome);
  // 可选公开席位：旧宿主没有该槽时仍能加载原首页。
  ctx.slots.inject('dshm.remote.connection', () => ctx.slots.register({ name: 'dshm.remote.connection' }, RemoteConnection));
}

const icons = { back: [back,24], more: [more,24], monitor: [monitor,28], folder: [folder,24], next: [next,20], new: [edit,20] };
function Icon({ name }) {
  if (name === 'search') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"/></svg>;
  const [source,size] = icons[name];
  return <span aria-hidden="true" className="dhp-icon" data-icon={name} style={{ width:size, height:size, maskImage:`url("${source}")`, WebkitMaskImage:`url("${source}")` }}/>;
}

/**
 * 计算分组会话的相对时间
 * @param updatedAt 会话更新时间，毫秒时间戳
 * @param now 当前时间，毫秒时间戳；缺省时使用本机时间
 * @param t 翻译函数
 * @returns 相对时间文案；时间无效时返回 null
 */
function relativeChatTime(updatedAt, now, t) {
  const numeric = typeof updatedAt === 'number' ? updatedAt : Number(updatedAt);
  const value = Number.isFinite(numeric) ? numeric : Date.parse(updatedAt);
  const current = Number(now ?? Date.now());
  if (!Number.isFinite(value) || !Number.isFinite(current)) return null;
  const seconds = Math.max(0, Math.floor((current - value) / 1000));
  if (seconds < 10) return t('刚刚');
  if (seconds < 60) return t('{count} 秒', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('{count} 分钟', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('{count} 小时', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('{count} 天', { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('{count} 个月', { count: months });
  return t('{count} 年', { count: Math.max(1, Math.floor(days / 365)) });
}

/** 只依赖公开 owner props；不访问宿主模型、DOM、原生桥或私有组件。 */
export function RemoteHome({ home }) {
  const { view, actions, t, locale } = home;
  const scroll = useRef(null);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = actions.readScroll(); }, [view.key]);
  const connected = view.connection === 'connected';
  const phrase = view.query.trim();
  const grouped = view.grouped === true && !view.workspace;
  const workspaceGroups = view.workspaceGroups ?? [];
  /** 渲染首页会话行；分组视图与平铺最近列表共用。 */
  const sessionRow = (item, relative = false) => {
    const dated = <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(locale?.startsWith('en') ? 'en' : 'zh-CN')}</time>;
    const relativeLabel = relative ? relativeChatTime(item.updatedAt, view.now, t) : null;
    return <button className="dhp-row" data-remote-home-session key={item.id} disabled={view.busy || !connected} onClick={() => actions.session(item.id)}>
      {relative ? <span className={`dhp-status${item.running ? ' is-running' : item.unread ? ' is-unread' : ' is-empty'}`} aria-hidden="true">{item.running ? <span className="dhp-pulse"/> : item.unread ? <span className="dhp-dot"/> : null}</span> : <Icon name="folder"/>}
      <span className="dhp-copy"><span className="dhp-title">{item.title}</span>{item.snippet && <small>{item.snippet}</small>}</span>
      <small className="dhp-value">{relative ? relativeLabel ?? dated : item.running ? t('进行中') : dated}</small>
      <Icon name="next" size={20}/>
    </button>;
  };
  return <div className="dshm-home-plugin" data-testid="remote-home-plugin">
    <style>{styles}</style>
    <header className="dhp-bar"><button aria-label={t('返回')} disabled={view.busy} onClick={actions.back}><Icon name="back"/></button><h1>{view.title}</h1><button aria-label={t('Remote 选项')} onClick={actions.menu}><Icon name="more"/></button></header>
    <section className="dhp-scroll" ref={scroll} onScroll={event => actions.rememberScroll(event.currentTarget.scrollTop)}>
      <button className="dhp-computer" onClick={actions.connection}><span><Icon name="monitor" size={28}/><strong>{t('我的工作电脑')}</strong><small className={connected ? 'is-online' : ''}>{t(connected ? '已连接' : view.connection === 'connecting' ? '连接中' : '已断开')}</small></span><p>{t(connected ? '项目与会话会及时同步' : '电脑连接已断开')}</p></button>
      {!view.ready ? <section role="status" aria-label={t('正在读取电脑会话…')} className="dhp-skeleton"><h2>{t('项目')}</h2><i/><h2>{t('最近会话')}</h2><i/><i/><i/></section> : <>
        {grouped ? <section>
          <h2>{t(phrase ? '搜索结果' : view.archived ? '已归档' : '项目')}</h2>
          {!phrase && !view.archived && !workspaceGroups.length && <p role="status">{t('电脑还没有工作区，请先在电脑添加。')}</p>}
          {!phrase && view.archived && !workspaceGroups.length && <p role="status">{t('还没有聊天记录')}</p>}
          {phrase && view.searching && <p role="status">{t('正在搜索聊天内容…')}</p>}
          {view.searchError && <div role="alert"><p>{t(view.searchError)}</p><button onClick={actions.retrySearch}>{t('重新搜索')}</button></div>}
          {phrase && !view.searching && !view.searchError && !workspaceGroups.length && <p role="status">{t('没有找到匹配的聊天，试试其他关键词。')}</p>}
          {workspaceGroups.map(group => {
            const expanded = group.expanded === true;
            return <div className={`dhp-group${expanded ? ' is-expanded' : ''}`} key={group.id}>
              {phrase
                ? <div className="dhp-group-heading" data-remote-home-workspace={group.id}><Icon name="folder"/><span>{group.kind === 'orphan' ? t('其他会话') : group.title}</span><small>{group.total}</small></div>
                : <button className="dhp-row dhp-group-row" data-remote-home-workspace={group.id} aria-expanded={expanded} onClick={() => actions.toggleWorkspace(group.id)}><Icon name="folder"/><span className="dhp-copy"><span className="dhp-title">{group.kind === 'orphan' ? t('其他会话') : group.title}</span></span><span className="dhp-toggle"><Icon name="next" size={20}/></span></button>}
              {expanded && <div className="dhp-group-sessions">
                {group.sessions.length ? group.sessions.map(item => sessionRow(item, true)) : <p className="dhp-group-empty">{t('这个工作区还没有会话。')}</p>}
                {!phrase && group.mode === 'preview' && group.hiddenCount > 0 && <button className="dhp-more" onClick={() => actions.expandWorkspace(group.id)}>{t('展开其余 {count} 个会话', { count: group.hiddenCount })}</button>}
                {!phrase && group.mode === 'all' && group.hiddenCount > 0 && <button className="dhp-more" onClick={() => actions.collapseWorkspace(group.id)}>{t('收起其余 {count} 个会话', { count: group.hiddenCount })}</button>}
              </div>}
            </div>;
          })}
          {view.hasMore && <p role="status">{t('匹配内容较多，目前仅显示部分结果。请输入更具体的关键词。')}</p>}
        </section> : <>
          {!view.workspace && <section><h2>{t('项目')}</h2>{view.workspaces.map(item => <button className="dhp-row" data-remote-home-project key={item.id} onClick={() => actions.workspace(item.id)}><Icon name="folder"/><span className="dhp-copy"><span className="dhp-title">{item.title}</span></span><Icon name="next" size={20}/></button>)}</section>}
          <section><h2>{t(view.query.trim() ? '搜索结果' : view.archived ? '已归档' : '最近会话')}</h2>
            {view.searching && <p role="status">{t('正在搜索聊天内容…')}</p>}
            {view.searchError && <div role="alert"><p>{t(view.searchError)}</p><button onClick={actions.retrySearch}>{t('重新搜索')}</button></div>}
            {view.sessions.map(item => sessionRow(item))}
            {view.hasMore && <p role="status">{t('匹配内容较多，目前仅显示部分结果。请输入更具体的关键词。')}</p>}
            {!view.sessions.length && !view.searching && !view.searchError && !view.hasMore && <div className="dhp-empty"><Icon name="folder" size={40}/><h2>{t(view.query.trim() ? '没有找到匹配的聊天，试试其他关键词。' : '还没有聊天记录')}</h2></div>}
          </section>
        </>}
      </>}
    </section>
    <footer className="dhp-footer"><label><Icon name="search"/><input aria-label={t('搜索远程聊天')} placeholder={t('搜索聊天')} value={view.query} onChange={event => actions.query(event.target.value)}/></label><button aria-label={t('在已有工作区新建聊天')} disabled={!connected || view.busy} onClick={actions.newSession}><Icon name="new"/></button></footer>
  </div>;
}
