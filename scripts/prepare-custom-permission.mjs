import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

// 只保存已核验的权限配置；完整启动配置只在内存中解析，不输出或落盘。
const require = createRequire(resolve('../plugin/package.json'));
const includePath = require.resolve('@deepseek-ai/cordis-plugin-include');
const { entryListSchema } = await import(pathToFileURL(includePath).href);
const yaml = createRequire(includePath)('js-yaml');
let tree;
try {
  const raw = execFileSync(process.execPath, ['--import', 'tsx/esm', '--import', './.dshm-source/bootstrap.mjs',
    'apps/cli/src/bin.ts', 'web', '--dump-config'], { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  tree = yaml.load(raw, { schema: entryListSchema });
} catch { throw Error('Unable to inspect the current permission configuration; no overlay written'); }
const entries = [];
function visit(rows) { for (const row of rows) { if (row.id === 'permission') entries.push(row); if (row.group && Array.isArray(row.config)) visit(row.config); } }
visit(tree); assert.equal(entries.length, 1);
const entry = entries[0]; assert.equal(entry.name, '@deepseek-ai/dsh-permission-presets');
assert.ok(entry.config && entry.config.presets);
assert.ok(Object.keys(entry.config).every(key => ['presets', 'defaultPreset'].includes(key)));
for (const preset of Object.values(entry.config.presets)) {
  assert.ok(Object.keys(preset).every(key => ['sandbox', 'approval', 'name', 'description'].includes(key)));
  assert.ok(['read-only', 'workspace-write', 'danger-full-access'].includes(preset.sandbox));
  assert.ok(['ask', 'never'].includes(preset.approval));
}
const name = 'dshm-verification-read-only'; assert.ok(!Object.hasOwn(entry.config.presets, name));
const config = structuredClone(entry.config);
config.presets[name] = { sandbox: 'read-only', approval: 'ask', name: 'DSHM 自定义只读验证', description: '仅用于联调，权限与仅可查看相同。' };
await writeFile('artifacts/custom-permission.patch.yml', yaml.dump([
  { id: 'permission', name: entry.name, config },
  { insert: [{ id: 'dshm-permission-audit', name: resolve('tests/fixtures/live-permission-audit.mjs') }] },
]));
console.log(JSON.stringify({ preservedPresets: Object.keys(entry.config.presets), added: name, defaultUnchanged: true }));
