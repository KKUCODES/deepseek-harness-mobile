import { writeFile } from 'node:fs/promises';

export const inject = ['agents', 'agentPresets', 'sessionProjections'];

// 只观察原服务提交后的事件和会话投影，不代替手机选择，也不创建会话。
export async function apply(ctx) {
  const report = { ready: true, defaultPreset: ctx.agentPresets.defaultId, events: [] };
  const path = new URL('../../artifacts/custom-agent-host.json', import.meta.url);
  let selectedSession, writes = Promise.resolve();
  const save = () => { const json = JSON.stringify(report, null, 2); writes = writes.then(() => writeFile(path, json)); return writes; };
  ctx.on('agent-preset/selected', (sessionId, preset) => {
    if (preset === 'dshm-custom-agent-verification') selectedSession = sessionId;
    if (sessionId !== selectedSession) return;
    const agent = ctx.agents.get(sessionId);
    report.events.push({ sessionId, preset, projected: agent && ctx.sessionProjections.stateOf(agent.session, 'agentPreset') });
    void save();
  });
  await save();
  ctx.effect(() => () => writes);
}
