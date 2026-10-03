import { terminalCardModel, terminalFailed } from '../../deepseek-harness/packages/client/ui-tool/src/client/tool/models/terminal-card-model.ts';
import { parsedToolCall } from '../../deepseek-harness/packages/client/ui-tool/src/client/tool/models/raw-tool-call.ts';
import { remoteToolRow } from './remote-tool-row.mjs';

/** 退出码只由原工具解析器判定；后台回执、持久 shell 和截断输出不能推断为成功退出。 */
export function commandDetails(tool, sessionCwd) {
  if (!tool) return null;
  const parsed = parsedToolCall(tool);
  if (!parsed || !['bash', 'pwsh', 'terminal_send'].includes(parsed.name)) return null;
  const command = parsed.name === 'terminal_send' ? parsed.args.text : parsed.args.command;
  if (typeof command !== 'string') return null;
  const settled = tool.kind === 'tool-result', terminal = terminalCardModel(tool, sessionCwd);
  const background = parsed.args.run_in_background === true;
  const status = !settled ? '执行中' : remoteToolRow(parsed.name, tool).state === 'stopped' ? '已停止' : tool.isError ? '调用失败'
    : terminal && terminalFailed(terminal) ? '执行失败'
    : terminal?.card.exitCode === 0 ? '已完成'
    : background ? '已返回后台任务信息' : '调用已结束';
  const start = settled ? tool.callTime : tool.time;
  return { command, description: typeof parsed.args.description === 'string' ? parsed.args.description : null,
    cwd: terminal?.card.cwd, terminal, status, running: !settled, foreground: !background && parsed.name !== 'terminal_send',
    start: Number.isFinite(start) ? start : null, end: settled && Number.isFinite(tool.time) ? tool.time : null,
    output: (tool.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n'),
    error: tool.isError ? tool.error?.message : null,
  };
}

/** 窗口只保存记录坐标，每次从当前投影取值，避免打开时的 running 快照永远不结束。 */
export function commandAt(state, target) {
  if (!target || state.selected !== target.sessionId) return null;
  const node = state.conversation?.nodes.get(target.nodeId);
  if (node?.kind !== 'tool-call') return null;
  const visit = tool => tool.callId === target.callId ? tool : (tool.subCalls ?? []).map(visit).find(Boolean);
  return visit(node.data.root) ?? null;
}

/** 原根调用的时间固定到执行身份；PTC 子调用保留自己的 callId，不以命令文字匹配。 */
export function commandOutputTarget(state, target) {
  if (!commandAt(state, target)) return null;
  const root = state.conversation.nodes.get(target.nodeId).data.root;
  const time = root.kind === 'tool-result' ? root.callTime : root.time;
  if (typeof root.callId !== 'string' || !Number.isSafeInteger(time) || time < 0) return null;
  return { ...target, rootCallId: root.callId, rootCallTime: time };
}
