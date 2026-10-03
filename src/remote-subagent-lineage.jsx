import React, { useEffect, useMemo, useRef } from 'react';
import { SubagentHeaderLineage } from '@upstream/ui-subagent/src/client/SubagentHeaderLineage.tsx';
import { subagentChatAddress } from '@upstream/ui-subagent/src/client/sidebar-chat/index.tsx';
import { NS } from '@upstream/ui-subagent/src/client/locales.ts';
import { useRemoteConversationModel } from './remote-plugin-slots.jsx';

/** 原目录界面保持不变，仅将导航绑定到呈现它的手机视图。 */
export function installRemoteSubagentLineage(model) {
  model.ctx.slots.register({ name: 'conversation.session.header.lineage', priority: 100,
    locale: NS }, MobileSubagentLineage);
}

function MobileSubagentLineage(props) {
  const view = useRemoteConversationModel(), reference = view.reference;
  const touch = useRef(false);
  const actions = useMemo(() => {
    const held = new Map();
    const current = () => {
      if (view.lifetime.signal.aborted || view.reference !== reference) throw new Error('聊天已切换，请在当前聊天中操作。');
      view.model?.sessionFor(view) ?? view.sessionFor();
    };
    const run = work => { void Promise.resolve().then(() => { current(); return work(); }).catch(error => view.fail(error)); };
    const validate = address => {
      const entry = view.getSnapshot().list?.subagentsByParent[address.parentSessionId]?.entries.find(item => item.kind === 'child' && item.id === address.childSessionId);
      if (!entry || entry.mode !== address.mode) throw new Error('子会话已变化，请刷新后重试。');
    };
    return {
      openChild: address => run(() => { validate(address); return view.select(address); }),
      openChildAside: address => run(() => {
        validate(address);
        view.ctx.sidebarRight.openResource(subagentChatAddress(address), { kind: 'subagentchat', preferNewPane: true });
      }),
      refresh: id => run(() => view.sessions.refreshSubagents(id)),
      setCatalogOpen(id, open) {
        if (open) {
          if (view.lifetime.signal.aborted || view.reference !== reference || held.has(id)) return;
          held.set(id, view.sessions.retainSubagentCatalog(id));
        } else { held.get(id)?.(); held.delete(id); }
      },
      dispose() { for (const release of held.values()) release(); held.clear(); },
    };
  }, [view, reference]);
  useEffect(() => () => actions.dispose(), [actions]);
  // 桌面原组件以悬停/键盘打开；手机点击触发同一个ArrowDown入口，不改插件内部状态。
  const activate = event => {
    const button = event.target.closest?.('button[aria-haspopup="tree"]');
    if (!props.openTitle && button?.getAttribute('aria-expanded') === 'false') {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    }
  };
  // WebView触摸后的兼容鼠标事件会启动桌面悬停关闭计时器；portal仍经过此React外层。
  const ignoreTouchHover = event => { if (touch.current) event.stopPropagation(); };
  return <span className="remote-subagent-lineage" onClick={activate}
    onPointerDownCapture={event => { touch.current = event.pointerType === 'touch'; }}
    onPointerMoveCapture={event => { if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) touch.current = false; }}
    onMouseOverCapture={ignoreTouchHover} onMouseOutCapture={ignoreTouchHover}>
    <SubagentHeaderLineage {...props} {...actions}/>
  </span>;
}
