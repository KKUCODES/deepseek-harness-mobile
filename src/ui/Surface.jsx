import React, { useEffect, useRef } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

export function IconButton({ label, children, ...props }) {
  return <Button className="icon-button" aria-label={label} title={label} {...props}>{children}</Button>;
}

export function Surface({ kind, title, onClose, children, className = '', open = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    ref.current.showModal();
    return () => { ref.current?.close(); before?.focus?.(); };
  }, [open]);
  return <dialog ref={ref} className={`${kind === 'drawer' ? 'drawer' : 'sheet'} ${className}`} aria-label={title}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>{children}</dialog>;
}
