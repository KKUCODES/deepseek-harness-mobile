import React, { forwardRef, useId } from 'react';
import { Surface } from '../Surface.jsx';
import { DesignIcon } from './Icons.jsx';
import './system.css';

export function DesignButton({ kind = 'primary', loading = false, disabled, icon, children, className = '', ...props }) {
  return <button type="button" className={`dshm-button dshm-button--${kind} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <DesignIcon name="loader" size={20} className="dshm-spinner"/> : icon && <DesignIcon name={icon} size={20}/>}{children}
  </button>;
}

export function DesignIconButton({ label, icon, children, className = '', ...props }) {
  return <button type="button" className={`dshm-icon-button ${className}`} aria-label={label} title={label} {...props}>{icon ? <DesignIcon name={icon}/> : children}</button>;
}

export function AppBar({ title = 'Remote', onBack, backLabel, onMore, moreLabel, disabled = false }) {
  return <header className="dshm-app-bar">
    <div className="dshm-app-bar-slot">{onBack && <DesignIconButton icon="back" label={backLabel} onClick={onBack} disabled={disabled}/>}</div>
    <h1>{title}</h1>
    <div className="dshm-app-bar-slot">{onMore && <DesignIconButton icon="more" label={moreLabel} onClick={onMore}/>}</div>
  </header>;
}

export const TextField = forwardRef(function TextField({ label, icon, leading, action, error, hint, className = '', ...props }, ref) {
  const id = useId(), hintId = `${id}-hint`;
  return <div className={`dshm-field ${className}`}>
    <label htmlFor={id} className="dshm-field-label">{label}</label>
    <div className={`dshm-field-control${error ? ' is-error' : ''}`}>
      {leading ?? (icon && <DesignIcon name={icon} size={22}/>)}
      <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? hintId : undefined} {...props}/>
      {action && <button type="button" className="dshm-field-action" aria-label={action.label} disabled={action.disabled || props.disabled} onClick={action.onClick}>{action.icon ? <DesignIcon name={action.icon} size={20}/> : action.label}</button>}
    </div>
    {(error || hint) && <p id={hintId} className="dshm-field-hint">{error || hint}</p>}
  </div>;
});

export function ActionCard({ icon, title, description, onClick, disabled, primary = false }) {
  return <button type="button" className={`dshm-action-card${primary ? ' is-primary' : ''}`} disabled={disabled} onClick={onClick}>
    <DesignIcon name={icon} size={32}/><span><strong>{title}</strong>{description && <small>{description}</small>}</span>
    <DesignIcon name={primary ? 'chevronLight' : 'chevron'} size={20}/>
  </button>;
}

export function ListItem({ icon = 'folder', title, description, value, loading = false, className = '', ...props }) {
  return <button type="button" className={`dshm-list-item ${className}`} aria-busy={loading || undefined} {...props}>
    <DesignIcon name={loading ? 'loader' : icon} className={loading ? 'dshm-spinner' : ''}/>
    <span className="dshm-list-copy"><span className="dshm-list-title">{title}</span>{description && <span className="dshm-list-description">{description}</span>}</span>
    {value && <span className="dshm-list-value">{value}</span>}<DesignIcon name="chevron" size={20}/>
  </button>;
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`dshm-badge dshm-badge--${tone}`}>{children}</span>;
}

export function InlineAlert({ children, tone = 'error' }) {
  return <div className={`dshm-inline-alert dshm-inline-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><DesignIcon name="alert" size={20}/><div>{children}</div></div>;
}

export function StatusCard({ title, description, state = 'waiting', children }) {
  return <section className={`dshm-status-card dshm-status-card--${state}`} role="status">
    <DesignIcon name={state === 'waiting' ? 'loader' : state === 'success' ? 'check' : 'alert'} size={36} className={state === 'waiting' ? 'dshm-spinner' : ''}/>
    <h2>{title}</h2>{description && <p>{description}</p>}{children}
  </section>;
}

export function SkeletonRows({ count = 3, label }) {
  return <div className="dshm-skeletons" role="status" aria-label={label}>
    {Array.from({ length: count }, (_, i) => <div className="dshm-skeleton-row" key={i} aria-hidden="true"><span/><div><span/><span/></div></div>)}
  </div>;
}

export function EmptyState({ title, description, error = false, children }) {
  return <section className="dshm-empty-state"><DesignIcon name={error ? 'alert' : 'folder'} size={40}/><h2>{title}</h2>{description && <p>{description}</p>}{children}</section>;
}

/** 复用现有原生模态层、焦点恢复、Escape 和系统返回优先级。 */
export function DesignDialog({ title, description, children, onClose }) {
  return <Surface title={title} onClose={onClose} className="dshm-design dshm-dialog"><h2>{title}</h2>{description && <p>{description}</p>}<div className="dshm-dialog-actions">{children}</div></Surface>;
}
