import React, { useLayoutEffect, useRef } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useSurfaceMotion } from './motion.jsx';

export function IconButton({ label, children, ...props }) {
  return <Button className="icon-button" aria-label={label} title={label} {...props}>{children}</Button>;
}

export function Surface({ kind, title, onClose, children, className = '', open = true }) {
  const ref = useRef(null);
  const { mounted, present } = useSurfaceMotion(ref, open, kind, className);
  useLayoutEffect(() => {
    if (!mounted) return;
    const before = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      const restore = dialog.contains(document.activeElement) || document.activeElement === document.body;
      dialog.close();
      if (restore && before?.isConnected && !before.closest('[inert]')) before.focus?.({ preventScroll: true });
    };
  }, [mounted]);
  useLayoutEffect(() => {
    const dialog = ref.current;
    // 退出尚未结束就重新打开时，同一实例需要重新进入原生模态层。
    if (present && dialog?.open && !dialog.matches(':modal')) { dialog.close(); dialog.showModal(); }
  }, [present, mounted]);
  if (!mounted) return null;
  return <><div className="surface-exit-backdrop" hidden={present} aria-hidden="true"/>
    <dialog ref={ref} className={`${kind === 'drawer' ? 'drawer' : 'sheet'} ${className}`} aria-label={title}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); if (present) onClose(); }}
    onClick={event => {
      if (!present || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>{children}</dialog></>;
}
