import React, { useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';
import { diagnostics } from '../app-diagnostics.mjs';

/** 渲染失败只撤下出错区域；恢复不执行发送、工具或审批动作。 */
export class RemoteErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    diagnostics.record(this.props.logDomain ?? 'remote', 'render_failed', { level: 'ERROR', code: 'render_failed', error });
  }
  componentDidUpdate(previous) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed && this.props.fallback) return this.props.fallback;
    return this.state.failed ? <Recovery message={this.props.message} onRetry={async () => {
      await this.props.onRecover?.(); this.setState({ failed: false });
    }}/> : this.props.children;
  }
}
function Recovery({ message = '聊天显示遇到问题，可以重新读取。', onRetry }) {
  const t = useTranslate(), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <section className="remote-render-recovery" role="alert">
    <p>{t(message)}</p><Button disabled={busy} onClick={() => {
      setBusy(true); setError(false);
      void onRetry().catch(() => setError(true)).finally(() => setBusy(false));
    }}>{t(busy ? '正在恢复…' : '重新显示')}</Button>
    {error && <p>{t('暂时无法恢复，请检查电脑连接后重试。')}</p>}
  </section>;
}
