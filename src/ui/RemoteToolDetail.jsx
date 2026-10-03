import React from 'react';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './Surface.jsx';
import { useTranslate } from './locale.jsx';
import { RemoteToolResult } from './RemoteMessage.jsx';

/** 原插件 inspectCall 也可能指向文件或其他工具，不能全部当成终端命令。 */
export function RemoteToolDetail({ tool, onClose, ...content }) {
  const t = useTranslate();
  return <Surface title={t('工具详情')} onClose={onClose} className="remote-file-preview remote-tool-detail">
    <header><h2>{t('工具详情')}</h2><IconButton label={t('关闭工具详情')} onClick={onClose}><IconCloseOutline16/></IconButton></header>
    <div className="remote-file-preview-body">
      {tool ? <RemoteToolResult key={tool.callId} tool={tool} {...content} expanded/> : <p role="status">{t('当前聊天中没有这条工具记录。')}</p>}
    </div>
  </Surface>;
}
