import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { OrdinaryTurn } from './ordinary-stream.mjs';
import { replayResponse } from './stream-fixtures.mjs';

const makeTurn = () => new OrdinaryTurn({ mode: 'ordinary', chatId: 'offline-validation', requestId: crypto.randomUUID() });
const labels = { idle: '未开始', sending: '读取中', streaming: '输出中', completed: '已完成', interrupted: '已中断', failed: '失败' };

export function StreamValidation() {
  const [turn, setTurn] = useState(makeTurn);
  const state = useSyncExternalStore(turn.subscribe, turn.getSnapshot);
  const busy = state.status === 'sending' || state.status === 'streaming';
  useEffect(() => () => turn.dispose(), [turn]);
  const replay = scenario => {
    turn.dispose();
    const next = makeTurn();
    setTurn(next);
    void next.run(() => replayResponse(scenario));
  };
  return <section>
    <h2>流协议离线验证</h2>
    <p>以下内容是预设测试数据，不调用模型。验证中文分片、推理与正文分离、断流和停止；内容不保存为聊天历史。</p>
    <div className="input-validation-actions">
      <button disabled={busy} onClick={() => replay('complete')} data-testid="stream-complete">回放完整响应</button>
      <button disabled={busy} onClick={() => replay('truncated')} data-testid="stream-truncated">回放断流</button>
      <button disabled={busy} onClick={() => replay('stalled')} data-testid="stream-stalled">回放等待响应</button>
      <button disabled={!busy} onClick={() => turn.stop()} data-testid="stream-stop">停止回放</button>
    </div>
    <p data-testid="stream-status" data-status={state.status} data-error={state.error ?? ''}>{labels[state.status]}{state.error ? ` · ${state.error}` : ''}</p>
    <p>推理字段：<span data-testid="stream-reasoning">{state.reasoning}</span></p>
    <p>正文字段：<span data-testid="stream-content">{state.content}</span></p>
  </section>;
}
