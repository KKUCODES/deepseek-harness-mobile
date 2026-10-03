import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ImageBody } from '@upstream/ui-sidebar-documentpreview/src/client/image/ImageBody.tsx';
import { zh as imageLabels } from '@upstream/ui-sidebar-documentpreview/src/client/image/locales.ts';
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { RemoteImageReads } from '../remote-images.mjs';
import { fileError } from '../remote-files.mjs';

const Images = createContext(null);
const translate = (key, values = {}) => imageLabels[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const imageError = failure => failure.message === 'remote_image_memory_full' ? '图片较多，请点开单独查看。' : fileError(failure);

export function RemoteImages({ model, sessionId, children }) {
  const reads = useMemo(() => new RemoteImageReads(model, sessionId), [model, sessionId]);
  useEffect(() => () => reads.dispose(), [reads]);
  const value = useMemo(() => ({ reads, model, sessionId }), [reads, model, sessionId]);
  return <Images.Provider value={value}>{children}</Images.Provider>;
}

export function RemoteInlineImage({ image, label, openAttachment }) {
  const scope = useContext(Images), element = useRef(null);
  const [visible, setVisible] = useState(false), [result, setResult] = useState(null), [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const identity = JSON.stringify([image.file.attachment, image.ref.bytes, image.mediaType]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setResult(null); setError('');
    if (!visible || !scope) return;
    let live = true, lease;
    try {
      lease = scope.reads.acquire(image);
      void lease.promise.then(bytes => { if (live) setResult({ identity, bytes }); }, failure => {
        if (live) setError(imageError(failure));
      });
    } catch (failure) { setError(imageError(failure)); }
    return () => { live = false; lease?.release(); };
  }, [scope, identity, visible, attempt]);
  const address = useMemo(() => sessionFileAddress(scope?.sessionId ?? '', image.displayPath), [scope?.sessionId, image.displayPath]);
  return <div className="remote-inline-image" ref={element}>
    <button type="button" className="remote-image-open" aria-label={`查看附件 ${label}`} onClick={() => openAttachment(image.file)} onErrorCapture={() => setError('图片无法显示，请重试。')}>
      {visible && result?.identity === identity ? <ImageBody content={{ kind: 'bytes', data: result.bytes }} resourceAddress={address} t={translate}/>
        : <span className="remote-image-placeholder" role={visible ? 'status' : undefined}>{error || (visible ? '正在加载图片…' : '图片')}</span>}
      <span className="remote-image-caption">{label}</span>
    </button>
    {error && <button type="button" className="remote-image-retry" onClick={() => setAttempt(value => value + 1)}>重新加载图片</button>}
  </div>;
}

/** 只接收手机 File 或本模型持有的待提交 URL，电脑日志中的任意 URL 不能进入 img。 */
export function RemoteLocalImage({ source, preview }) {
  const scope = useContext(Images), [local, setLocal] = useState(null);
  useEffect(() => {
    if (!source) return;
    const url = URL.createObjectURL(source);
    setLocal({ source, url });
    return () => URL.revokeObjectURL(url);
  }, [source]);
  const url = source ? (local?.source === source ? local.url : null)
    : scope?.model.pendingImageUrls.has(preview?.previewUrl) ? preview.previewUrl : null;
  const [failed, setFailed] = useState(null);
  return url && (failed === url ? <span>图片无法显示</span>
    : <img className="remote-local-image" src={url} alt={source?.name ?? preview?.name ?? '待发送图片'} onError={() => setFailed(url)}/>);
}
