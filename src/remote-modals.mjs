/** 原图库/Modal使用body portal而非native dialog；返回沿用其公开Escape关闭合同。 */
export function dismissRemotePortalModal(document) {
  const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].findLast(element =>
    element.tagName !== 'DIALOG' && element.getClientRects().length > 0
    && !element.closest('[inert], [aria-hidden="true"], [data-motion-presence="closed"]'));
  if (!modal) return false;
  modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return true;
}
