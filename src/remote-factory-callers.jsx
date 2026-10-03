import React, { useMemo } from 'react';
import { RemoteConversationFactoryHost } from './remote-sidebar-chat.jsx';
import { rememberComponentAdapter } from './remote-component-identity.mjs';

const callers = new WeakMap();

/** 保留原渲染器的调用者授权；只在聊天工厂外补充手机的独立导航生命周期。 */
export function remoteFactoryCaller(Component, model) {
  if (!Component) return Component;
  let entries = callers.get(model);
  if (!entries) { entries = new WeakMap(); callers.set(model, entries); }
  if (entries.has(Component)) return entries.get(Component);
  function FactoryCaller(props) {
    const { renderFactorySlot, useFactorySlot } = props;
    const render = useMemo(() => renderFactorySlot && ((name, owner, options) => {
      const slots = options?.slots && Object.fromEntries(Object.entries(options.slots)
        .map(([key, value]) => [key, remoteFactoryCaller(value, model)]));
      const outlet = renderFactorySlot(name, owner, { ...options, ...(slots && { slots }) });
      return name === 'conversation.content'
        ? <RemoteConversationFactoryHost model={model}>{outlet}</RemoteConversationFactoryHost>
        : outlet;
    }), [renderFactorySlot]);
    const local = useMemo(() => useFactorySlot && ((name, fallback) =>
      useFactorySlot(name, remoteFactoryCaller(fallback, model))), [useFactorySlot]);
    return <Component {...props} {...(render && { renderFactorySlot: render })} {...(local && { useFactorySlot: local })}/>;
  }
  entries.set(Component, FactoryCaller);
  return rememberComponentAdapter(FactoryCaller, Component);
}
