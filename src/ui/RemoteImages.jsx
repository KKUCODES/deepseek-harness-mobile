import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { messageImageLabels } from '@upstream/ui-attachment/src/client/labels.ts';
import { zh, en } from '@upstream/ui-conversation/src/client/locales.ts';
import galleryCss from '@upstream/ui-attachment/src/MessageImage.module.css';
import { RemotePluginImageUrls } from '../remote-images.mjs';
import { useLocale } from './locale.jsx';
import { diagnostics } from '../app-diagnostics.mjs';
import { installRemoteImageZoom } from '../remote-image-zoom.mjs';
import { RemoteMessageGallery } from './RemoteMessageImage.jsx';

const Images = createContext(null);
const noImageMenu = () => ({});
const unavailableImage = async () => { throw new Error('remote_image_unavailable'); };
// The mobile fallback has a lightbox but no desktop file-drop destination.
const noFileDrag = {
  async prepare() { return { start: () => false, release() {} }; },
  reportFailure() {},
};

export function RemoteImages({ model, sessionId, paused, children }) {
  const cache = useMemo(() => new RemotePluginImageUrls(model, sessionId), [model, sessionId]);
  useEffect(() => () => cache.dispose(), [cache]);
  // 原图库的预览层没有缩放；接入手机手势后仍使用原关闭与返回合同。
  useEffect(() => installRemoteImageZoom(), []);
  const value = useMemo(() => ({ load: paused ? undefined : cache.load, model }), [cache, model, paused]);
  return <Images.Provider value={value}>{children}</Images.Provider>;
}

/** 在共用聊天插槽内部隔离单次图片呈现，不能让一张图撤下所有消息。 */
export class RemoteImageBoundary extends React.Component {
  state = { failed: false, failedUrl: undefined, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { diagnostics.record('remote', 'image_render_failed', { level: 'ERROR', code: 'render_failed', error }); }
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

/** 保留原画廊的缩略图、分组、原图窗口和加载重试；失败分支换成手机端紧凑态，文件仍走授权读取。 */
export function RemoteImageGallery({ images, loadImage, align = 'start', compact, thumbnail, labels }) {
  const scope = useContext(Images), load = loadImage ?? scope?.load ?? unavailableImage, resolved = useImageLabels(labels);
  return <RemoteImageBoundary resetKey={JSON.stringify(images)} captureImageErrors onRetry={failedUrl => {
    if (failedUrl) for (const image of images) if (image.attachment) load?.forget?.(image.attachment, failedUrl);
  }}><RemoteMessageGallery images={images} load={load} align={align} compact={compact} thumbnail={thumbnail} labels={resolved}
    fileDrag={noFileDrag} getTriggerProps={noImageMenu}/></RemoteImageBoundary>;
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
