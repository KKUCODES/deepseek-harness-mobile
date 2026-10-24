import React from 'react';
import { useTranslate } from './locale.jsx';
import { UserMessage, AssistantMessage, MessageReasoning } from './ChatMessage.jsx';
import { JsonBlock } from '@upstream/ui-primitives/src/markdown/JsonBlock.tsx';
import { useChatProcessHidden } from '@dshm/chat-presentation';
import { IconBranchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { remoteToolRow, remoteToolCancellation, remoteToolVisibleContent } from '../remote-tool-row.mjs';
import { attachmentFile } from '../remote-attachments.mjs';
import { inlineImage } from '../remote-images.mjs';
import { RemoteInlineImage, RemoteLocalImage } from './RemoteImages.jsx';
import { diffCardModel } from '@upstream/ui-tool/src/client/tool/models/diff-card-model.ts';
import { RemoteToolDiff } from './RemoteDiff.jsx';
import { commandDetails } from '../remote-commands.mjs';
import { RemoteTurnExtensions, RemoteNodeExtension, useRemoteFileMentions } from '../remote-plugin-slots.jsx';
import { MotionDetails } from './motion.jsx';

export const contentText = content => (content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n');
export const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export function RemoteFiles({ content, pending, openAttachment }) {
  const t = useTranslate();
  if (pending) return <><RemoteFiles content={pending.filter(part => part.type === 'file').map(part => ({ type: part.type, attachment: part.value }))} openAttachment={openAttachment}/>
    <div className="remote-files">{pending.filter(part => part.type === 'image').map((part, index) => <RemoteLocalImage key={index} preview={part.value}/>)}</div></>;
  const files = (content ?? []).filter(part => ['file', 'image'].includes(part.type) && part.attachment);
  return files.length > 0 && <div className="remote-files">{files.map((part, index) => {
    const file = attachmentFile(part), label = part.attachment.name ?? t('图片');
    const image = inlineImage(part);
    if (image && openAttachment) return <RemoteInlineImage key={`${part.attachment.attachmentId}:${index}`} image={image} label={label} openAttachment={openAttachment}/>;
    const body = <><strong>{label}</strong>{Number.isFinite(part.attachment.bytes) && <small>{fileSize(part.attachment.bytes)}</small>}</>;
    return file && openAttachment ? <button type="button" className="remote-file" key={`${part.attachment.attachmentId}:${index}`} aria-label={t('查看附件 {name}', { name: label })} onClick={() => openAttachment(file)}>{body}</button>
      : <div className="remote-file" key={`${part.attachment.attachmentId}:${index}`}>{body}</div>;
  })}</div>;
}

function Disclosure({ title, children, open }) {
  return <MotionDetails className="remote-tool-card" open={open} title={title}>{children}</MotionDetails>;
}

export function RemoteToolResult({ tool, renderContent, openFile, openAttachment, openChanges, openCommand, expanded }) {
  const t = useTranslate();
  const settled = tool.kind === 'tool-result';
  const name = tool.call?.name ?? tool.name ?? t('工具调用');
  const seconds = settled && tool.callTime != null ? Math.max(0, (tool.time - tool.callTime) / 1000).toFixed(1) : null;
  const row = remoteToolRow(name, tool), path = row.filePath;
  const cancellation = remoteToolCancellation(tool);
  const visibleContent = remoteToolVisibleContent(tool);
  const diff = diffCardModel(tool);
  const command = commandDetails(tool);
  // workflow 在取消时也抛普通 Error；执行结果由原工作流卡片展示，工具记录不把它误报为失败。
  const status = name === 'workflow' && settled && row.state !== 'stopped' ? '调用已结束'
    : command?.status ?? ({ running: '执行中', stopped: '已停止', error: '失败', ok: '已完成' })[row.state];
  return <Disclosure open={expanded} title={`${name} · ${t(status)}${seconds !== null ? ` · ${t('{seconds} 秒', { seconds })}` : ''}`}>
    {command && <button className="remote-file-link" onClick={() => openCommand(tool.callId)}>{t('查看命令详情')}</button>}
    {path && openFile && <button className="remote-file-link" onClick={() => openFile(path)}>{t('打开文件：{path}', { path })}</button>}
    {diff ? <><p className="muted">{t(settled ? '这次操作的修改记录' : '即将执行的修改')}</p><RemoteToolDiff diffs={diff.card.diffs} compact/>
      <button className="remote-file-link" onClick={() => openChanges({ diffs: diff.card.diffs, path: diff.card.diffs[0].path, intended: !settled })}>{t('查看本次修改')}</button></> : <pre>{tool.call?.argsRaw ?? tool.argsRaw}</pre>}
    {cancellation && <p>{t(cancellation)}</p>}
    {visibleContent.length > 0 && <><RemoteFiles content={visibleContent} openAttachment={openAttachment}/>{renderContent(contentText(visibleContent), false)}</>}
    {tool.subCalls?.map(child => <RemoteToolResult key={child.callId} tool={child} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment} openChanges={openChanges} openCommand={openCommand}/>)}
  </Disclosure>;
}

/** 原会话投影决定顺序和生命周期，手机只负责各类记录的显示。 */
export const RemoteMessage = React.memo(function RemoteMessage({ node, renderContent, openFile, openAttachment, openChanges, openCommand, onFork, forkDisabled }) {
  if (!node || node.visibility === 'hidden') return null;
  return <RemoteNodeExtension node={node} openFile={openFile} openAttachment={openAttachment} openCommand={callId => openCommand(node.key, callId)}>
    <DefaultRemoteMessage node={node} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment} openChanges={openChanges} openCommand={openCommand} onFork={onFork} forkDisabled={forkDisabled}/>
  </RemoteNodeExtension>;
});

function RemoteReasoning({ text, active, hidden, reveal, renderContent }) {
  const ref = useChatProcessHidden(hidden, reveal);
  return <div ref={ref} data-turn-process-inline={hidden || undefined}><MessageReasoning text={text} active={active} renderContent={renderContent}/></div>;
}

function RemoteAssistantMessage({ node, turnProcess, renderContent, openFile, openAttachment }) {
  const t = useTranslate(), data = node.data;
  const label = React.useCallback(path => t('打开文件：{path}', { path }), [t]);
  const mentions = useRemoteFileMentions(node, openFile, label);
  const contentOptions = React.useMemo(() => ({ fileMentions: mentions, contentKey: node.key }), [mentions, node.key]);
  const reasoningHidden = turnProcess?.foldable && turnProcess.spec.answerStep === data.step && turnProcess.spec.inlineReasoning && !turnProcess.open;
  const reveal = React.useCallback(() => turnProcess?.setOpen(true), [turnProcess?.setOpen]);
  const blocks = data.blocks ?? [], active = data.status === 'running', interrupted = data.status === 'interrupted';
  // 工具头由独立节点显示；其余块遵循原投影顺序，不能把图片和文字各自合并。
  if (!active && !interrupted && blocks.every(block => block.kind === 'tool-call')) return null;
  const body = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index], key = index;
    if (block.kind === 'text') body.push(<React.Fragment key={key}>{renderContent(block.text, active, { ...contentOptions, contentKey: `${node.key}:${index}` })}</React.Fragment>);
    else if (block.kind === 'reasoning') body.push(<RemoteReasoning key={key} text={block.text} active={active && index === blocks.length - 1} hidden={Boolean(reasoningHidden)} reveal={reveal} renderContent={renderContent}/>);
    else if (block.kind === 'image') {
      const images = [{ type: 'image', attachment: block.attachment }];
      while (blocks[index + 1]?.kind === 'image') images.push({ type: 'image', attachment: blocks[++index].attachment });
      body.push(<RemoteFiles key={key} content={images} openAttachment={openAttachment}/>);
    } else if (block.kind !== 'tool-call') body.push(<JsonBlock key={key} label={t('扩展内容')} payload={block.block} truncatedLabel={total => t('内容较长，仅显示部分（共 {total} 个字符）。', { total })}/>);
  }
  return <AssistantMessage body={body.length ? body : undefined} active={active} error={interrupted ? t('已停止') : null} renderContent={renderContent}/>;
}

function DefaultRemoteMessage({ node, turnProcess, renderContent, openFile, openAttachment, openChanges, openCommand, onFork, forkDisabled }) {
  const t = useTranslate();
  if (!node || node.visibility === 'hidden') return null;
  const data = node.data;
  const inspectCommand = callId => openCommand(node.key, callId);
  if (node.kind === 'user' || node.kind === 'steering') return <UserMessage attachments={<RemoteFiles content={data.content} openAttachment={openAttachment}/>}>{contentText(data.content)}</UserMessage>;
  if (node.kind === 'assistant-step') return <RemoteAssistantMessage node={node} turnProcess={turnProcess} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment}/>;
  if (node.kind === 'tool-call') return <RemoteToolResult tool={data.root} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment} openChanges={openChanges} openCommand={inspectCommand}/>;
  if (node.kind === 'remote-changes') return <>
    {data.seq !== undefined && <button className="remote-file-link" onClick={() => openChanges(data)}>{t('查看第 {turn} 轮文件改动', { turn: data.turn })}</button>}
    {data.presented?.map(item => <button key={`${item.seq}:${item.index}`} className="remote-file-link" onClick={() => openAttachment({ path: item.path,
      desktopSource: { source: 'presented', seq: item.seq, index: item.index } })}>{t('查看交付文件：{name}', { name: item.description || item.path.split(/[\\/]/).at(-1) })}</button>)}
  </>;
  if (node.kind === 'system-prompt') return <Disclosure title={t(data.update ? '系统提示词更新' : '系统提示词')}><pre>{data.text}</pre></Disclosure>;
  if (node.kind === 'context') return <Disclosure title={t(data.producer?.role === 'recall' ? '引用的上下文' : '补充上下文')}>{data.producer?.label && <p className="muted">{data.producer.label}</p>}<RemoteFiles content={data.content} openAttachment={openAttachment}/>{renderContent(contentText(data.content), false)}</Disclosure>;
  if (node.kind === 'command') return <Disclosure title={`${data.name ?? t('会话操作')} · ${t(!data.outcome ? '执行中' : data.outcome.kind === 'success' ? '已完成' : '失败')}`}><pre>{data.args}</pre>{data.outcome?.text && renderContent(data.outcome.text, false)}</Disclosure>;
  if (node.kind === 'compaction' || node.kind === 'manual-compaction') return <Disclosure title={t('上下文整理')}>{renderContent(data.summary ?? data.compaction?.summary ?? t('已整理较早的聊天内容。'), false)}</Disclosure>;
  if (node.kind === 'turn-error') return <p className="remote-error" role="status">{data.message || t('本轮回复未完成，请检查电脑端模型连接。')}</p>;
  if (node.kind === 'turn-max-tokens') return <p className="muted">{t('已达到本轮输出长度上限。')}</p>;
  if (node.kind === 'turn-blocked') return <p className="remote-error" role="status" data-turn-blocked={data.turn}>{t('本轮任务受阻，未继续执行。')}</p>;
  if (node.kind === 'model-retry') return <p className="muted">{t(data.current.retryState === 'scheduled' ? '模型连接失败，正在等待重试…' : data.current.retryState === 'cancelled' ? '已取消重试' : '已重新连接模型')}</p>;
  if (node.kind === 'turn-tail') return <RemoteTurnExtensions node={node} openFile={openFile}>
    {data.closing && <button type="button" className="remote-branch-action" disabled={forkDisabled}
      aria-label={t('从第 {turn} 轮分支', { turn: data.turn })} title={t('在新聊天中分支')} onClick={() => onFork(node.key)}>
      <IconBranchOutline16 size={20}/>
    </button>}
  </RemoteTurnExtensions>;
  if (node.kind === 'turn-process') return null;
  return <Disclosure title={t('扩展内容')}><pre>{JSON.stringify(data, null, 2)}</pre></Disclosure>;
}
