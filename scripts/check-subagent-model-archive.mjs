import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';

// 只检查本次正式手机导出的专用会话；不会调用模型或修改电脑配置。
const run = JSON.parse(await readFile('artifacts/subagent-selected-model-run-android.json', 'utf8'));
assert.equal(run.sent, true);
assert.equal(run.settingsRestored, true);
assert.equal(run.managementWithdrawn, true);
assert.equal(run.testArchived, true);
assert.equal(run.restored, true);
assert.deepEqual(run.errors, []);
const bytes = await readFile('artifacts/subagent-selected-model-session.zip');
const archiveSha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(archiveSha256, run.logEvidence.archiveSha256);
const logs = Object.entries(unzipSync(bytes))
  .filter(([name]) => /^(?:subagents\/[^/]+\/)?session(?:\.v\d+)?\.jsonl$/.test(name))
  .map(([name, data]) => ({ name, rows: strFromU8(data).trim().split('\n').map(line => JSON.parse(line)) }));
assert.equal(logs.length, 2);
const parent = logs.find(log => !log.name.startsWith('subagents/'));
const child = logs.find(log => log.name.startsWith('subagents/'));
assert.equal(child.rows[0].parentSession, parent.rows[0].id);
const events = (log, type) => log.rows.filter(row => row.type === type).map(row => row.data);
const routes = log => events(log, 'request/header').map(row => ({
  provider: row.header.config.provider, model: row.header.config.model,
}));
assert.deepEqual(routes(parent), [{ provider: 'deepseek-official', model: 'deepseek-v4-pro' }]);
assert.deepEqual(routes(child), [{ provider: 'deepseek-official', model: 'deepseek-flash' }]);
assert.deepEqual(events(parent, 'subagent/model-selection-policy'), [{ allowedModels: [run.childRoute] }]);
const calls = events(parent, 'tool/call');
assert.deepEqual(calls.map(call => call.name), ['list_subagent_models', 'subagent']);
const selection = JSON.parse(calls[1].arguments);
assert.equal(selection.provider, run.childRoute.provider);
assert.equal(selection.model, run.childRoute.model);
assert.equal(selection.run_in_background, false);
assert.equal(events(child, 'tool/call').length, 0);
assert.ok(events(child, 'assistant/message').some(message => JSON.stringify(message).includes(run.marker)));
assert.ok(events(parent, 'assistant/message').some(message => JSON.stringify(message).includes('PARENT_SELECTED_MODEL_DONE')));
assert.deepEqual(run.restoredLimits, run.baseline.limits);
const evidence = { at: new Date().toISOString(), archiveSha256,
  parentId: parent.rows[0].id, childId: child.rows[0].id,
  parentRoutes: routes(parent), childRoutes: routes(child), explicitSelection: true,
  parentCalls: calls.map(call => call.name), childToolCalls: 0, actualReplies: true,
  settingsRestored: true, managementWithdrawn: true, testArchived: true };
await writeFile('artifacts/subagent-selected-model-archive.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
