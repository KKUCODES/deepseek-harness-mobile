import React from 'react';

export const name = '@example/plain-home';
export const inject = ['slots'];
export const mobileInterface = { apiVersion: 1, surface: 'dshm.remote.home' };
export function apply(ctx) {
  ctx.slots.register({ name: mobileInterface.surface }, Home);
}

/** @param {import('@dshm/plugin-sdk').HomeProps} props */
function Home({ home }) {
  const { view, actions, t } = home;
  return <section className="plain-home-example" data-testid="plain-home-example">
    <style>{`.plain-home-example{padding:20px;overflow:auto;flex:1;min-height:0}.plain-home-example button{font:inherit;display:block;padding:12px;min-height:44px;width:100%;text-align:start}.plain-home-example input{font:inherit;width:100%;padding:12px;box-sizing:border-box}`}</style>
    <h1>{view.title}</h1><p>{t(view.connection === 'connected' ? '已连接' : '已断开')}</p>
    <button onClick={actions.back}>{t('返回')}</button><button onClick={actions.menu}>{t('Remote 选项')}</button>
    <input aria-label={t('搜索远程聊天')} value={view.query} onChange={event => actions.query(event.target.value)}/>
    {!view.workspace && view.workspaces.map(item => <button key={item.id} onClick={() => actions.workspace(item.id)}>{item.title}</button>)}
    {view.sessions.map(item => <button key={item.id} disabled={view.busy || view.connection !== 'connected'} onClick={() => actions.session(item.id)}>{item.title}</button>)}
  </section>;
}
