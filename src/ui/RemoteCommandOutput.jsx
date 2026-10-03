import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteLiveCommandOutput } from '../remote-live-command-output.mjs';
import { RemoteOutputContent } from './RemoteLiveJobOutput.jsx';

import { useTranslate } from './locale.jsx';

export function RemoteCommandOutput({ model, target, retained }) {
  const t = useTranslate();
  const connected = useSyncExternalStore(model.subscribeView, model.getSnapshot).connectionState === 'connected';
  const [{ stream, mode, resume }, setSelection] = useState(() => ({ stream: retained.current?.stream ?? 'stdout',
    mode: retained.current?.mode ?? 'live', resume: retained.current?.reader }));
  // 主动换流或“从头查看”必须从零开始；只有窗口重建交接原读取位置。
  const setStream = value => setSelection(current => current.stream === value ? current : { stream: value, mode: current.mode });
  const setMode = value => setSelection(current => current.mode === value ? current : { stream: current.stream, mode: value });
  const reader = useMemo(() => new RemoteLiveCommandOutput(model, target, stream, mode, resume), [model, target, stream, mode, resume]);
  useEffect(() => {
    const capture = () => ({ stream, mode, reader: reader.checkpoint() });
    retained.capture = capture;
    return () => { retained.current = capture(); if (retained.capture === capture) delete retained.capture; };
  }, [retained, reader, stream, mode]);
  return <>
    <div role="group" aria-label={t('命令输出类型')}>
      <Button disabled={!connected} variant={stream === 'stdout' ? 'primary' : 'ghost'} aria-pressed={stream === 'stdout'} onClick={() => setStream('stdout')}>{t('标准输出')}</Button>
      <Button disabled={!connected} variant={stream === 'stderr' ? 'primary' : 'ghost'} aria-pressed={stream === 'stderr'} onClick={() => setStream('stderr')}>{t('错误输出')}</Button>
    </div>
    <div role="group" aria-label={t('命令读取方式')}>
      <Button disabled={!connected} variant={mode === 'live' ? 'primary' : 'ghost'} aria-pressed={mode === 'live'} onClick={() => setMode('live')}>{t('实时读取')}</Button>
      <Button disabled={!connected} variant={mode === 'history' ? 'primary' : 'ghost'} aria-pressed={mode === 'history'} onClick={() => setMode('history')}>{t('从头查看')}</Button>
    </div>
    <RemoteOutputContent reader={reader} mode={mode} label={t('独立命令输出')}/>
  </>;
}
