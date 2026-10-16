import React, { useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { requestOptions, DEFAULT_REQUEST_OPTIONS } from '../ordinary-options.mjs';
import { useTranslate } from './locale.jsx';
import { ordinaryError } from '../ordinary-errors.mjs';

export function RequestOptions({ value, thinking, model, onSave }) {
  const t = useTranslate();
  const normalize = value => { const result = requestOptions(value); return model?.thinking === 'reasoning_effort' && result.reasoningEffort === 'max' ? { ...result, reasoningEffort: 'high' } : result; };
  const [options, setOptions] = useState(() => normalize(value));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (name, next) => setOptions(previous => ({ ...previous, [name]: next }));
  return <form className="request-options" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(requestOptions(options)); }
    catch (failure) { setError(t(ordinaryError(failure))); }
    finally { setBusy(false); }
  }}>
    <p>{t('只影响这条聊天之后发送的消息，已有回复保持不变。')}</p>
    <label>{t('输出上限（Token）')}<input type="number" min="1" max="393216" step="1" placeholder={model?.thinking === 'deepseek' ? thinking ? '16384' : '8192' : t('服务端默认')} value={options.maxTokens ?? ''} onChange={event => change('maxTokens', event.target.value === '' ? null : Number(event.target.value))}/></label>
    <p className="muted">{t('留空使用默认上限。上限越高，长回复可能消耗更多额度。')}</p>
    {thinking && ['deepseek', 'reasoning_effort'].includes(model?.thinking ?? 'deepseek') ? <>
      <label>{t('思考强度')}<select value={options.reasoningEffort} onChange={event => change('reasoningEffort', event.target.value)}>{[['low', '较少'], ['high', '标准'], ...(model?.thinking === 'reasoning_effort' ? [] : [['max', '最多']])].map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>
      {model?.thinking !== 'reasoning_effort' && <><label>{t('思考模式采样范围')}<input type="number" min="0.95" max="1" step="0.01" value={options.topP} onChange={event => change('topP', Number(event.target.value))}/></label><p className="muted">{t('通常保持 1；更低的数值收窄采样范围。')}</p></>}
    </> : !thinking && model?.sampling !== false ? <><label>{t('回答随机性')}<input type="number" min="0" max="2" step="0.1" value={options.temperature} onChange={event => change('temperature', Number(event.target.value))}/></label><p className="muted">{t('0 更稳定，2 更发散；深度思考时不使用此项。')}</p></> : null}
    {error && <p role="alert">{error}</p>}
    <div className="attachment-options"><Button type="button" variant="outline" disabled={busy} onClick={() => setOptions(normalize(DEFAULT_REQUEST_OPTIONS))}>{t('恢复默认')}</Button><Button type="submit" variant="primary" disabled={busy}>{t('保存')}</Button></div>
  </form>;
}
