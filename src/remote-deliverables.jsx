import React, { useCallback, useEffect, useState } from 'react';
import { DeliverablesTail } from '@upstream/ui-deliverables/src/client/Deliverables.tsx';
import { PresentRow } from '@upstream/ui-deliverables/src/client/PresentRow.tsx';
import { changesForClosing, presentedForClosing, producedFileMentions, selectProducedFiles } from '@upstream/ui-deliverables/src/client/turn-deliverables.ts';
import { useTurnDataValue } from '@upstream/ui-chat/src/client/chat/use-turn-data.ts';
import { changesReviewAddress, changesSummaryUrl } from '@upstream/ui-deliverables/src/changes.ts';
import { presentedFileUrl } from '@upstream/ui-deliverables/src/presented.ts';
import { NS } from '@upstream/ui-deliverables/src/client/locales.ts';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { supportsDeliverables } from './remote-plugin-policy.mjs';
import { isProfileDshVersion } from './remote-dsh-version.mjs';
import { changesError } from './remote-changes.mjs';
import { RemoteDesktopOpen } from './ui/RemoteDesktopOpen.jsx';
import { RemoteFilePreview } from './ui/RemoteFilePreview.jsx';
import { useTranslate } from './ui/locale.jsx';

/** 原轮数据、卡片与工具行共用 ReviewTab 的读取状态；桌面动作由手机确认。 */
export function installRemoteDeliverables(model, face) {
  if (!face || !supportsDeliverables(model.transport.capabilities)) return;
  const latest = isProfileDshVersion(model.transport.capabilities.dshVersion);
  const { records, host, opened, loadHost } = face;
  // 文档服务随资源模块异步注册；依赖注入必须等待就绪，不能只在启动时检查一次。
  model.ctx.inject(['documentPreviews', ...(latest ? ['configForms'] : [])], ctx => {
    ctx.slots.register({ name: 'conversation.chat.turnTail', id: '@deepseek-ai/dsh-client-ui-deliverables', locale: NS,
      ...(latest ? { children: { 'deliverables.file.actions': { kind: 'list', scope: 'session' } } } : {}),
      inject: () => ({ model, opened,
        hooks: { presentedOpen: opened, presentedHost: host, changesSummary: records.summaries, reviewErrors: records.errors,
          ...(latest ? { changesDiff: records.diffs, showCodeDiff: ctx.configForms.developerTools.enabled } : {}) },
        reloadPresentedHost: loadHost, loadChangesSummary: records.loadSummary, loadChangesDiff: records.loadDiff,
        openChangesReview: (coordinates, index) => ctx.sidebarRight.openResource(changesReviewAddress(coordinates), { params: { index } }),
      }),
    }, MobileDeliverablesTail);
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'present', locale: NS }, PresentRow));
    const t = ctx.locale.bind(NS);
    ctx.provide('chatFileMentions', { forClosing(owner) {
      const paths = selectProducedFiles(owner), presented = presentedForClosing(owner);
      if (paths === null && presented.length === 0) return undefined;
      return producedFileMentions([...new Set([...paths ?? [], ...presented.map(file => file.path)])], owner.openFile,
        path => t('presented.previewButton', { name: path }));
    } });
    model.deliverablesPreview = true;
    ctx.effect(() => () => { model.deliverablesPreview = false; });
  });
}

function MobileDeliverablesTail(props) {
  const { model, sessionId, opened } = props, t = useTranslate();
  // 交付与变更事件可能晚于最终文字，必须订阅原轮数据而非只依赖父节点重绘。
  useTurnDataValue(props.turn.data, 'deliverables');
  const announced = changesForClosing(props), presented = presentedForClosing(props);
  const source = announced && changesSummaryUrl(sessionId, announced.seq);
  const summary = props.useChangesSummary(state => source ? state[source] : undefined);
  const error = props.useReviewErrors(state => source ? state[source] : undefined);
  const host = props.usePresentedHost(value => value);
  const [target, setTarget] = useState(null), [preview, setPreview] = useState(null);
  useEffect(() => { setTarget(null); setPreview(null); }, [sessionId, props.turn, host === null]);
  const nativeBusy = useCallback(busy => {
    if (!target) return;
    const key = presentedFileUrl(sessionId, target.seq, target.index);
    opened.update(state => { if (busy) state[key] = target.action === 'reveal' ? 'revealing' : 'opening'; else delete state[key]; });
  }, [target, sessionId, opened]);
  const file = value => ({ sessionId, path: value.path, desktopSource: { source: 'presented', seq: value.seq, index: value.index } });
  if (!announced && presented.length === 0) return null;
  return <div data-remote-deliverables>
    {summary === 'error' && <div role="alert">{t(changesError(error ?? new Error('remote_changes_invalid')))}
      <Button onClick={() => void props.loadChangesSummary(sessionId, announced.seq)}>{t('重新读取')}</Button></div>}
    <DeliverablesTail {...props} openFile={path => {
      const value = presented.find(item => item.path === path);
      if (value) setPreview(file(value));
    }} openPresented={(id, seq, index, action) => {
      const value = presented.find(item => item.seq === seq && item.index === index);
      if (id === sessionId && value && ['open', 'reveal'].includes(action)) setTarget({ ...value, action, id: crypto.randomUUID() });
      return Promise.resolve();
    }}/>
    {preview && <RemoteFilePreview model={model} file={preview} onClose={() => setPreview(null)}/>}
    {target && <RemoteDesktopOpen key={target.id} model={model} file={file(target)} initialAction={target.action} autoPrepare onBusyChange={nativeBusy} onCancel={() => setTarget(null)}/>}
  </div>;
}
