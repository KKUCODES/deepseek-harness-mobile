import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { COMMAND_PRIORITY_CRITICAL, INSERT_LINE_BREAK_COMMAND, KEY_ENTER_COMMAND } from 'lexical';
import { ComposerContentEditable } from '../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/ComposerContentEditable.tsx';
import { DecoratorPortals } from '../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/DecoratorPortals.tsx';
import { registerComposerKeymap } from '../../../deepseek-harness/packages/client/ui-conversation/src/client/input/editor/keymap.ts';
import { MobileComposer } from './MobileComposer.jsx';
import { useTranslate } from './locale.jsx';
import { RemoteComposerBar, useRemoteConversationLayout } from '../remote-plugin-slots.jsx';

const inputErrors = {
  remote_attachment_expired: '附件已变化，请检查后重新发送。',
  remote_draft_invalid: '消息过长，请缩短后发送。',
  remote_submission_pending: '上一条消息正在提交，请稍候。',
};

function Editor({ shell, label, placeholder, setElement, locked }) {
  const wrap = useRef(null);
  useLayoutEffect(() => { setElement(wrap.current.querySelector('[data-composer-input]')); return () => setElement(null); });
  return <div ref={wrap} style={{ display: 'contents' }}>
    <ComposerContentEditable editor={shell.editor} editable={!locked} aria-label={label} data-placeholder={placeholder}
      data-empty={shell.snapshot.draft === '' || undefined} onKeyDown={event => {
        if (!event.defaultPrevented && event.key === 'Escape') { event.stopPropagation(); event.currentTarget.blur(); }
      }}/>
    <DecoratorPortals editor={shell.editor}/>
  </div>;
}

/** 使用原 DSH 编辑器与引用提交机器，布局和工具栏继续由共享 MobileComposer 提供。 */
export function RemoteComposer({ model, view = model, attachments, onAdmissionChange, ...props }) {
  const t = useTranslate();
  const layout = useRemoteConversationLayout();
  const requiresWorkspace = !!layout?.requiresWorkspace;
  const placeholder = requiresWorkspace ? t('先选择工作区，再开始聊天') : props.placeholder;
  const [binding] = useState(() => model.inputBindings.forBinding(view.reference.binding));
  const [input] = useState(() => binding.mount(view.reference, view));
  const shell = input.shell;
  const blockStore = model.composerBlocks.storeFor(input.sessionId);
  const block = useSyncExternalStore(blockStore.subscribe, blockStore.getSnapshot);
  const snapshot = useSyncExternalStore(shell.state.subscribe, shell.state.getSnapshot);
  useSyncExternalStore(model.agentPresets.subscribe, model.agentPresets.getSnapshot);
  const notice = useSyncExternalStore(shell.notices.subscribe, shell.notices.getSnapshot);
  const admitting = useSyncExternalStore(input.admission.subscribe, input.admission.getSnapshot);
  useEffect(() => { onAdmissionChange?.(admitting); return () => onAdmissionChange?.(false); }, [admitting, onAdmissionChange]);
  const latest = useRef(props); latest.current = { ...props, disabled: props.disabled || requiresWorkspace,
    filePickerDisabled: props.filePickerDisabled || requiresWorkspace };
  input.canSubmit = () => !blockStore.getSnapshot() && !model.agentPresets.pendingSessions.has(input.sessionId) && !model.draftTransfers.has(input.sessionId)
    && !latest.current.disabled && !latest.current.stopping;
  useEffect(() => () => binding.unmount(input), [binding, input]);
  useEffect(() => input.shell.bindFilePicker({
    available: () => input.current() && (!input.pending || input.adjudicating)
      && !blockStore.getSnapshot() && !latest.current.filePickerDisabled && typeof latest.current.onPickFiles === 'function',
    open: () => latest.current.onPickFiles?.(),
  }), [input, blockStore]);
  useLayoutEffect(() => { input.sync(); }, [input, props.value, attachments, admitting]);
  useEffect(() => {
    // 手机 Enter 保留换行；候选选择和 Ctrl/⌘+Enter 仍交原键盘仲裁。
    let composingUntil = 0;
    const compositionEnd = () => { composingUntil = Date.now() + 10; };
    const compositionWatch = shell.editor.registerRootListener((root, previous) => {
      previous?.removeEventListener('compositionend', compositionEnd);
      root?.addEventListener('compositionend', compositionEnd);
    });
    const mobileEnter = shell.editor.registerCommand(KEY_ENTER_COMMAND, event => {
      if (!event || event.shiftKey || event.ctrlKey || event.metaKey || event.isComposing || event.keyCode === 229
        || shell.editor.isComposing() || shell.editor.getRootElement()?.hasAttribute('data-composer-composing')
        || Date.now() < composingUntil) return false;
      event.preventDefault();
      if (shell.arbitrate('enter', false) === 'pass') shell.editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
      return true;
    }, COMMAND_PRIORITY_CRITICAL);
    const keyboard = registerComposerKeymap(shell.editor, {
      arbitrate: (key, composing) => shell.arbitrate(key, composing),
      space: () => shell.space(), dismissPopup: () => shell.dismissPopup(),
      canSubmit: () => input.current() && input.canSubmit(),
      submit: () => input.submit('queue'), pasteText: text => shell.paste(text),
      intakeFiles: files => { if (input.current() && !blockStore.getSnapshot() && !latest.current.disabled) for (const file of files) void model.upload(file, input.sessionId).catch(error => shell.notify('error', error.message)); },
    });
    return () => { compositionWatch(); mobileEnter(); keyboard(); };
  }, [input, model, shell, blockStore]);
  const locked = requiresWorkspace || admitting || model.draftTransfers.has(input.sessionId) || model.agentPresets.pendingSessions.has(input.sessionId) || ['adjudicating', 'submitting'].includes(snapshot.phase);
  return <>
    {block && <p role="status">{block.reason}</p>}
    {notice && <p role={notice.level === 'error' ? 'alert' : 'status'}>{t(inputErrors[notice.text] ?? notice.text)}</p>}
    <RemoteComposerBar input={snapshot} blocked={block} disabled={props.disabled || locked} placeholder={placeholder}>
    <MobileComposer {...props} placeholder={placeholder} value={snapshot.draft} disabled={props.disabled || locked || (!!block && !props.stopping)}
      attachDisabled={props.disabled || locked || !!block}
      onAttach={() => { if (!blockStore.getSnapshot()) props.onAttach?.(); }}
      onSend={() => { if (props.stopping) props.onSend(); else if (input.current() && !props.disabled) input.submit('queue'); }}
      renderEditor={editorProps => <Editor {...editorProps} shell={shell} locked={locked || !!block}/>}/>
    </RemoteComposerBar>
  </>;
}
