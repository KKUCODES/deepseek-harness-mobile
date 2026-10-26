import React, { useLayoutEffect, useRef } from 'react';
import { styles } from './styles.mjs';
import back from './assets/back.svg';
import more from './assets/more.svg';
import monitor from './assets/monitor.svg';
import folder from './assets/folder.svg';
import next from './assets/chevron.svg';
import edit from './assets/edit.svg';

export const name = '@dshm/remote-home-design';
export const inject = ['slots'];
export const mobileInterface = { apiVersion: 1, surface: 'dshm.remote.home' };
export function apply(ctx) {
  ctx.slots.register({ name: mobileInterface.surface }, RemoteHome);
}

const icons = { back: [back,24], more: [more,24], monitor: [monitor,28], folder: [folder,24], next: [next,20], new: [edit,20] };
function Icon({ name }) {
  if (name === 'search') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"/></svg>;
  const [source,size] = icons[name];
  return <span aria-hidden="true" className="dhp-icon" data-icon={name} style={{ width:size, height:size, maskImage:`url("${source}")`, WebkitMaskImage:`url("${source}")` }}/>;
}

/** 只依赖公开 owner props；不访问宿主模型、DOM、原生桥或私有组件。 */
export function RemoteHome({ home }) {
  const { view, actions, t, locale } = home;
  const scroll = useRef(null);
  useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = actions.readScroll(); }, [view.key]);
  const connected = view.connection === 'connected';
  return <div className="dshm-home-plugin" data-testid="remote-home-plugin">
    <style>{styles}</style>
    <header className="dhp-bar"><button aria-label={t('返回')} disabled={view.busy} onClick={actions.back}><Icon name="back"/></button><h1>{view.title}</h1><button aria-label={t('Remote 选项')} onClick={actions.menu}><Icon name="more"/></button></header>
    <section className="dhp-scroll" ref={scroll} onScroll={event => actions.rememberScroll(event.currentTarget.scrollTop)}>
      <button className="dhp-computer" onClick={actions.connection}><span><Icon name="monitor" size={28}/><strong>{t('我的工作电脑')}</strong><small className={connected ? 'is-online' : ''}>{t(connected ? '已连接' : view.connection === 'connecting' ? '连接中' : '已断开')}</small></span><p>{t(connected ? '项目与会话会及时同步' : '电脑连接已断开')}</p></button>
      {!view.ready ? <section role="status" aria-label={t('正在读取电脑会话…')} className="dhp-skeleton"><h2>{t('项目')}</h2><i/><h2>{t('最近会话')}</h2><i/><i/><i/></section> : <>
        {!view.workspace && <section><h2>{t('项目')}</h2>{view.workspaces.map(item => <button className="dhp-row" data-remote-home-project key={item.id} onClick={() => actions.workspace(item.id)}><Icon name="folder"/><span className="dhp-copy"><span className="dhp-title">{item.title}</span></span><Icon name="next" size={20}/></button>)}</section>}
        <section><h2>{t(view.query.trim() ? '搜索结果' : view.archived ? '已归档' : '最近会话')}</h2>
          {view.searching && <p role="status">{t('正在搜索聊天内容…')}</p>}
          {view.searchError && <div role="alert"><p>{t(view.searchError)}</p><button onClick={actions.retrySearch}>{t('重新搜索')}</button></div>}
          {view.sessions.map(item => <button className="dhp-row" data-remote-home-session key={item.id} disabled={view.busy || !connected} onClick={() => actions.session(item.id)}><Icon name="folder"/><span className="dhp-copy"><span className="dhp-title">{item.title}</span>{item.snippet && <small>{item.snippet}</small>}</span><small className="dhp-value">{item.running ? t('进行中') : <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleDateString(locale?.startsWith('en') ? 'en' : 'zh-CN')}</time>}</small><Icon name="next" size={20}/></button>)}
          {view.hasMore && <p role="status">{t('匹配内容较多，目前仅显示部分结果。请输入更具体的关键词。')}</p>}
          {!view.sessions.length && !view.searching && !view.searchError && !view.hasMore && <div className="dhp-empty"><Icon name="folder" size={40}/><h2>{t(view.query.trim() ? '没有找到匹配的聊天，试试其他关键词。' : '还没有聊天记录')}</h2></div>}
        </section>
      </>}
    </section>
    <footer className="dhp-footer"><label><Icon name="search"/><input aria-label={t('搜索远程聊天')} placeholder={t('搜索聊天')} value={view.query} onChange={event => actions.query(event.target.value)}/></label><button aria-label={t('在已有工作区新建聊天')} disabled={!connected || view.busy} onClick={actions.newSession}><Icon name="new"/></button></footer>
  </div>;
}
