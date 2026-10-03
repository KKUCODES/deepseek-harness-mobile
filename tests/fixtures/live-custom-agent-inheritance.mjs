import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { defineTool } from 'file:///F:/Program%20Files/deepseek-harness/packages/core/tools/src/index.ts';
import { startInProcessRun } from 'file:///F:/Program%20Files/deepseek-harness/packages/subagent/subagent-in-process-driver/src/index.ts';
import { snapshotSubagentDescriptor } from 'file:///F:/Program%20Files/deepseek-harness/packages/subagent/subagent/src/index.ts';

export const inject = ['tools', 'agentPresets', 'permissionPresets'];
const base = new URL('../../artifacts/', import.meta.url);

// 真实模型调用专用工具，工具使用原 one-shot driver 创建子任务；不伪造回复或继承投影。
export async function apply(ctx) {
  const seed = JSON.parse(await readFile(new URL('custom-agent-inheritance-seed.json', base), 'utf8'));
  const report = { ready: true, calls: [] };
  const save = () => writeFile(new URL('custom-agent-inheritance-host.json', base), JSON.stringify(report, null, 2));
  ctx.tools.register(defineTool({
    name: 'dshm_inheritance_probe', description: 'Verify child preset inheritance using a random receipt. No filesystem, network or shell tools are available.',
    parameters: { marker: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      assert.equal(args.marker, seed.marker); assert.ok(exec.agent);
      const agent = exec.agent, preset = ctx.agentPresets.composedPreset(agent.ctx);
      assert.equal(preset, 'dshm-custom-agent-inheritance');
      if (agent.session.header.parentSession) {
        assert.equal(agent.session.header.delegationDepth, 1);
        const events = agent.session.snapshotEvents();
        assert.equal(events.findLast(event => event.type === 'sandbox/mode')?.data.mode, 'read-only');
        assert.equal(events.findLast(event => event.type === 'approval/policy')?.data.policy, 'never');
        const receipt = `DSHM_CHILD_${randomBytes(12).toString('hex')}`;
        report.calls.push({ sessionId: agent.id, parentId: agent.session.header.parentSession, preset, headerPreset: agent.session.header.agentPreset, receipt, sandbox: 'read-only', approval: 'never' });
        await save(); return receipt;
      }
      assert.equal(ctx.permissionPresets.current(agent.session), 'read-only');
      assert.equal(report.parentId, undefined, 'Only one parent launch is allowed');
      report.parentId = agent.id; await save();
      const run = await startInProcessRun({ parent: agent, label: 'DSHM 自定义继承子任务', maxDepth: 1,
        signal: exec.signal,
        prompt: [{ type: 'text', text: `只调用一次 dshm_inheritance_probe，marker为${seed.marker}。将返回值原样回复，不调用其他工具。` }],
        descriptor: snapshotSubagentDescriptor({ mode: 'one-shot', provider: 'spawn', label: 'DSHM 自定义继承子任务' }),
      }, {});
      try {
        report.childId = run.localAgent.id;
        report.childHeaderPreset = run.localAgent.session.header.agentPreset;
        await save();
        const result = await run.result;
        report.stopReason = result.stopReason;
        await save();
        const output = result.output.filter(block => block.type === 'text').map(block => block.text).join('\n');
        assert.equal(report.calls.length, 1); assert.equal(result.stopReason, 'completed');
        assert.ok(output.includes(report.calls[0].receipt)); report.childOutputMatched = true;
        await save(); return output;
      } finally { await run.dispose(); }
    },
  }));
  await save();
}
