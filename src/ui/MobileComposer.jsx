import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconPlusOutline16, IconSendOutline14 } from '@upstream/ui-primitives/src/icons/index.tsx';
import inputStyle from '@upstream/ui-conversation/src/client/skeleton/InputBar.module.css';

// 普通聊天与 Remote 共用同一输入框，避免两态布局和反向动效各自演变。
export function MobileComposer({ value, onChange, onSend, onAttach, IconButton, toolbar, label = '消息', placeholder = '发消息，聊聊你的想法', sendLabel = '发送消息', attachLabel = '添加附件', disabled = false, attachDisabled = disabled, keepExpanded = false, companionRef, editorRef, inputProps = {}, overlay, stopping = false, hasAttachments = false, renderEditor }) {
  const [focused, setFocused] = useState(false);
  const input = useRef(null);
  const composer = useRef(null);
  const snapshot = useRef(null);
  const animations = useRef([]);
  const pointerDown = useRef(false), pendingBlur = useRef(false), finishBlur = useRef(null);
  function changeFocus(next) {
    if (next === focused) return;
    const elements = [...composer.current.querySelectorAll('.composer-surface, textarea, [data-composer-input], button'), companionRef?.current?.querySelector('.welcome')].filter(Boolean);
    snapshot.current = elements.map(element => ({ element, rect: element.getBoundingClientRect(), opacity: getComputedStyle(element).opacity }));
    animations.current.forEach(animation => animation.cancel());
    setFocused(next);
  }
  finishBlur.current = () => {
    if (!keepExpanded && composer.current && !composer.current.contains(document.activeElement)) changeFocus(false);
  };
  useEffect(() => {
    let timer;
    const down = () => { pointerDown.current = true; };
    const settle = (delay = 0) => {
      clearTimeout(timer);
      // 等本次点击分发完再改变高度，避免 blur 在按下/松开之间移动外部按钮。
      timer = setTimeout(() => { pointerDown.current = false; if (pendingBlur.current) { pendingBlur.current = false; finishBlur.current(); } }, delay);
    };
    // 触摸的兼容鼠标事件可能晚于 pointerup 的零延时定时器；以 click
    // 作为正常点击的结束边界。未产生 click 的手势也必须最终释放状态。
    const up = () => settle(500), click = () => settle(), cancel = () => settle();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('click', click, true);
    document.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = '0px';
    field.style.height = `${focused ? Math.min(144, Math.max(64, field.scrollHeight)) : 24}px`;
    if (!focused) field.scrollTop = 0;
  }, [value, focused]);
  useLayoutEffect(() => {
    const before = snapshot.current;
    snapshot.current = null;
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animations.current = before.filter(({ element }) => element.isConnected).map(({ element, rect, opacity }) => {
      const after = element.getBoundingClientRect();
      const scale = element.classList.contains('composer-surface') ? ` scale(${rect.width / after.width}, ${rect.height / after.height})` : '';
      return element.animate([{ transform: `translate(${rect.left - after.left}px, ${rect.top - after.top}px)${scale}`, opacity, visibility: 'visible' }, { transform: 'none', opacity: getComputedStyle(element).opacity, visibility: 'visible' }], { duration: focused ? 300 : 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
  }, [focused]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => animations.current.forEach(animation => animation.cancel());
    preference.addEventListener('change', stop);
    return () => { preference.removeEventListener('change', stop); stop(); };
  }, []);
  return <div className="composer-area"><div ref={composer} data-composer-card className={`${inputStyle.card} composer ${focused ? 'is-focused' : 'is-compact'}`}
    onFocusCapture={event => { pendingBlur.current = false; if (event.target === input.current) changeFocus(true); }}
    onBlurCapture={event => {
      if (event.currentTarget.contains(event.relatedTarget) || keepExpanded) return;
      if (pointerDown.current) pendingBlur.current = true;
      else changeFocus(false);
    }}>
    <div className={`${inputStyle.card} composer-surface`} aria-hidden="true"/>
    {overlay}
    {renderEditor ? renderEditor({ label, placeholder, setElement: element => { input.current = element; if (editorRef) editorRef.current = element; } })
      : <textarea {...inputProps} ref={element => { input.current = element; if (editorRef) editorRef.current = element; }} aria-label={label} placeholder={placeholder} value={value} maxLength={100000} rows={1} onChange={event => onChange(event.target.value, event)} onKeyDown={event => { inputProps.onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'Escape') { event.stopPropagation(); event.currentTarget.blur(); } }}/>}
    <div className="composer-toolbar">
      <IconButton label={attachLabel} className="icon-button attach" disabled={attachDisabled} onClick={onAttach}><IconPlusOutline16 size={20}/></IconButton>
      {toolbar?.(focused)}
      <IconButton variant="primary" label={sendLabel} className="icon-button send" disabled={disabled || (!stopping && !value.trim() && !hasAttachments)} onClick={onSend}>{stopping ? <span className="stop-square"/> : <IconSendOutline14 size={20}/>}</IconButton>
    </div>
  </div></div>;
}
