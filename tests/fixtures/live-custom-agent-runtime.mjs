import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { defineTool } from 'file:///F:/Program%20Files/deepseek-harness/packages/core/tools/src/index.ts';

export const inject = ['tools', 'agentPresets', 'permissionPresets'];
const seedUrl = new URL('../../artifacts/custom-agent-runtime-seed.json', import.meta.url);
const reportUrl = new URL('../../artifacts/custom-agent-runtime-host.json', import.meta.url);

// 此工具只存在于专用模式中；真实模型必须调用它才能取得新生成的校验值。
export async function apply(ctx) {
  const seed = JSON.parse(await readFile(seedUrl, 'utf8'));
  const report = { ready: true, calls: [] };
  ctx.tools.register(defineTool({
    name: 'dshm_runtime_probe', description: 'Generate a fresh verification receipt without accessing files, network or shell.',
    parameters: { marker: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      assert.equal(args.marker, seed.marker); assert.ok(exec.agent);
      const preset = ctx.agentPresets.composedPreset(exec.agent.ctx);
      assert.equal(preset, 'dshm-custom-agent-runtime');
      assert.equal(ctx.permissionPresets.current(exec.agent.session), 'read-only');
      const receipt = `DSHM_TOOL_RESULT_${randomBytes(12).toString('hex')}`;
      report.calls.push({ sessionId: exec.agent.session.id, preset, permission: 'read-only', receipt });
      await writeFile(reportUrl, JSON.stringify(report, null, 2));
      return receipt;
    },
  }));
  await writeFile(reportUrl, JSON.stringify(report, null, 2));
}
