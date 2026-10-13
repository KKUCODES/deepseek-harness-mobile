import { parsedToolCall } from '../../deepseek-harness/packages/client/ui-tool/src/client/tool/models/raw-tool-call.ts';
import { remoteToolRow } from './remote-tool-row.mjs';
import { remoteJobs } from './remote-jobs.mjs';

/** 只读原会话中的 job_output 记录，不触碰 jobs.read 的共享消费游标。 */
export function jobOutputRecords(state, sessionId, target) {
  if (state.selected !== sessionId) return null;
  const current = remoteJobs(state, sessionId).find(job => job.id === target.id);
  if (!current || current.startedAt !== target.startedAt) return null;
  const records = [];
  const visit = (tool, nodeId) => {
    const call = parsedToolCall(tool);
    const started = tool.kind === 'tool-result' ? tool.callTime : tool.time;
    // Job id 会在 Host 重启后复用；没有准确调用时间或早于本代任务时不关联。
    if (call?.name === 'job_output' && call.args.job_id === target.id && Number.isFinite(started) && started >= target.startedAt) {
      const settled = tool.kind === 'tool-result';
      const status = remoteToolRow(call.name, tool).state;
      records.push({ key: `${nodeId}:${tool.callId}`, started, settled, failed: status === 'error', interrupted: status === 'stopped',
        text: (tool.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n'),
        error: tool.error?.message });
    }
    for (const child of tool.subCalls ?? []) visit(child, nodeId);
  };
  for (const key of state.conversation?.order ?? []) {
    const node = state.conversation.nodes.get(key);
    if (node?.kind === 'tool-call' && node.visibility !== 'hidden') visit(node.data.root, key);
  }
  return records.sort((a, b) => a.started - b.started);
}
