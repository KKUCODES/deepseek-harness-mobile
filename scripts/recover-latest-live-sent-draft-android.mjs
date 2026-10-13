// 只清理上一轮已在原电脑记录确认的测试草稿；不按普通用户文字推测发送成功。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const report = { at: new Date().toISOString(), passed: false };
const attempt = process.argv[2] ?? ''; assert.ok(attempt === '' || /^[a-z][a-z0-9-]{0,30}$/.test(attempt));
try {
  const seed = JSON.parse(await readFile(resolve(live.runtime, 'latest-live-source-notice-process-force-seed.json'), 'utf8'));
  assert.equal(seed.sessionId, live.session.sessionId); assert.equal(seed.home, live.state.home);
  const original = await live.readSession(); assert.equal(original.row.running, false);
  const expected = `这是 DSHM 新版进程结束后的通知验收，不调用任何工具，不做其他任务。回复第一行只写 ${seed.marker}，随后用约800个中文字介绍晴天散步的见闻。`;
  const users = original.records.filter(item => item.event.seq > seed.initialSeq && item.event.type === 'user/message'
    && item.event.data.content.some(part => part.type === 'text' && part.text === expected));
  assert.equal(users.length, 1); assert.equal(users[0].event.data.source.kind, 'user');
  assert.match(users[0].event.data.source.rpcId, /^[0-9a-f-]{36}$/);
  const input = live.main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.innerText();
  if (draft.trim()) {
    assert.equal(draft, expected);
    await input.click(); await input.press('ControlOrMeta+A'); await input.press('Backspace');
  } else report.alreadyEmpty = true;
  await live.page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="remote-workspace"]');
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (!model?.client) continue;
      const state = model.getSnapshot();
      return state.drafts[state.selected] === '' && !state.draftSaving[state.selected]
        && model.draftStore.read(state.selected) === '';
    }
    return false;
  });
  assert.equal((await input.innerText()).trim(), '');
  const after = await live.readSession(); assert.equal(after.projections.asOfSeq, original.projections.asOfSeq);
  report.sessionId = seed.sessionId; report.originalRequestId = users[0].event.data.source.rpcId;
  report.noResend = true; report.legacyTestDraftCleared = true; report.passed = true;
} catch (error) {
  report.error = error.message.split('\n')[0];
  report.location = error.stack.split('\n').find(line => line.includes('recover-latest-live-sent-draft-android.mjs:'))?.trim();
  process.exitCode = 1;
}
finally {
  await writeFile(resolve(live.runtime, 'latest-live-sent-legacy-draft-cleanup' + (attempt ? '-' + attempt : '') + '.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await live.device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
