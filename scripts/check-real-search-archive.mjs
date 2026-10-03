import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

// 只读核对手机从正式入口导出的电脑会话；不再次调用搜索或更改配置。
const run = JSON.parse(await readFile('artifacts/real-search-run-android.json', 'utf8'));
for (const key of ['sent', 'toolSuccess', 'uiMatchesHostSources', 'downloadCleaned', 'testArchived',
  'originalChatRestored', 'draftPreserved', 'managementRemainedOff']) assert.equal(run[key], true, key);
assert.deepEqual(run.errors, []);
const zip = await readFile('artifacts/real-search-session.zip');
assert.equal(createHash('sha256').update(zip).digest('hex'), run.archiveSha256);
const entries = unzipSync(zip);
const names = Object.keys(entries).filter(name => /^session(?:\.v\d+)?\.jsonl$/.test(name));
assert.equal(names.length, 1);
const rows = strFromU8(entries[names[0]]).trim().split('\n').map(JSON.parse);
assert.equal(rows[0].id, run.sessionId);
const events = type => rows.filter(row => row.type === type).map(row => row.data);
const calls = events('tool/call');
assert.equal(calls.length, 1);
assert.equal(calls[0].name, 'web_search');
assert.deepEqual(JSON.parse(calls[0].arguments), { queries: ['deepseek-ai deepseek-harness GitHub'] });
const requests = events('web/deepseek-search-llm-request');
assert.equal(requests.length, 1);
assert.equal(requests[0].endpoint, 'https://api.deepseek.com/anthropic/v1/messages');
assert.equal(requests[0].body.model, 'deepseek-v4-flash');
assert.equal(requests[0].body.tools[0].type, 'web_search_20250305');
assert.deepEqual(events('request/header').map(r => ({ provider: r.header.config.provider, model: r.header.config.model })),
  [{ provider: 'deepseek-official', model: 'deepseek-v4-pro' }]);
const results = events('tool/result');
assert.equal(results.length, 1);
assert.equal(results[0].message.source.callId, calls[0].callId);
assert.equal(results[0].message.content[0].isError, false);
const sources = results[0].meta.sources;
assert.equal(sources.length, 8);
assert.deepEqual(run.sourceLinks.map(s => s.url), sources.map(s => s.url));
assert.ok(sources.every(s => new URL(s.url).protocol === 'https:'));
const messages = events('assistant/message').map(m => JSON.stringify(m));
assert.ok(messages.some(m => m.includes('DSHM_REAL_SEARCH_DONE') && sources.some(s => m.includes(s.url))));
assert.ok(run.historyText.includes('DSHM_REAL_SEARCH_DONE'));
const evidence = { at: new Date().toISOString(), sessionId: run.sessionId, archiveSha256: run.archiveSha256,
  toolCalls: 1, searchRequests: 1, officialEndpoint: requests[0].endpoint,
  successfulSources: sources.length, phoneLinksMatch: true, actualReplyUsesSource: true,
  archived: true, restored: true, managementRemainedOff: true };
await writeFile('artifacts/real-search-archive.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
