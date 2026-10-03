import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** 经正式旁栏读取真实shell输出；网关由外部执行者核验进程后停止/恢复。 */
export async function verifySidebarOutputStreams({ page, output, artifact }) {
  const text = output.getByLabel('独立任务输出', { exact: true });
  const button = name => output.getByRole('button', { name, exact: true });
  const status = output.getByRole('status');
  await button('从头查看').click();
  await status.filter({ hasText: '65,536 /' }).waitFor();
  const pieces = [await text.textContent()];
  await button('读取下一段').click();
  await status.filter({ hasText: '131,072 /' }).waitFor();
  pieces.push(await text.textContent());
  await button('读取下一段').click();
  await text.getByText(/DSHM_HISTORY_END/).waitFor();
  pieces.push(await text.textContent());
  const history = pieces.join('');
  const expected = 'DSHM_HISTORY_BEGIN\n' + '0123456789'.repeat(14000) + '\nDSHM_HISTORY_END\n';
  assert.ok(history.startsWith(expected), '三个真实读取窗口应完整重组固定大输出');
  assert.match(history.slice(expected.length), /^DSHM_SIDEBAR_LINE_1\b/);
  const report = { historyPages: pieces.length, historyCharacters: expected.length,
    historySha256: createHash('sha256').update(history.slice(0, expected.length)).digest('hex') };
  await button('错误输出').click();
  await text.getByText(/DSHM_SIDEBAR_ERR_1\b/).waitFor();
  assert.equal((await text.textContent()).includes('DSHM_HISTORY_BEGIN'), false);
  report.stderrHistory = true;
  await button('实时读取').click();
  await text.getByText(/DSHM_SIDEBAR_ERR_5\b/).waitFor();
  const before = await text.textContent();
  const numbers = value => [...value.matchAll(/DSHM_SIDEBAR_ERR_(\d+)\b/g)].map(match => Number(match[1]));
  const beforeNumbers = numbers(before);
  assert.deepEqual(beforeNumbers, Array.from({ length: beforeNumbers.length }, (_, i) => i + 1));
  report.beforeDisconnect = beforeNumbers.length;
  console.log('SIDEBAR_OUTPUT_READY_FOR_GATEWAY_STOP');
  const offline = output.getByTestId('remote-offline-status');
  await offline.waitFor({ timeout: 60000 });
  await status.filter({ hasText: '读取已暂停' }).waitFor();
  await output.getByRole('alert').filter({ hasText: '连接已断开' }).waitFor();
  // 以断线已被页面确认时的快照为准，允许停止信号前最后一批合法数据到达。
  const retained = await text.textContent();
  assert.ok(retained.startsWith(before));
  await page.screenshot({ path: `artifacts/${artifact}-offline-android.png` });
  console.log('SIDEBAR_OUTPUT_OFFLINE_RESTORE_GATEWAY');
  await offline.waitFor({ state: 'detached', timeout: 60000 });
  await button('重新读取').waitFor();
  assert.equal(await text.textContent(), retained);
  assert.equal(await button('错误输出').getAttribute('aria-pressed'), 'true');
  assert.equal(await button('实时读取').getAttribute('aria-pressed'), 'true');
  assert.match(await output.getAttribute('class'), /is-fullscreen/);
  const retainedNumbers = numbers(retained);
  await button('重新读取').click();
  await text.getByText(new RegExp(`DSHM_SIDEBAR_ERR_${retainedNumbers.length + 3}\\b`)).waitFor();
  const after = await text.textContent(), afterNumbers = numbers(after);
  assert.ok(after.startsWith(retained));
  assert.deepEqual(afterNumbers, Array.from({ length: afterNumbers.length }, (_, i) => i + 1));
  assert.equal(after.includes('DSHM_HISTORY_BEGIN'), false);
  report.reconnected = { retained: retainedNumbers.length, after: afterNumbers.length,
    continuous: true, streamPreserved: true, fullscreenPreserved: true };
  return report;
}
