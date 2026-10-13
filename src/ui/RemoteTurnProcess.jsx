import React, { memo } from 'react';
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { turnProcessAlwaysOpen } from '@upstream/ui-chat/src/client/contract/turn-process.ts';
import { formatRunDuration } from '@upstream/ui-chat/src/client/chat/message-chrome.ts';
import a11yCss from '@upstream/ui-chat/src/client/chat/accessibility.module.css';
import css from '@upstream/ui-chat/src/client/chat/TurnProcessNodeView.module.css';
import { useTranslate } from './locale.jsx';

/** 手机自己的结算标题；电脑重启中断不能显示成功用时或折叠未知工具结果。 */
export const RemoteTurnProcess = memo(function RemoteTurnProcess({ node, turnProcess, t }) {
  const translate = useTranslate();
  if (turnProcess === undefined) throw new Error('turn-process node requires Turn process owner state');
  const open = !turnProcess.foldable || turnProcess.open;
  const turn = node.location.kind === 'turn' || node.location.kind === 'step' ? node.location.turn : undefined;
  if (turn?.status !== 'closed' || turn.end?.data.reason.kind === 'blocked') return null;
  const reason = turn.end?.data.reason.kind;
  const canCollapse = turnProcess.foldable && turnProcess.hasContent && !turnProcessAlwaysOpen(node);
  const elapsedMs = turn.start === undefined || turn.end === undefined ? undefined
    : Math.max(1000, turn.end.time - turn.start.time);
  const duration = elapsedMs === undefined || ['aborted', 'error', 'interrupted'].includes(reason) ? undefined
    : formatRunDuration(elapsedMs, t);
  const label = reason === 'interrupted' ? translate('已中断') : reason === 'aborted' ? t('message.stopped')
    : reason === 'error' ? t('message.turnProcess.failed')
      : duration === undefined ? t('message.turnProcess.worked') : t('message.turnProcess.took');
  const announcement = ['interrupted', 'aborted', 'error'].includes(reason) ? label : t('message.turnProcess.worked');
  return <>
    <span className={a11yCss.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    <button type="button" className={css.root} data-open={open || undefined}
      data-turn-process={node.data.turn} data-turn-process-messages={node.data.messageCount}
      data-turn-process-tool-calls={node.data.toolCallCount} data-turn-process-subagents={node.data.subagentCount}
      disabled={!canCollapse} aria-expanded={turnProcess.hasContent ? open : undefined}
      onClick={event => { event.currentTarget.focus(); turnProcess.setOpen(!open); }}>
      <span className={css.label}>{label}{duration?.map((part, index) =>
        <span key={index} className={part.numeric ? css.durationNumber : undefined}>{part.text}</span>)}</span>
      {canCollapse && <IconChevronDownOutlineRegular className={css.chevron}/>}
    </button>
  </>;
});
