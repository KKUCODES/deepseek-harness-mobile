import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { parseSessionLog } from 'file:///F:/Program%20Files/deepseek-harness/packages/test-support/llm-replay/lib/index.js';

export const inject = ['sessionPersistence', 'tools', 'dynamicCordisRunner', 'workspaceRegistry'];
const output = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/cordis-history-host.json';
const title = 'DSHM Cordis 历史卡片验收';
const toolRecords = events => events.filter(event => event.type === 'tool/call' || event.type === 'tool/result')
  .map(({ type, data }) => ({ type, data }));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** 使用原持久层导入上游已提交的历史样例；不注册旧工具、不发消息、不加载记录中的插件源码。 */
export async function apply(ctx) {
  let previous;
  try { previous = JSON.parse(await readFile(output, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    assert.equal(previous.complete, true, 'Inspect incomplete prior seed before retry');
    const handle = await ctx.sessionPersistence.open(previous.sessionId, 'read');
    try {
      assert.equal(hash(toolRecords((await handle.read()).events)), previous.toolHash);
      const workspace = await ctx.workspaceRegistry.resolveByPath(handle.header.cwd);
      assert.ok(workspace, 'Fixture must belong to an existing workspace');
      await workspace.attachSession(previous.sessionId);
      await writeFile(output, JSON.stringify({ ...previous, workspaceAttached: true }));
    }
    finally { await handle.close(); }
    return;
  }
  const reference = await ctx.sessionPersistence.open('session-d4ec40ee-a27c-41fc-a860-b3974434e637', 'read');
  let cwd;
  try { cwd = reference.header.cwd; assert.ok(cwd); }
  finally { await reference.close(); }
  const sessionId = `session-${randomUUID()}`;
  const source = await readFile(new URL('./session.v3.jsonl', import.meta.url), 'utf8');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const realize = value => typeof value === 'string' ? value
    .replaceAll('{{cwd}}', cwd).replaceAll('{{clientTimeZone}}', 'Asia/Hong_Kong').replaceAll('{{session:1}}', sessionId)
    .replace(/\{\{(message|approval|workflow|command|rpc|retry|id):(\d+)\}\}/g, (_, kind, number) => `dshm-history-${kind}-${number}`)
    : value;
  const materialized = source.split(/\r?\n/).filter(Boolean).map(line => JSON.stringify(JSON.parse(line, (_, value) => realize(value)))).join('\n');
  // 上游归档主动省略system/tools原文；保留这两个历史显示占位，不把它们当作运行配置。
  assert.ok(!materialized.replaceAll('{{system}}', '').replaceAll('{{tools}}', '').includes('{{'), 'Unresolved fixture identity');
  const parsed = parseSessionLog(materialized);
  assert.equal(parsed.at(-1).type, 'turn/end');
  const expectedTools = toolRecords(parsed);
  const createdAt = Date.now() - 60000;
  let nextTime = createdAt;
  const events = parsed.map(event => {
    const time = nextTime++;
    if (event.type === 'session/title') return { ...event, time, data: { title, messageSeqs: [], source: { kind: 'user' } } };
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return { ...event, time };
    const original = event.data.stream;
    const first = original[0];
    const delta = first ? time - ('time' in first ? first.time : first.time0) : 0;
    const stream = original.map(record => 'time' in record ? { ...record, time: record.time + delta } : { ...record, time0: record.time0 + delta });
    const completed = Math.max(time, ...stream.map(record => 'time' in record ? record.time : record.time0 + record.dt.reduce((sum, n) => sum + n, 0)));
    nextTime = completed + 1;
    return { ...event, time: completed, data: { ...event.data, stream } };
  });
  assert.deepEqual(toolRecords(events), expectedTools);
  const retired = ['cordis_define', 'cordis_run', 'cordis_stop', 'cordis_undefine'];
  assert.ok(!ctx.tools.schemas().some(tool => retired.includes(tool.name)));
  assert.ok(!ctx.dynamicCordisRunner.inventory().some(row => row.pluginId === 'snap-1'));
  const report = { at: new Date().toISOString(), sessionId, title, sourceHash, toolHash: hash(expectedTools),
    eventCount: events.length, toolCalls: events.filter(event => event.type === 'tool/call').map(event => event.data.name), complete: false };
  await writeFile(output, JSON.stringify(report));
  const handle = await ctx.sessionPersistence.create({ version: 3, id: sessionId, createdAt, cwd, isSeeded: false, delegationDepth: 0, agentPreset: 'standard' });
  try { await handle.append(events); }
  finally { await handle.close(); }
  const verify = await ctx.sessionPersistence.open(sessionId, 'read');
  try { assert.deepEqual(toolRecords((await verify.read()).events), expectedTools); }
  finally { await verify.close(); }
  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd);
  assert.ok(workspace, 'Fixture must belong to an existing workspace');
  await workspace.attachSession(sessionId);
  await writeFile(output, JSON.stringify({ ...report, complete: true, workspaceAttached: true, retiredToolsAbsent: true, dynamicPackageAbsent: true }));
}
