import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MobileComposer } from './ui/MobileComposer.jsx';

/** 草稿仍由 OrdinaryChat 持久化；插件只通过带版本的纯文本插入修改它。 */
export function OrdinaryComposer({ chatId, draft, editDraft, busy, runtime, renderSlot, SessionProvider, mobile }) {
  const plugin = useSyncExternalStore(runtime.state.subscribe, runtime.state.getSnapshot);
  const [binding, setBinding] = useState(null);
  const [failure, setFailure] = useState('');
  const editor = useRef(null);
  const state = useRef({ text: draft, revision: 0, composing: false, caret: draft.length });
  const latest = useRef({ editDraft, busy });
  latest.current = { editDraft, busy };
  const currentBinding = useRef(null);
  const track = () => {
    const current = state.current;
    currentBinding.current?.controller.track(current.text, current.caret,
      { tier: current.composing || latest.current.busy ? 'frozen' : 'plain' }, current.revision);
  };
  const edit = (text, caret, composing = state.current.composing) => {
    const current = state.current;
    current.revision += Number(current.text !== text);
    current.text = text; current.caret = caret; current.composing = composing;
    latest.current.editDraft(text); track();
  };
  useEffect(() => {
    if (!plugin.enabled) return;
    let alive = true;
    let owned;
    void runtime.bind(chatId, ({ text, span }) => {
      const current = state.current;
      if (!alive || latest.current.busy || current.composing || !runtime.state.getSnapshot().sourceEnabled
        || typeof text !== 'string' || span?.draftRev !== current.revision
        || !Number.isInteger(span.start) || !Number.isInteger(span.end)
        || span.start < 0 || span.end < span.start || span.end > current.text.length
        || current.text.length - (span.end - span.start) + text.length > 100000) return false;
      edit(current.text.slice(0, span.start) + text + current.text.slice(span.end), span.start + text.length);
      return true;
    }).then(value => {
      owned = value;
      if (!alive) { void value.dispose(); return; }
      currentBinding.current = value; setBinding(value); track();
    }).catch(() => { if (alive) setFailure('输入插件启动失败，仍可直接输入文字。'); });
    return () => { alive = false; currentBinding.current = null; setBinding(null); void owned?.dispose(); };
  }, [chatId, plugin.enabled, plugin.generation, runtime]);
  useLayoutEffect(() => {
    const current = state.current;
    if (current.text !== draft) { current.text = draft; current.revision++; current.caret = draft.length; }
    if (editor.current && !current.composing && editor.current.value !== draft) {
      editor.current.value = draft;
      if (document.activeElement === editor.current) editor.current.setSelectionRange(current.caret, current.caret);
    }
    track();
  }, [draft, busy]);
  const overlay = plugin.enabled && binding?.active && <SessionProvider session={binding.sessionId}>
    {renderSlot('conversation.input.overlay', {})}
  </SessionProvider>;
  const inputProps = {
    onSelect: event => { if (!state.current.composing) { state.current.caret = event.currentTarget.selectionStart; track(); } },
    onCompositionStart: () => { state.current.composing = true; track(); },
    onCompositionEnd: event => edit(event.currentTarget.value, event.currentTarget.selectionStart, false),
    onKeyDown: event => {
      const key = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', Escape: 'escape', Tab: event.shiftKey ? 'tabBack' : 'tab' }[event.key];
      const controller = currentBinding.current?.controller;
      if (key && controller && controller.arbitrate(key, state.current.composing || event.nativeEvent.isComposing) !== 'pass') event.preventDefault();
    },
  };
  if (mobile) return <>{failure && <p role="alert">{failure}</p>}<MobileComposer {...mobile} value={draft}
    onChange={(text, event) => edit(text, event.currentTarget.selectionStart)} editorRef={editor} inputProps={inputProps} overlay={overlay}/></>;
  return <>
    {failure && <p role="alert">{failure}</p>}
    <div data-composer-card className="input-validation-card" data-testid="ordinary-composer">
      {overlay}
      <textarea ref={editor} aria-label="普通聊天消息" defaultValue={draft} disabled={busy} maxLength={100000} rows={3}
        onChange={event => edit(event.currentTarget.value, event.currentTarget.selectionStart)}
        onSelect={event => { if (!state.current.composing) { state.current.caret = event.currentTarget.selectionStart; track(); } }}
        onCompositionStart={() => { state.current.composing = true; track(); }}
        onCompositionEnd={event => edit(event.currentTarget.value, event.currentTarget.selectionStart, false)}
        onKeyDown={event => {
          const key = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'enter', Escape: 'escape', Tab: event.shiftKey ? 'tabBack' : 'tab' }[event.key];
          const controller = currentBinding.current?.controller;
          if (key && controller && controller.arbitrate(key, state.current.composing || event.nativeEvent.isComposing) !== 'pass') event.preventDefault();
        }} />
    </div>
  </>;
}
