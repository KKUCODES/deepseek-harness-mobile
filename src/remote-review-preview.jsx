import React, { useCallback, useEffect, useState } from 'react';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { ReviewTab } from '@upstream/ui-deliverables/src/client/ReviewTab.tsx';
import { changesReviewDefinition, CHANGES_REVIEW_ID } from '@upstream/ui-deliverables/src/client/review-definition.ts';
import { createReviewStore } from '@upstream/ui-deliverables/src/client/review-store.ts';
import { NS, zh, en } from '@upstream/ui-deliverables/src/client/locales.ts';
import { parseChangesReviewAddress, changesSummaryUrl, changedFileUrl } from '@upstream/ui-deliverables/src/changes.ts';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteReviewStore } from './remote-review-store.mjs';
import { desktopRequest, desktopError } from './remote-desktop.mjs';
import { changesError } from './remote-changes.mjs';
import { RemoteDesktopOpen } from './ui/RemoteDesktopOpen.jsx';
import { useTranslate } from './ui/locale.jsx';

export { CHANGES_REVIEW_ID };

/** 原比较组件、标签和偏好不变，只适配分片读取及手机端电脑打开确认。 */
export function installRemoteReviewPreview(model) {
  if (!model.transport.capabilities?.channels?.includes('changes')) return;
  const { ctx } = model, records = new RemoteReviewStore(model);
  const host = createSnapshotStore(null), opened = createSnapshotStore({});
  let hostPending, hostGeneration = new AbortController();
  const loadHost = () => {
    if (hostPending) return hostPending;
    if (!model.transport.capabilities.desktopOpen) { host.set('error'); return Promise.resolve(); }
    const signal = AbortSignal.any([hostGeneration.signal, model.lifetime.signal]);
    const task = desktopRequest(model, null, signal).then(value => { if (!signal.aborted) host.set(value); },
      () => { if (!signal.aborted) host.set('error'); });
    hostPending = task;
    void task.finally(() => { if (hostPending === task) hostPending = undefined; });
    return task;
  };
  ctx.on('connection/reset', () => {
    hostGeneration.abort(); hostGeneration = new AbortController(); hostPending = undefined;
    host.set(null); opened.set({}); records.reset();
  });
  ctx.effect(() => () => { hostGeneration.abort(); return records.dispose(); });
  ctx.locale.register(NS, { zh, en });
  ctx.sidebarRightTabs.register(changesReviewDefinition(ctx.locale.bind(NS)));
  ctx.slots.register({ name: 'sidebar.right.pane.tab', key: CHANGES_REVIEW_ID, locale: NS, store: createReviewStore(),
    inject: () => ({ model, records, opened,
      hooks: { changesSummary: records.summaries, changesDiff: records.diffs, reviewErrors: records.errors,
        presentedOpen: opened, presentedHost: host },
      loadChangesSummary: records.loadSummary, loadChangesDiff: records.loadDiff, reloadPresentedHost: loadHost,
    }),
  }, MobileReviewTab);
  model.reviewPreview = true;
  return { records, host, opened, loadHost };
}

function MobileReviewTab(props) {
  const { model, useTabInfo, useChangesSummary, useReviewErrors, usePresentedHost } = props;
  const { tab } = useTabInfo(), coordinates = parseChangesReviewAddress(tab.contentId);
  const source = changesSummaryUrl(coordinates.sessionId, coordinates.seq);
  const summary = useChangesSummary(value => value[source]), error = useReviewErrors(value => value[source]);
  const host = usePresentedHost(value => value), t = useTranslate();
  const selectedIndex = props.useStore(value => value.byTab[tab.id]?.index);
  const [target, setTarget] = useState(null);
  // 原组件按当前会话读取；跨会话地址不允许被静默解释成另一份改动。
  const invalid = coordinates.sessionId !== props.sessionId || typeof summary === 'object' && summary.turn !== coordinates.turn;
  const nativeBusy = useCallback(busy => {
    if (!target) return;
    const key = changedFileUrl(target.sessionId, target.seq, target.index);
    props.opened.update(state => { if (busy) state[key] = 'opening'; else delete state[key]; });
  }, [target, props.opened]);
  useEffect(() => { setTarget(null); }, [tab.navigation, selectedIndex, host === null]);
  if (invalid || summary === 'error') return <div role="alert"><p>{t(changesError(error ?? new Error('remote_changes_invalid')))}</p>
    {!invalid && <Button onClick={() => void props.loadChangesSummary(coordinates.sessionId, coordinates.seq)}>{t('重新读取')}</Button>}</div>;
  return <div className="remote-document-content">
    {host === 'error' && model.transport.capabilities.desktopOpen && <div role="status">{t(desktopError(new Error('remote_desktop_invalid')))}
      <Button onClick={() => void props.reloadPresentedHost()}>{t('重新读取')}</Button></div>}
    {target && <RemoteDesktopOpen key={target.id} model={model} autoPrepare onBusyChange={nativeBusy}
      file={{ sessionId: target.sessionId, path: target.path, desktopSource: { source: 'changes', seq: target.seq, index: target.index } }}/>}
    <ReviewTab {...props} openChanged={(sessionId, seq, index) => {
      const file = typeof summary === 'object' ? summary.files[index] : undefined;
      if (file && sessionId === coordinates.sessionId && seq === coordinates.seq) setTarget({ sessionId, seq, index, path: file.path, id: crypto.randomUUID() });
      return Promise.resolve();
    }}/>
  </div>;
}
