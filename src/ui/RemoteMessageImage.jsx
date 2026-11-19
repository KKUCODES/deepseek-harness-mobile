import React, { useCallback, useEffect, useMemo, useState } from 'react';

// 由上游 ui-attachment 的 MessageImage 同步而来；仅改加载失败分支，加载、原图预览和拖拽行为保持一致。
import galleryCss from '@upstream/ui-attachment/src/MessageImage.module.css';
import { DraggableImage } from '@upstream/ui-primitives/src/DraggableImage.tsx';
import { ImageLightbox } from '@upstream/ui-primitives/src/ImageLightbox.tsx';
import { AttachmentFailureCard, AttachmentFailureSheet, AttachmentFailureTile } from './RemoteAttachmentFailure.jsx';

/** 单图显示的尺寸：长边 240，比例限制在 [0.25, 4]，不放大到超过原图。 */
function singleFit(dimensions) {
  const natural = dimensions.width / dimensions.height;
  const ratio = Math.min(4, Math.max(0.25, natural));
  const box = ratio >= 1 ? { width: 240, height: 240 / ratio } : { width: 240 * ratio, height: 240 };
  const scale = Math.min(1, dimensions.width / box.width, dimensions.height / box.height);
  return {
    width: Math.max(1, Math.round(box.width * scale)),
    height: Math.max(1, Math.round(box.height * scale)),
    objectPosition: natural < 0.25 ? 'center top' : natural > 4 ? 'left center' : 'center',
  };
}

/** 一张图片的已知宽高；本地预览没有探测结果时返回 undefined。 */
function dimensionsOf(image) {
  if ('attachment' in image) return image.attachment;
  return image.preview.width !== undefined && image.preview.height !== undefined
    ? { width: image.preview.width, height: image.preview.height }
    : undefined;
}

/**
 * 附件缩略图：保留原画廊的加载、原图预览和拖拽；读取失败时换成手机端的紧凑失败态。
 * @param {{ image: object, load: Function, variant: 'single' | 'tile' | 'thumbnail', labels: object, fileDrag: object, getTriggerProps: Function }} props 图片、读取函数、形态、文案和拖拽/菜单绑定
 * @returns {React.ReactElement} 缩略图、失败格或失败卡
 */
export function RemoteMessageImage({ image, load, variant, labels, fileDrag, getTriggerProps }) {
  const preview = 'preview' in image ? image.preview : undefined;
  const attachment = 'attachment' in image ? image.attachment : undefined;
  const [loaded, setLoaded] = useState(() => attachment === undefined ? null : (load.peek?.(attachment) ?? null));
  const [failure, setFailure] = useState(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useCallback(() => { setAttempt(value => value + 1); }, []);
  const close = useCallback(() => { setOpen(false); }, []);
  const dimensions = useMemo(() => dimensionsOf(image), [image]);
  const fit = useMemo(() => variant === 'single'
    ? (dimensions === undefined ? { width: 240, height: 240, objectPosition: 'center' } : singleFit(dimensions))
    : undefined, [dimensions, variant]);
  const label = ('attachment' in image ? image.label : undefined)
    ?? preview?.name ?? attachment?.name ?? labels.image;

  useEffect(() => {
    if (attachment === undefined) return undefined;
    let live = true;
    setFailure(null);
    setSheet(false);
    setLoaded(load.peek?.(attachment) ?? null);
    void load(attachment).then(url => { if (live) setLoaded(url); }).catch(reason => { if (live) setFailure(reason); });
    return () => { live = false; };
  }, [attachment, load, attempt]);

  if (failure !== null) return <>
    {variant === 'single'
      ? <AttachmentFailureCard name={label} failure={failure} onOpen={() => setSheet(true)} onRetry={request}/>
      : <AttachmentFailureTile name={label} failure={failure} onOpen={() => setSheet(true)} onRetry={request}/>}
    {sheet && <AttachmentFailureSheet name={label} failure={failure} onClose={() => setSheet(false)}
      onRetry={() => { setSheet(false); request(); }}/>}
  </>;

  const src = preview?.url ?? loaded;
  const contextMenuProps = getTriggerProps(src === null ? undefined : { kind: 'image', value: {
    url: src, name: label, ...(attachment === undefined ? {} : { mediaType: attachment.mediaType }),
  } });
  const loadingThumbnail = variant === 'thumbnail' && src === null;
  return <>
    <button
      type="button"
      className={galleryCss.frame}
      data-variant={variant}
      style={fit === undefined ? undefined : { width: fit.width, height: fit.height }}
      title={loadingThumbnail ? labels.loading : labels.open}
      aria-label={loadingThumbnail ? labels.loading : labels.openNamed(label)}
      aria-busy={loadingThumbnail || undefined}
      {...contextMenuProps}
      onClick={() => { if (src !== null) setOpen(true); }}
    >
      {src === null
        ? <span className={galleryCss.loading} aria-hidden={loadingThumbnail || undefined}>
          {loadingThumbnail ? <span className="remote-attachment-spinner" aria-hidden="true"/> : labels.loading}
        </span>
        : <DraggableImage fileDrag={fileDrag} src={src} alt={label} name={preview?.name ?? attachment?.name ?? 'image'}
          style={fit === undefined ? undefined : { objectPosition: fit.objectPosition }}/>}
    </button>
    {open && src !== null && <ImageLightbox src={src} alt={label} labels={labels.lightbox} onClose={close}
      contextMenuProps={contextMenuProps}/>}
  </>;
}

/**
 * 图片组：单图放大、多图或紧凑模式使用 64px 格子，缩略图列表保持原尺寸。
 * @param {{ images: readonly object[], load: Function, align?: 'start' | 'end', compact?: boolean, thumbnail?: boolean, labels: object, fileDrag: object, getTriggerProps: Function }} props 图片、读取函数、对齐、形态与绑定
 * @returns {React.ReactElement | null} 图片组
 */
export function RemoteMessageGallery({ images, load, align = 'start', compact = false, thumbnail = false, labels, fileDrag, getTriggerProps }) {
  if (images.length === 0) return null;
  const variant = thumbnail ? 'thumbnail' : compact || images.length > 1 ? 'tile' : 'single';
  return <div className={galleryCss.gallery} data-align={align}>
    {images.map((image, index) => <RemoteMessageImage
      key={`${'attachment' in image ? image.attachment.attachmentId : image.preview.url}:${index}`}
      image={image} load={load} variant={variant} fileDrag={fileDrag} labels={labels} getTriggerProps={getTriggerProps}/>)}
  </div>;
}
