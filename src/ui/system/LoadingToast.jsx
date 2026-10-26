import React, { useEffect, useState } from 'react';
import { Surface } from '../Surface.jsx';
import { DesignButton } from './Primitives.jsx';
import { DesignIcon } from './Icons.jsx';

/** 由操作状态控制；loading 不定时消失。遮罩和拦截独立，拦截时必须提供退出操作。 */
export function LoadingToast({ state = 'loading', message, mask = false, block = false, onCancel, cancelLabel, delay = 200 }) {
  const [shown, setShown] = useState(block || state !== 'loading' || delay === 0);
  useEffect(() => {
    if (block || state !== 'loading' || delay === 0) { setShown(true); return; }
    setShown(false);
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [state, delay, block]);
  if (block && !onCancel) throw Error('Blocking LoadingToast requires a safe cancellation action');
  if (!shown) return null;
  const content = <div className={`dshm-toast dshm-toast--${state}`} role={state === 'error' ? 'alert' : 'status'}>
    <DesignIcon name={state === 'loading' ? 'loader' : state === 'success' ? 'check' : 'alert'} size={32} className={state === 'loading' ? 'dshm-spinner' : ''}/>
    <p>{message}</p>{block && <DesignButton kind="ghost" onClick={onCancel}>{cancelLabel}</DesignButton>}
  </div>;
  return block ? <div className={`dshm-design dshm-toast-layer${mask ? ' has-mask' : ''}`}><Surface title={message} onClose={onCancel} className={`dshm-design dshm-toast-modal${mask ? ' has-mask' : ''}`}>{content}</Surface></div>
    : <div className={`dshm-design dshm-toast-host${mask ? ' has-mask' : ''}`}>{content}</div>;
}
