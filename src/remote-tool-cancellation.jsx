import React, { useCallback } from 'react';
import { ToolRow } from '@upstream/ui-tool/src/client/tool/components/ToolRow.tsx';
import { toolRowModel } from '@upstream/ui-tool/src/client/tool/models/tool-call-model.ts';
import { remoteToolCancellation, remoteToolVisibleContent } from './remote-tool-row.mjs';
import { useTranslate } from './ui/locale.jsx';

function CancelledTool({ toolName, block, cwd, home, inspect, t, message }) {
  const translate = useTranslate();
  const row = toolRowModel(toolName, block, cwd, home);
  const content = remoteToolVisibleContent(block).map(part => part.type === 'text' ? part.text : JSON.stringify(part)).join('\n');
  return <ToolRow t={t} variant={row.variant} toolName={toolName} state="stopped" icon={null}
    title={t(row.titleKey)} summary={translate(message)} bodyRaw={row.bodyRaw}
    output={[translate(message), content].filter(Boolean).join('\n\n')} inspect={inspect}/>;
}

/** 原工具树仍负责分支、身份和递归。只替换有明确取消结果的原子视图，不改原记录。 */
export function RemoteToolCancellationTree({ Component, renderSlot, t, ...props }) {
  const render = useCallback((name, owner, options) => {
    const message = name === 'tool.call.toolview' && remoteToolCancellation(owner.block);
    return message ? <CancelledTool {...owner} t={t} message={message}/> : renderSlot(name, owner, options);
  }, [renderSlot, t]);
  return <Component {...props} t={t} renderSlot={render}/>;
}
