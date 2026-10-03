import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';

// 完整配置仅在内存解析；只将原预设目录设置放入临时启动补丁。
const require = createRequire(resolve('../plugin/package.json'));
const includePath = require.resolve('@deepseek-ai/cordis-plugin-include');
const { entryListSchema } = await import(pathToFileURL(includePath).href);
const yaml = createRequire(includePath)('js-yaml');
let tree;
try {
  tree = yaml.load(execFileSync(process.execPath, ['--import', 'tsx/esm', '--import', './.dshm-source/bootstrap.mjs',
    'apps/cli/src/bin.ts', 'web', '--dump-config'], { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'] }), { schema: entryListSchema });
} catch { throw Error('Unable to inspect Agent preset configuration; no overlay written'); }
const entries = [];
function visit(rows) { for (const row of rows) { if (row.name === '@deepseek-ai/dsh-agent-presets') entries.push(row); if (row.group && Array.isArray(row.config)) visit(row.config); } }
visit(tree); assert.equal(entries.length, 1);
const entry = entries[0]; assert.ok(entry.id);
assert.ok(Object.keys(entry.config).every(key => ['default', 'roots', 'includeShippedRoot', 'includeUserRoot'].includes(key)));
assert.equal(typeof entry.config.default, 'string');
const inheritance = process.argv.includes('--inheritance');
const runtime = inheritance || process.argv.includes('--runtime');
const prefix = inheritance ? 'custom-agent-inheritance' : runtime ? 'custom-agent-runtime' : 'custom-agent';
const preset = inheritance ? 'dshm-custom-agent-inheritance' : runtime ? 'dshm-custom-agent-runtime' : 'dshm-custom-agent-verification';
const root = resolve(`artifacts/${prefix}-presets`);
const directory = resolve(root, preset);
await mkdir(directory, { recursive: true });
if (runtime) {
  await writeFile(resolve(directory, 'agent.cordis.yml'), yaml.dump([
    { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'You are a helpful assistant. Use the provided tool when requested.', complete: true, includeRuntimeContext: false } },
    { id: 'runtime-probe', name: resolve(`tests/fixtures/live-custom-agent-${inheritance ? 'inheritance' : 'runtime'}.mjs`) },
  ]));
} else await copyFile('F:/Program Files/deepseek-harness/packages/preset/agent-presets/presets/minimal/agent.cordis.yml', resolve(directory, 'agent.cordis.yml'));
await writeFile(resolve(directory, 'preset.yml'), yaml.dump({ name: inheritance ? 'DSHM 子任务继承验证' : runtime ? 'DSHM 自定义工具验证' : 'DSHM 自定义模式验证',
  description: runtime ? '仅提供随机校验值工具，不读取文件或执行命令。' : '沿用电脑极简模式，仅验证模式选择，不发送消息。' }));
const config = { ...entry.config, roots: [...(entry.config.roots ?? []), { path: root, trust: 'user' }] };
await writeFile(`artifacts/${prefix}.patch.yml`, yaml.dump([
  { id: entry.id, name: entry.name, config },
  ...runtime ? [] : [{ insert: [{ id: 'dshm-custom-agent-audit', name: resolve('tests/fixtures/live-custom-agent-audit.mjs') }] }],
]));
console.log(JSON.stringify({ added: preset, preservedRootCount: entry.config.roots?.length ?? 0, defaultUnchanged: true }));
