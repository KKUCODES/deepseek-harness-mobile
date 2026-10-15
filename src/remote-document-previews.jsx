import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DocumentPreviewRegistry } from '@upstream/ui-sidebar-documentpreview/src/client/document/registry.ts';
import { documentTabInfoFactory } from '@upstream/ui-sidebar-documentpreview/src/client/document/contract.ts';
import { TEXTPREVIEW_ID, textDefinition } from '@upstream/ui-sidebar-documentpreview/src/client/definition.ts';
import { TextPreview } from '@dshm/document/TextPreview.tsx';
import { TextTitle } from '@upstream/ui-sidebar-documentpreview/src/client/TextTitle.tsx';
import { textFace } from '@dshm/document/face.ts';
import { createTextStore } from '@upstream/ui-sidebar-documentpreview/src/client/store.ts';
import { createReadPage } from '@upstream/ui-sidebar-documentpreview/src/client/rpc.ts';
import { resolveDocumentAddress, parseAttachmentDocumentAddress } from './remote-document-address.mjs';
import { RemoteAttachmentDocuments, attachmentDocumentProvider } from './remote-attachment-documents.mjs';
import { zh, en } from '@upstream/ui-sidebar-documentpreview/src/client/locales.ts';
import { apply as registerText, PLAIN_BODY_ID } from '@upstream/ui-sidebar-documentpreview/src/client/text/index.ts';
import { TextBody } from '@upstream/ui-sidebar-documentpreview/src/client/text/TextBody.tsx';
import { MarkdownBody } from '@upstream/ui-sidebar-documentpreview/src/client/markdown/MarkdownBody.tsx';
import { CodeBody } from '@dshm/document/code/CodeBody.tsx';
import { ImageBody } from '@dshm/document/image/ImageBody.tsx';
import { apply as registerMarkdown } from '@upstream/ui-sidebar-documentpreview/src/client/markdown/index.ts';
import { apply as registerCode } from '@dshm/document/code/index.ts';
import { apply as registerImage } from '@dshm/document/image/index.ts';
import { apply as registerPdf, pdfBodyRegistration } from '@upstream/ui-sidebar-documentpreview/src/client/pdf/index.ts';
import { LazyPdfBody } from '@upstream/ui-sidebar-documentpreview/src/client/pdf/LazyPdfBody.tsx';
import { OfficeBody } from '@dshm/document/office/OfficeBody.tsx';
import { createOfficeStore } from '@upstream/ui-sidebar-documentpreview/src/client/office/store.ts';
import { officeLoadFace } from '@dshm/office-face';
import { zh as officeZh, en as officeEn } from '@upstream/ui-sidebar-documentpreview/src/client/office/locales.ts';
import { retainDocumentTabs } from '@upstream/ui-sidebar-documentpreview/src/client/document/tab-lifetime.ts';
import { RemoteHtmlPreview } from './ui/RemoteHtmlPreview.jsx';
import { officeError } from './remote-office.mjs';
import { createRemoteOfficeReader } from './remote-office-cache.mjs';
import { readDocumentBytes } from './remote-document-read.mjs';
import { fileError } from './remote-files.mjs';
import { useTranslate } from './ui/locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { RemoteToolDiff } from './ui/RemoteDiff.jsx';

export { TEXTPREVIEW_ID };

/** 自有外壳与明确复用的内置预览器使用实际视口；按组件身份识别，第三方同槽扩展仍自行缩放。 */
export const isRemoteDocumentComposition = (options, component) =>
  options.name === 'sidebar.right.pane.tab' && component === MobileTextPreview
  || options.name === 'sidebar.right.tab.document' &&
    [TextBody, MarkdownBody, CodeBody, ImageBody, LazyPdfBody, MobileOfficeBody, HtmlDocument].includes(component)
  || options.name === 'sidebar.right.tab.document.office.pdf' && component === LazyPdfBody;

/** 保留原注册表、文件标签、状态机与子插槽；只替换需要电脑 HTTP/大消息的读取边界。 */
export function installRemoteDocumentPreviews(model) {
  if (!model.transport.capabilities?.endpoints?.calls?.includes('workspaceFiles/read')) return false;
  // 原资源模块异步就绪后再注册整组父、子插槽，避免子插槽早于父声明。
  model.ctx.inject(['resources'], ctx => { registerRemoteDocumentPreviews(model, ctx); });
  return true;
}

function registerRemoteDocumentPreviews(model, ctx) {
  const previews = new DocumentPreviewRegistry();
  ctx.provide('documentPreviews', previews);
  model.documentPreviews = previews;
  model.documentFiles = new Map();
  ctx.effect(() => () => model.documentFiles.clear());
  ctx.locale.register('sidebarDocumentPreview', { zh, en });
  const definition = textDefinition();
  model.attachmentDocuments = new RemoteAttachmentDocuments(model);
  ctx.inject(['resources'], scope => { scope.resources.register(attachmentDocumentProvider()); });
  ctx.sidebarRightTabs.register({ ...definition, patterns: [...definition.patterns, 'dsh-resource://dshm-attachment/**'],
    canOpen: address => definition.canOpen(address) || !!parseAttachmentDocumentAddress(address) });
  const store = createTextStore();
  const readPage = createReadPage(model.remote);
  const bytes = (file, signal) => file.attachment ? model.attachmentDocuments.bytes(file, signal) : readDocumentBytes(model, file, signal);
  const page = (file, offset, signal) => file.attachment ? model.attachmentDocuments.page(file, offset, signal)
    : readPage(file.sessionId, file.path, offset, signal);
  // renderer自管内容的插件也能读取同一个显式资源地址，不需要反解或借用磁盘路径。
  model.documentSources = Object.freeze({ describe: resolveDocumentAddress,
    readBytes: (address, signal) => bytes(resolveDocumentAddress(address), signal),
    readPage: (address, offset, signal) => page(resolveDocumentAddress(address), offset, signal) });
  ctx.provide('dshmDocuments', model.documentSources);
  // 新版观察主文件与依赖；旧版face忽略第三个参数。
  const face = textFace(page, bytes, ctx.resources);
  ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TEXTPREVIEW_ID, locale: 'sidebarDocumentPreview', store,
    children: {
      'sidebar.right.tab.document': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: documentTabInfoFactory } } },
      'sidebar.right.tab.document.actions': { kind: 'list', scope: 'session' },
      'sidebar.right.tab.document.unpreviewable': { kind: 'list', scope: 'session' },
      'sidebar.right.tab.document.action': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: documentTabInfoFactory } } },
    },
    inject: (sessionId, actions) => ({ ...face(sessionId, actions), model, hooks: { documentPreviews: previews } }),
  }, MobileTextPreview);
  ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TEXTPREVIEW_ID }, TextTitle);
  for (const register of [registerText, registerMarkdown, registerImage, registerPdf]) register(ctx);

  const htmlId = `${TEXTPREVIEW_ID}/html`;
  previews.register({ id: htmlId, extensions: ['html', 'htm'], priority: 'builtin', title: () => 'HTML', loading: 'renderer' });
  ctx.slots.register({ name: 'sidebar.right.tab.document', key: htmlId, inject: () => ({ model }) }, HtmlDocument);
  // 与原入口相同：HTML 阅读先于代码回退，同优先级由注册顺序决定。
  registerCode(ctx);

  const officeId = `${TEXTPREVIEW_ID}/office`, extensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  ctx.locale.register('sidebarOffice', { zh: officeZh, en: officeEn });
  previews.register({ id: officeId, extensions, binaryExtensions: extensions, priority: 'builtin',
    title: () => ctx.locale.bind('sidebarOffice')('title'), loading: 'renderer', wrap: false });
  const retainTab = retainDocumentTabs(ctx);
  const readOfficeDocument = createRemoteOfficeReader(model);
  const officeFace = officeLoadFace(readOfficeDocument, officeError);
  ctx.slots.register({ name: 'sidebar.right.tab.document', key: officeId, locale: 'sidebarOffice', store: createOfficeStore(),
    children: { 'sidebar.right.tab.document.office.pdf': { kind: 'keyed', scope: 'session', inject: { hooks: { tabInfo: documentTabInfoFactory } } } },
    inject: (id, actions) => ({
      ...officeFace(id, actions),
      retainTab: (tabId, signal) => retainTab(tabId, signal, actions.forget),
    }),
  }, MobileOfficeBody);
  ctx.slots.register({ name: 'sidebar.right.tab.document.office.pdf', key: officeId, locale: 'sidebarPdf', ...pdfBodyRegistration(ctx) }, LazyPdfBody);
}

function MobileOfficeBody(props) {
  const t = useTranslate();
  return <OfficeBody {...props} renderFailure={t}/>;
}

/** 带行号的入口先显示源码；用户随后仍可在原“打开方式”菜单切回其他预览器。 */
function MobileTextPreview(props) {
  const { tab } = props.useTabInfo(), state = props.useStore(value => value.byTab[tab.id]);
  const navigation = tab.navigation, line = navigation.params?.line, answered = useRef(null);
  const file = props.model.documentFiles.get(tab.contentId);
  const [view, setView] = useState(null);
  // 差异属于本次导航的历史快照；再次按普通文件打开同一标签时必须回到当前文件。
  const historical = !!file?.diffs && (view?.navigation === navigation ? view.historical : !!navigation.params?.dshmDiff);
  const t = useTranslate();
  const selectingSource = Number.isSafeInteger(line) && line > 0
    && answered.current !== navigation && state?.rendererId !== PLAIN_BODY_ID;
  useLayoutEffect(() => {
    if (!Number.isSafeInteger(line) || line < 1 || answered.current === navigation) return;
    answered.current = navigation;
    props.actions.selected(tab.id, PLAIN_BODY_ID);
  }, [navigation, line, tab.id, props.actions]);
  const pages = Object.entries(state?.pages ?? {});
  const through = pages.reduce((last, [offset, page]) => Math.max(last, Number(offset) + page.lines - 1), 0);
  return <div className="remote-document-content">
    {file?.diffs && <>
      {[...new Set(file.diffs.map(diff => diff.path))].length > 1 && <label className="remote-diff-selector">{t('文件')}
        <select aria-label={t('选择修改文件')} value={file.path} onChange={event => {
          const target = { ...file, path: event.target.value }, address = sessionFileAddress(file.sessionId, target.path);
          props.model.documentFiles.set(address, target);
          props.model.pluginPanels.openResource(address, { params: historical ? { dshmDiff: true } : {} });
        }}>{[...new Set(file.diffs.map(diff => diff.path))].map(path => <option key={path} value={path}>{path}</option>)}</select>
      </label>}
      <div className="remote-file-preview-actions">
        <Button aria-pressed={historical} onClick={() => setView({ navigation, historical: true })}>{t(file.intended ? '计划修改' : '本次修改')}</Button>
        <Button aria-pressed={!historical} onClick={() => setView({ navigation, historical: false })}>{t('最新完整文件')}</Button>
        <span className="muted">{t(historical ? (file.intended ? '即将执行的修改' : '这次操作的修改记录') : '电脑上的当前文件')}</span>
      </div>
    </>}
    {line > through && state?.eof && !state.loading && <p role="status">{t('当前文件中没有第 {line} 行。', { line })}</p>}
    {/* 先切换来源，避免旧 renderer 把新的行号导航提前记为已处理。 */}
    {historical ? <div className="remote-file-preview-body" data-dshm-document-view="changes"><RemoteToolDiff diffs={file.diffs.filter(diff => diff.path === file.path)}/></div>
      : !selectingSource && <TextPreview {...props}/>}
  </div>;
}

function HtmlDocument({ model, content, resourceAddress, useTabInfo }) {
  const t = useTranslate(), { tab } = useTabInfo();
  const file = useMemo(() => resolveDocumentAddress(resourceAddress), [resourceAddress]);
  const [state, setState] = useState(null);
  const revision = content.kind === 'renderer' ? content.revision : undefined;
  useEffect(() => {
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, tab.signal]);
    setState(null);
    if (revision === undefined) return () => controller.abort();
    void model.documentSources.readBytes(resourceAddress, signal).then(result => {
      if (!signal.aborted) setState(result);
    }, error => {
      if (!signal.aborted) setState({ ok: false, error: { message: fileError(error) } });
    });
    return () => controller.abort();
  }, [model, file, revision, tab.signal]);
  useEffect(() => { if (state?.ok && content.kind === 'renderer') content.loaded(state.value.version); }, [state, content]);
  if (!state) return <p role="status">{t('正在读取文件…')}</p>;
  if (!state.ok) return <div role="alert">
    <p>{t(state.error.message)}</p>
    <Button onClick={() => content.reload()}>{t('重试')}</Button>
  </div>;
  return <RemoteHtmlPreview document={state.value} file={file} model={model} onRetry={() => content.reload()}/>;
}
