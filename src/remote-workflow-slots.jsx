import React from 'react';
import { workflowRunDefinition } from '../../deepseek-harness/packages/client/ui-workflow-run/src/client/workflow-definition.ts';
import { WorkflowRunPanel } from '../../deepseek-harness/packages/client/ui-workflow-run/src/client/WorkflowRunPanel.tsx';
import { NS, zh, en } from '../../deepseek-harness/packages/client/ui-workflow-run/src/client/locales.ts';
import { MobilePluginFrame } from './ui/MobilePluginFrame.jsx';
import { workflowPluginId } from './remote-workflows.mjs';
import { useRemoteConversationModel } from './remote-plugin-slots.jsx';

/** 复用原投影/组件；仅替换桌面导航，保留作者组件及用户外层缩放偏好。 */
export function installRemoteWorkflow(model, layout) {
  const { ctx } = model;
  ctx.uiConversation.events.register(workflowRunDefinition);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'DSHM workflow dictionaries');
  ctx.slots.register({ name: 'conversation.chat.node', key: 'workflow-run', locale: NS }, props => {
    const view = useRemoteConversationModel() ?? model;
    return <MobilePluginFrame id={workflowPluginId} layout={layout}>
      <WorkflowRunPanel {...props} openSession={target => { void view.openWorkflowMember(target).catch(error => view.fail(error)); }}/>
    </MobilePluginFrame>;
  });
}
