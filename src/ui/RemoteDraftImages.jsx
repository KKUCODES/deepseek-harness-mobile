import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ComposerAttachments } from '@upstream/ui-attachment/src/client/ComposerAttachments.tsx';
import { zh, en } from '@upstream/ui-conversation/src/client/locales.ts';
import { useLocale } from './locale.jsx';

const ignoreDrop = () => undefined;
const unknownSubmission = '发送结果未知，请核对聊天记录后移除';

export function hasDraftImage(item) { return item.kind === 'image' && item.source instanceof Blob; }

export function RemoteDraftImages({ attachments, busy, onRemove, onRetry }) {
  const dictionary = useLocale()?.startsWith('en') ? en : zh;
  const translate = (key, values = {}) => (dictionary[key] ?? key)
    .replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  const originals = useMemo(() => attachments.filter(hasDraftImage), [attachments]);
  const cache = useRef(new Map());
  const [previews, setPreviews] = useState(cache.current);

  useEffect(() => {
    const next = new Map();
    for (const item of originals) {
      const previous = cache.current.get(item.id);
      const attachment = previous?.source === item.source ? previous : {
        id: item.id, kind: 'image', source: item.source,
        file: new File([item.source], item.name, { type: item.source.type }),
        previewUrl: URL.createObjectURL(item.source),
      };
      next.set(item.id, attachment);
    }
    for (const [id, preview] of cache.current) {
      if (next.get(id) !== preview) URL.revokeObjectURL(preview.previewUrl);
    }
    cache.current = next;
    setPreviews(next);
  }, [originals]);
  useEffect(() => () => {
    for (const preview of cache.current.values()) URL.revokeObjectURL(preview.previewUrl);
    cache.current.clear();
  }, []);

  const images = [], uploads = Object.create(null);
  for (const item of originals) {
    const preview = previews.get(item.id);
    if (preview?.source !== item.source) continue;
    images.push(preview);
    if (item.state === 'uploading') uploads[item.id] = { status: 'uploading', loaded: 0 };
    if (item.state === 'error' || item.state === 'restored') uploads[item.id] = { status: 'error', message: item.error };
    if (item.state === 'uncertain') uploads[item.id] = { status: 'error', reason: 'submission_uncertain', message: unknownSubmission };
  }
  if (!images.length) return null;

  return <div className="remote-draft-images" data-testid="remote-draft-images">
    <ComposerAttachments attachments={images} uploads={uploads} t={translate}
      canAcceptDrop={false} onAddFiles={ignoreDrop} readFileDrag={ignoreDrop}
      uploadFailureText={reason => reason === 'submission_uncertain'
        ? dictionary === en ? 'Delivery is unconfirmed. Check the conversation before removing this image.' : unknownSubmission
        : translate('file.uploadFailed')}
      onRemoveAttachment={id => { if (!busy) onRemove(id); }}
      onRetryFile={id => { if (!busy && uploads[id]?.reason !== 'submission_uncertain') onRetry(id); }}/>
  </div>;
}
