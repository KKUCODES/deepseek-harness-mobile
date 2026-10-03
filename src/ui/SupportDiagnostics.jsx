import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './Surface.jsx';
import { useTranslate } from './locale.jsx';
import { supportDiagnostics } from '../support-diagnostics.mjs';

export function SupportDiagnostics({ read, copy, onClose }) {
  const t = useTranslate();
  const [report, setReport] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const reader = useRef(read), operation = useRef(0);
  reader.current = read;
  async function refresh() {
    const owner = ++operation.current; setBusy(true); setNotice('');
    try {
      const source = await reader.current();
      if (operation.current === owner) setReport(supportDiagnostics(source));
    } catch { if (operation.current === owner) setNotice('无法读取诊断信息，请重试。'); }
    finally { if (operation.current === owner) setBusy(false); }
  }
  useEffect(() => { void refresh(); return () => { operation.current++; }; }, []);
  const text = report ? JSON.stringify(report, null, 2) : '';
  return <Surface title={t('问题诊断')} onClose={onClose}>
    <header><h2>{t('问题诊断')}</h2><IconButton label={t('关闭窗口')} onClick={onClose}><IconCloseOutline16/></IconButton></header>
    <p>{t('仅包含版本、连接状态和插件数量，不包含聊天、密钥或服务器地址。')}</p>
    <p className="muted">{t('信息为读取时的快照；未取得的版本或能力显示为 null。')}</p>
    {report && <pre data-testid="support-diagnostics" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '45dvh', overflow: 'auto', fontSize: 12 }}>{text}</pre>}
    {notice && <p role="status">{t(notice)}</p>}
    <Button disabled={busy} onClick={() => void refresh()}>{t(busy ? '正在读取' : '重新读取')}</Button>
    <Button disabled={busy || !report} onClick={async () => {
      const owner = ++operation.current; setBusy(true); setNotice('');
      try { await copy(text); if (operation.current === owner) setNotice('诊断信息已复制'); }
      catch { if (operation.current === owner) setNotice('复制未完成，请重试。'); }
      finally { if (operation.current === owner) setBusy(false); }
    }}>{t('复制诊断信息')}</Button>
  </Surface>;
}
