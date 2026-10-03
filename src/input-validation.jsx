import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MenuView } from '../../deepseek-harness/packages/client/ui-input-trigger/src/client/MenuView.tsx';
import { InputValidationRuntime } from './input-runtime.mjs';

/** 只接纯文本草稿；菜单和交互控制器来自上游原文件，完整 composer/Session 另验。 */
export function InputValidation({ locale }) {
  const [runtime] = useState(() => new InputValidationRuntime());
  const editor = useRef(null);
  const state = useSyncExternalStore(runtime.state.subscribe, runtime.state.getSnapshot);
  useSyncExternalStore(listener => locale.subscribe(listener), () => locale.getSnapshot().revision);
  useEffect(() => {
    window.dshmInputValidation = runtime;
    return () => { delete window.dshmInputValidation; void runtime.dispose(); };
  }, [runtime]);
  useLayoutEffect(() => {
    const node = editor.current;
    // IME 正在维护组合区时不回写 value/selection；仅把插件插入或清空投影回 DOM。
    if (!node || state.composing || node.value === state.text) return;
    node.value = state.text;
    if (document.activeElement === node) node.setSelectionRange(state.caret, state.caret);
  }, [state.text, state.caret, state.composing]);
  const controller = runtime.controller;
  return <section>
    <h2>输入增强核心验证</h2>
    <p>输入 /总 或 /translate，选择本地提示词。当前只验证原控制器和候选菜单，不执行 Agent 命令。</p>
    <div data-composer-card className="input-validation-card">
      <MenuView menu={controller.menu} headers={controller.headers} t={locale.bind('slash.validation')}
        onPick={(source, index, action) => controller.pick(source, index, action)}
        onHover={(source, index) => controller.hover(source, index)}
        onCrumb={(source, index) => controller.pickCrumb(source, index)}
        onDismiss={() => controller.dismiss()} />
      <textarea ref={editor} aria-label="输入增强验证草稿" defaultValue="" rows={4}
        onChange={event => runtime.edit(event.currentTarget.value, event.currentTarget.selectionStart)}
        onSelect={event => {
          if (!state.composing && event.currentTarget.selectionStart !== state.caret) runtime.edit(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onCompositionStart={() => runtime.setComposing(true)}
        onCompositionEnd={event => runtime.edit(event.currentTarget.value, event.currentTarget.selectionStart, false)}
        onKeyDown={event => {
          const key = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', Escape: 'escape', Tab: event.shiftKey ? 'tabBack' : 'tab' }[event.key];
          if (key && controller.arbitrate(key, state.composing || event.nativeEvent.isComposing) !== 'pass') event.preventDefault();
        }} />
    </div>
    <div className="input-validation-actions">
      <button type="button" onClick={() => runtime.setEnabled(!state.enabled)} data-testid="input-source-toggle">
        {state.enabled ? '停用提示词源' : '启用提示词源'}
      </button>
      <button type="button" onClick={() => runtime.edit('', 0, false)}>清空草稿</button>
    </div>
    <p data-testid="input-state">草稿版本 {state.revision} · 成功插入 {state.applied} · 拒绝过期/非法插入 {state.rejected}</p>
  </section>;
}
