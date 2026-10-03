/** 仅持久化用户选择的原件；电脑签发的 receipt/file 引用不能跨连接恢复。 */
export function attachmentDrafts(items, sendingIds = []) {
  return items.filter(item => item.source instanceof Blob).map(item => ({
    id: item.id, name: item.name, bytes: item.source.size, source: item.source,
    ...(item.kind === 'image' ? { kind: 'image', mediaType: item.mediaType } : {}),
    uncertain: item.state === 'uncertain' || sendingIds.includes(item.id),
  }));
}

export function restoreAttachmentDrafts(records) {
  if (!Array.isArray(records)) throw new Error('remote_attachment_draft_invalid');
  return records.map(item => {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !(item.source instanceof Blob)
      || item.bytes !== item.source.size || typeof item.uncertain !== 'boolean'
      || (item.kind === 'image' && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(item.mediaType))) {
      throw new Error('remote_attachment_draft_invalid');
    }
    return { id: item.id, name: item.name, bytes: item.bytes, source: item.source,
      ...(item.kind === 'image' ? { kind: 'image', mediaType: item.mediaType } : {}),
      state: item.uncertain ? 'uncertain' : item.kind === 'image' ? 'ready' : 'restored' };
  });
}
