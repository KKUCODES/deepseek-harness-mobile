import React, { useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { planReviewOf } from '@upstream/ui-user-questions/src/client/contract/slots.ts';
import { useTranslate } from './locale.jsx';

/** 结果沿用 DSH 原审批/提问协议；失效由事件取消撤下组件。 */
export function RemoteInteraction({ event, model, view = model, renderContent }) {
  const t = useTranslate();
  const [answers, setAnswers] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  const settle = async outcome => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    // 提交后等待原事件生命周期撤下卡片，不在结果尚未同步时重新开放按钮。
    try { await model.answer(event.eventId, outcome, view); }
    catch { setError('未能确认处理结果，请核对电脑上的最新状态。'); }
  };
  const submit = value => settle({ kind: 'result', value });
  if (event.event === 'approval/request') return <section className="remote-tool-card" aria-label={t('等待审批')}>
    <h3>{t('需要你的批准')}</h3><strong>{event.request.toolName}</strong>
    {event.request.reason && renderContent(event.request.reason, false)}
    {error && <p role="alert">{t(error)}</p>}
    <div className="remote-actions"><Button disabled={busy} onClick={() => void submit('rejected')}>{t('拒绝')}</Button><Button variant="primary" disabled={busy} onClick={() => void submit('allowed-once')}>{t('允许一次')}</Button></div>
  </section>;
  const questions = event.request.questions;
  const review = planReviewOf(questions);
  if (review) return <section className="remote-tool-card" aria-label={t('等待计划确认')}>
    <h3>{t('确认计划')}</h3>
    {renderContent(review.plan, false)}
    {error && <p role="alert">{t(error)}</p>}
    <div className="remote-actions">
      <Button disabled={busy} onClick={() => void settle({ kind: 'cancel' })}>{t('提出修改')}</Button>
      <Button variant="primary" disabled={busy} title={review.approve.description}
        onClick={() => void submit({ answers: [{ id: review.id, selected: [review.approve.label] }] })}>{t('批准计划')}</Button>
    </div>
  </section>;
  const ready = questions.every(question => answers[question.id]?.selected?.length || answers[question.id]?.custom?.trim());
  const change = (id, patch) => setAnswers(current => ({ ...current, [id]: { selected: [], ...current[id], ...patch } }));
  return <section className="remote-tool-card" aria-label={t('等待回答')}>
    {questions.map(question => <fieldset key={question.id} disabled={busy}>
      <legend>{question.question}</legend>{question.detail && renderContent(question.detail, false)}
      {question.options?.map(option => <label className="remote-question-option" key={option.label}>
        <input type={question.multiSelect ? 'checkbox' : 'radio'} name={`${event.eventId}-${question.id}`} checked={answers[question.id]?.selected?.includes(option.label) ?? false}
          onChange={e => change(question.id, { selected: question.multiSelect ? (e.target.checked ? [...(answers[question.id]?.selected ?? []), option.label] : answers[question.id].selected.filter(label => label !== option.label)) : [option.label] })}/>
        <span>{option.label}{option.description && <small>{option.description}</small>}</span>
      </label>)}
      <textarea className="sheet-editor" aria-label={t('补充回答：{question}', { question: question.question })} placeholder={t('补充你的想法')} value={answers[question.id]?.custom ?? ''} onChange={e => change(question.id, { custom: e.target.value })}/>
    </fieldset>)}
    {error && <p role="alert">{t(error)}</p>}
    <Button variant="primary" disabled={busy || !ready} onClick={() => void submit({ answers: questions.map(question => ({ id: question.id, selected: answers[question.id]?.selected ?? [], ...(answers[question.id]?.custom?.trim() ? { custom: answers[question.id].custom.trim() } : {}) })) })}>{t('提交回答')}</Button>
  </section>;
}
