import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

export function RemoteComputerKey({ model, service = model.computerKey }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const connected = state.connectionState === 'connected';
  const key = service, search = key.target === 'web-search-deepseek';
  const title = typeof key.target === 'object' ? '电脑提供方 Key' : search ? '电脑网页搜索 Key' : '电脑 DeepSeek Key';
  const [view, setView] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const action = useRef(() => {}), settled = useRef(Promise.resolve());
  const generation = model.connection.generation.getSnapshot()?.id;
  const allowed = connected && key.supported && model.transport.capabilities?.management === true;
  useEffect(() => {
    let alive = true, active = null, revision = 0, reread = false;
    setView(null); setNotice(''); setBusy(false);
    if (!allowed) return;
    const run = (writing, manual = false) => {
      if (!alive || active) return;
      const controller = new AbortController(), started = revision, previous = settled.current;
      active = controller; setBusy(true);
      if (manual) setNotice('');
      settled.current = (async () => {
        // 换连接/服务时，先等上一操作取消完成，避免抢占同一原生窗口或服务锁。
        await previous;
        if (!alive) return;
        try {
          const result = writing ? await key.configure(controller.signal) : null;
          const next = await key.read(controller.signal);
          if (alive && started === revision) setView(next);
          if (alive && writing && !result.cancelled) setNotice('电脑 Key 操作已完成。');
        } catch (error) {
          if (alive && (writing || started === revision)) { setView(null); setNotice(error.message); }
        } finally {
          if (alive) {
            active = null;
            // 写入只执行一次；期间收到失效事件，完成后合并为一次只读核对。
            if (reread) { reread = false; queueMicrotask(() => run(false)); }
            else setBusy(false);
          }
        }
      })();
    };
    action.current = writing => run(writing, true);
    const invalidate = () => {
      revision++; setView(null);
      if (active) reread = true;
      else run(false);
    };
    const offs = ['settings/document-updated', 'credentials/reference-updated', 'llm/adapters-updated']
      .map(event => model.remote.$on(event, invalidate));
    run(false);
    return () => { alive = false; active?.abort(); action.current = () => {}; offs.forEach(off => off()); };
  }, [key, model, allowed, generation]);
  return <section aria-label={t(title)} className="remote-computer-setting">
    <h3>{t(title)}</h3>
    {typeof key.target === 'object' && <p className="remote-muted">{t('模型提供方')}：<bdi>{key.target.provider}</bdi></p>}
    {connected && !key.supported ? <p>{t("请更新电脑远程插件、网关和 App 后管理电脑 Key。")}</p> : <>
      <p>{t(view ? view.configured ? '已配置' : '尚未配置' : busy ? '正在读取…' : '状态暂不可用')}</p>
      {view && !view.writable && <p>{t("电脑 Key 来自只读配置，请在电脑上修改。")}</p>}
      <p className="remote-muted">{t("在原生密码窗口中更换或移除。旧 Key 不会显示，不影响手机普通聊天。")}</p>
      {search && <p className="remote-muted">{t('网页搜索与电脑 DeepSeek 聊天可能共用此 Key，更换或移除会同时影响使用它的功能。')}</p>}
      {!search && <p className="remote-muted">{t('更换或移除也会影响电脑上共用此 Key 的功能。')}</p>}
      <Button disabled={!allowed || busy || !view?.writable} onClick={() => action.current(true)}>{t("管理电脑 Key")}</Button>
      <Button disabled={!allowed || busy} onClick={() => action.current(false)}>{t("重新读取 Key 状态")}</Button>
      {notice && <p role="status">{t(notice)}</p>}
    </>}
  </section>;
}
