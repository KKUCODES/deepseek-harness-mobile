// 独立读取原 DSH 持久结果；只核验本轮 UUID 工作区及已记录的真实工具调用。
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const live = await openLatestLiveAndroid();
try {
  const { runtime, state } = live;
  const history = await live.readSession();
  const seeds = await Promise.all(['latest-live-tool-seed.json', 'latest-live-tool-reject-seed.json', 'latest-live-question-seed.json']
    .map(async name => JSON.parse(await readFile(resolve(runtime, name), 'utf8'))));
  const report = { at: new Date().toISOString(), sessionId: live.session.sessionId, passed: false,
    permissions: history.projections.values.permissions, interactions: [] };
  assert.equal(history.row.running, false);
  assert.equal(report.permissions.currentValue, 'workspace-write');
  const question = JSON.parse(await readFile(resolve(runtime, 'latest-live-question-android-observe.json'), 'utf8'));
  assert.equal(question.passed, true); assert.equal(question.sessionId, live.session.sessionId);
  for (const [index, seed] of seeds.entries()) {
    assert.equal(seed.home, state.home);
    assert.equal(seed.sessionId, live.session.sessionId);
    const callId = index < 2 ? seed.approval?.callId : question.originalCallId;
    assert.ok(callId);
    const calls = history.records.filter(record => record.event.type === 'tool/call' && record.event.data.callId === callId);
    const results = history.records.filter(record => record.event.type === 'tool/result' && record.event.data.message.toolCallId === callId);
    assert.equal(calls.length, 1); assert.equal(results.length, 1);
    const result = results[0].event.data.message;
    if (index < 2) {
      assert.match(seed.fileName, /^dshm-latest-write-[0-9a-f-]{36}\.txt$/);
      const file = resolve(state.workspacePath, seed.fileName);
      assert.equal(await realpath(dirname(file)), await realpath(state.workspacePath));
      const content = await readFile(file, 'utf8');
      if (index === 0) {
        assert.equal(result.isError ?? false, false);
        const args = JSON.parse(calls[0].event.data.arguments);
        assert.equal(content, args.content);
        assert.ok(content === seed.after || content === seed.after + '\n');
      }
      else {
        assert.equal(result.isError, true);
        assert.match(result.content.map(part => part.text ?? '').join('\n'), /user rejected escalating/);
        assert.equal(content, 'DSHM_BEFORE');
      }
    } else {
      assert.equal(calls[0].event.data.name, 'ask_user_question');
      assert.equal(result.isError, false);
      assert.deepEqual(JSON.parse(result.content[0].text), { answers: [{ id: 'color_check', selected: ['绿色'] }] });
    }
    report.interactions.push({ kind: ['allow', 'reject', 'question'][index], call: calls[0].event, result: results[0].event });
  }
  report.passed = true;
  await writeFile(resolve(runtime, 'latest-live-original-interactions-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, sessionId: report.sessionId, originalInteractions: report.interactions.length }));
} finally { await live.device.close(); }
