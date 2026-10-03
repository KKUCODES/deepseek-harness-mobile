import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './Surface.jsx';
import { OrdinaryMarkdown } from '../ordinary-rendering.jsx';
import { fileError } from '../remote-files.mjs';
import { RemoteDocumentActions } from './RemoteDocumentActions.jsx';
import { ImageBody, imageMediaType } from '@upstream/ui-sidebar-documentpreview/src/client/image/ImageBody.tsx';
import { zh as imageZh, en as imageEn } from '@upstream/ui-sidebar-documentpreview/src/client/image/locales.ts';
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { attachmentDocumentAddress } from '../remote-document-address.mjs';
import { FullscreenIcon } from './FullscreenIcon.jsx';
import { RemotePdfPreview } from './RemotePdfPreview.jsx';
import { RemoteHtmlPreview } from './RemoteHtmlPreview.jsx';
import { readOffice, officeError } from '../remote-office.mjs';
import { RemoteAttachmentFiles } from '../remote-attachments.mjs';
import { RemoteToolDiff } from './RemoteDiff.jsx';
import { RemoteDesktopOpen } from './RemoteDesktopOpen.jsx';
import { canOpenDesktopFile } from '../remote-desktop.mjs';
import { fileLine } from '../remote-file-position.mjs';
import { RemoteFileSource } from './RemoteFileSource.jsx';

import { useLocale, useTranslate } from './locale.jsx';

export function RemoteFilePreview({ file, model, onClose }) {
  if (model.documentPreviews) return <RemoteDocumentRequest file={file} model={model} onClose={onClose}/>;
  return <LegacyFilePreview file={file} model={model} onClose={onClose}/>;
}

function RemoteDocumentRequest({ file, model, onClose }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const address = file.attachment ? attachmentDocumentAddress(file) : sessionFileAddress(file.sessionId, file.path);
    model.documentFiles.set(address, file);
    model.pluginPanels.openResource(address, {
      params: { ...(fileLine(file.line) === undefined ? {} : { line: fileLine(file.line) }),
        ...(file.diffs ? { dshmDiff: true } : {}) },
    });
    onClose();
  }, [file, model, onClose]);
  return null;
}

function LegacyFilePreview({ file, model, onClose }) {
  const t = useTranslate();
  const paths = [...new Set(file.diffs?.map(diff => diff.path) ?? [file.path])];
  const [selected, setSelected] = useState(file.path);
  const path = paths.includes(selected) ? selected : paths[0];
  const current = useMemo(() => ({ ...file, path }), [file, path]);
  return <>
    <RemoteFileContent key={`${file.sessionId}:${path}:${file.seq ?? ''}:${file.attachment?.attachmentId ?? ''}:${fileLine(file.line) ?? ''}`} file={current} model={model} onClose={onClose}
      selector={paths.length > 1 && <label className="remote-diff-selector">{t('文件')}<select aria-label={t('选择修改文件')} value={path} onChange={event => setSelected(event.target.value)}>
        {paths.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>}/>
  </>;
}

function RemoteFileContent({ file, model, onClose, selector }) {
  const t = useTranslate(), locale = useLocale();
  const imageTranslate = useMemo(() => {
    const labels = locale?.startsWith('en') ? imageEn : imageZh;
    return (key, values = {}) => labels[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  }, [locale]);
  const [result, setResult] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [source, setSource] = useState(() => fileLine(file.line) !== undefined), [full, setFull] = useState(false);
  const [latest, setLatest] = useState(false);
  const historical = !!file.diffs && !latest;
  const files = useMemo(() => file.attachment ? new RemoteAttachmentFiles(model, file.attachment) : model.files, [file, model]);
  const sourceLine = fileLine(file.line);
  const svgSource = sourceLine !== undefined && (/\.svg$/i.test(file.path) || file.mediaType === 'image/svg+xml');
  const image = !svgSource && (!!file.mediaType?.startsWith('image/') || !!imageMediaType(file.path));
  const pdf = /\.pdf$/i.test(file.path);
  const html = /\.html?$/i.test(file.path) && sourceLine === undefined;
  const office = /\.(docx?|xlsx?|pptx?)$/i.test(file.path);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    if (file.diffs && !latest) return () => controller.abort();
    const signal = AbortSignal.any([controller.signal, model.lifetime.signal]);
    const reading = office ? readOffice(model, file.sessionId, file.path, signal, file.attachment)
      : html ? files.document(file.sessionId, file.path, signal, { maxBytes: 32 * 1024 * 1024 })
      : image || pdf ? files.bytes(file.sessionId, file.path, signal, { maxBytes: pdf ? 32 * 1024 * 1024 : undefined }) : files.text(file.sessionId, file.path, signal);
    void reading.then(value => {
      if (!signal.aborted) setResult(value);
    }).catch(reason => { if (!signal.aborted) setError(office ? officeError(reason) : fileError(reason)); });
    return () => controller.abort();
  }, [file, model, files, revision, image, pdf, html, office, latest]);
  const markdown = /\.(md|markdown)$/i.test(file.path);
  return <Surface title={t('文件预览')} onClose={onClose} className={`remote-file-preview${full ? ' is-fullscreen' : ''}`}>
    <header><h2 title={file.path}>{file.path.split(/[\\/]/).at(-1)}</h2><div className="remote-file-header-actions"><IconButton label={t(full ? '缩小窗口' : '放大窗口')} onClick={() => setFull(value => !value)}><FullscreenIcon expanded={full}/></IconButton><IconButton label={t('关闭文件预览')} onClick={onClose}><IconCloseOutline16/></IconButton></div></header>
    {selector}
    {canOpenDesktopFile(model, file) && <RemoteDesktopOpen key={`${file.path}:${file.desktopSource?.source}:${file.desktopSource?.seq}:${file.desktopSource?.index}`} model={model} file={file}/>}
    {file.diffs && <div className="remote-file-preview-actions"><Button aria-pressed={!latest} onClick={() => setLatest(false)}>{t(file.intended ? '计划修改' : '本次修改')}</Button><Button aria-pressed={latest} onClick={() => setLatest(true)}>{t('最新完整文件')}</Button></div>}
    <div className="remote-file-preview-actions"><span className="muted">{t(historical ? (file.intended ? '即将执行的修改' : '这次操作的修改记录') : file.attachment ? '聊天中的原始附件' : '电脑上的当前文件')}</span>{!historical && <Button onClick={() => setRevision(value => value + 1)}>{t('重新读取')}</Button>}{markdown && !historical && <Button onClick={() => setSource(value => !value)}>{t(source ? '阅读' : '源码')}</Button>}</div>
    <RemoteDocumentActions file={file} model={model}/>
    <div className="remote-file-preview-body">
      {office && result?.missingFonts?.length > 0 && <p role="status">{t('电脑缺少字体：{fonts}。显示效果可能不同。', { fonts: result.missingFonts.join('、') })}</p>}
      {historical ? <RemoteToolDiff diffs={file.diffs.filter(diff => diff.path === file.path)}/> : error ? <p role="alert">{t(error)}</p> : result === null ? <p role="status">{t(office ? '正在电脑上转换文档…' : '正在读取文件…')}</p>
        : image ? <ImageBody content={{ kind: 'bytes', data: result }} resourceAddress={sessionFileAddress(file.sessionId, file.mediaType ? `image.${file.mediaType.split('/')[1]}` : file.path)} t={imageTranslate}/>
        : pdf || office ? <RemotePdfPreview key={revision} data={office ? result.data : result} address={sessionFileAddress(file.sessionId, file.path)} signal={model.lifetime.signal}/>
        : html ? <RemoteHtmlPreview key={revision} document={result} file={file} model={model} onRetry={() => setRevision(value => value + 1)}/>
        : result === '' ? <><p className="muted">{t('文件内容为空')}</p>{sourceLine !== undefined && <RemoteFileSource key={revision} text={result} line={sourceLine}/>}</> : markdown && !source ? <OrdinaryMarkdown text={result}/> : <RemoteFileSource key={revision} text={result} line={sourceLine}/>}
    </div>
  </Surface>;
}
