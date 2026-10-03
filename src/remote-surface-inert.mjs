const owners = new WeakMap();
const documents = new WeakMap();

/** 多个插件窗口可重叠；只有最后一个窗口关闭才恢复聊天的原交互状态。 */
export function retainWorkspaceInert(workspace) {
  if (!workspace) return () => {};
  let state = owners.get(workspace);
  if (!state) { state = { original: workspace.inert, count: 0 }; owners.set(workspace, state); }
  state.count++; workspace.inert = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count === 0) { workspace.inert = state.original; owners.delete(workspace); }
  };
}

/** 与手机窗口的 CSS 层级一致；底层窗口保持挂载，但不能继续接收焦点或读屏访问。 */
export function retainRemoteSurface(element, priority) {
  if (!element) return () => {};
  const document = element.ownerDocument;
  let stack = documents.get(document);
  if (!stack) { stack = { entries: [], blocked: new Map() }; documents.set(document, stack); }
  const entry = { element, priority, before: document.activeElement };
  const top = () => stack.entries.reduce((selected, item) => !selected || item.priority >= selected.priority ? item : selected, null);
  const refresh = () => {
    const current = top();
    const targets = new Set(current ? [
      document.querySelector('.remote-app:not([hidden])'),
      ...stack.entries.filter(item => item !== current).map(item => item.element),
    ].filter(Boolean) : []);
    // 先保护新底层，再恢复顶层；避免重叠窗口关闭时短暂放开整个聊天。
    for (const target of targets) if (!stack.blocked.has(target)) stack.blocked.set(target, retainWorkspaceInert(target));
    for (const [target, release] of stack.blocked) if (!targets.has(target)) { release(); stack.blocked.delete(target); }
    return current;
  };
  stack.entries.push(entry);
  if (refresh() === entry) element.focus();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const wasTop = top() === entry;
    stack.entries.splice(stack.entries.indexOf(entry), 1);
    const current = refresh();
    // 下层卸载不抢走顶层插件或其 portal 内的焦点。
    if (wasTop) {
      const before = entry.before;
      if (before?.isConnected && !before.closest('[inert], [hidden]') && (!current || current.element.contains(before))) before.focus();
      else current?.element.focus();
    }
    if (!stack.entries.length) documents.delete(document);
  };
}
