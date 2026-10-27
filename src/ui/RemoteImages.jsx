import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ImageGallery } from '@upstream/ui-attachment/src/MessageImage.tsx';
import { messageImageLabels } from '@upstream/ui-attachment/src/client/labels.ts';
import { zh, en } from '@upstream/ui-conversation/src/client/locales.ts';
import galleryCss from '@upstream/ui-attachment/src/MessageImage.module.css';
import { RemotePluginImageUrls } from '../remote-images.mjs';
import { useLocale } from './locale.jsx';

const Images = createContext(null);

export function RemoteImages({ model, sessionId, children }) {
  const cache = useMemo(() => new RemotePluginImageUrls(model, sessionId), [model, sessionId]);
  useEffect(() => () => cache.dispose(), [cache]);
  const value = useMemo(() => ({ load: cache.load, model }), [cache, model]);
  return <Images.Provider value={value}>{children}</Images.Provider>;
}

/** 在共用聊天插槽内部隔离单次图片呈现，不能让一张图撤下所有消息。 */
export class RemoteImageBoundary extends React.Component {
  state = { failed: false, failedUrl: undefined, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.warn('[DSHM image]', error?.name ?? 'Error'); }
  componentDidUpdate(previous) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false, failedUrl: undefined });
  }
  render() {
    return <div className="remote-message-images" data-remote-image-gallery onErrorCapture={this.props.captureImageErrors ? event =>
      this.setState({ failed: true, failedUrl: event.target.currentSrc || event.target.src }) : undefined}>
      {this.state.failed ? <ImageFailure onRetry={() => {
        this.props.onRetry?.(this.state.failedUrl); this.setState(state => ({ failed: false, failedUrl: undefined, attempt: state.attempt + 1 }));
      }}/> : <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>}
    </div>;
  }
}

function ImageFailure({ onRetry }) {
  const labels = useImageLabels();
  return <button type="button" className={galleryCss.error} data-variant="single" onClick={onRetry}>{labels.loadFailed}</button>;
}

function useImageLabels(labels) {
  const locale = useLocale(), dictionary = locale?.startsWith('en') ? en : zh;
  return useMemo(() => labels ?? messageImageLabels((key, values = {}) => dictionary[key]
    .replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '')), [dictionary, labels]);
}

/** 原画廊负责缩略图、分组、加载重试和原图窗口；手机只接授权读取和原字典。 */
export function RemoteImageGallery({ images, loadImage, align = 'start', compact, thumbnail, labels }) {
  const scope = useContext(Images), load = loadImage ?? scope?.load, resolved = useImageLabels(labels);
  return <RemoteImageBoundary resetKey={JSON.stringify(images)} captureImageErrors onRetry={failedUrl => {
    if (failedUrl) for (const image of images) if (image.attachment) load?.forget?.(image.attachment, failedUrl);
  }}><ImageGallery images={images} load={load} align={align} compact={compact} thumbnail={thumbnail} labels={resolved}/></RemoteImageBoundary>;
}

export function RemoteInlineImage({ image, label }) {
  return <RemoteImageGallery images={[{ attachment: image.ref, label }]}/>;
}

/** 只接收手机File或本模型持有的待提交URL，电脑日志中的任意URL不能成为本地预览。 */
export function RemoteLocalImage({ source, preview }) {
  const scope = useContext(Images);
  const url = preview && scope?.model.pendingImageUrls.has(preview.previewUrl) ? preview.previewUrl : null;
  if (source) return <RemoteBytesImage data={source} name={source.name}/>;
  return url && <RemoteImageGallery images={[{ preview: { url, name: preview.name, width: preview.width, height: preview.height } }]}/>;
}

/** 旧文件预览也用原画廊打开原图，不为文档组件伪造标签页或缩放服务。 */
export function RemoteBytesImage({ data, mediaType, name }) {
  const [source, setSource] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mediaType }));
    setSource({ data, url });
    return () => URL.revokeObjectURL(url);
  }, [data, mediaType]);
  return source?.data === data && <RemoteImageGallery images={[{ preview: { url: source.url, name } }]}/>;
}
