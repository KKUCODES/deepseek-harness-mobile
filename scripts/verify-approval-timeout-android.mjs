import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seed = JSON.parse(await readFile('artifacts/approval-timeout-host.json', 'utf8'));
assert.ok(seed.ready && !seed.cleaned && !seed.failure);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), source: seed.source, sessionId: seed.sessionId, checks: [], errors: [], resources: [] };
const control = 'artifacts/approval-timeout-control.json';
let page, originalDraft;
const button = (root, name) => root.getByRole('button', { name, exact: true });
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const title = main.locator('.remote-heading strong');
  assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
  const input = () => main.getByRole('textbox', { name: '消息', exact: true });
  originalDraft = await input().textContent();
  await button(main, '返回').click();
  await button(main, 'Remote 选项').click(); await button(page, '刷新会话').click(); await button(page, '关闭窗口').click();
  await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.title, { exact: true }) }).click();
  await title.getByText(seed.title, { exact: true }).waitFor(); await input().waitFor();
  const testDraft = await input().textContent();
  for (const kind of ['timeout', 'reject']) {
    const id = randomUUID();
    await writeFile(control, JSON.stringify({ id, sessionId: seed.sessionId, kind }));
    const card = page.locator('[data-approval-key]');
    await card.getByText(`DSHM 审批生命周期验证 ${kind}；不执行任何工具。`, { exact: true }).waitFor();
    const key = await card.getAttribute('data-approval-key');
    assert.ok(key); if (report.expiredKey) assert.notEqual(key, report.expiredKey);
    const node = await card.elementHandle();
    await page.screenshot({ path: `artifacts/approval-${kind}-visible-android.png` });
    if (kind === 'reject') await button(card, '拒绝').click();
    else console.log('Original approval visible; waiting for the real 30-second deadline.');
    const deadline = Date.now() + 40000;
    let host, result;
    while (Date.now() < deadline) {
      host = JSON.parse(await readFile('artifacts/approval-timeout-host.json', 'utf8'));
      assert.ok(!host.failure, host.failure);
      result = host.results.find(item => item.id === id);
      if (result) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(result); assert.equal(result.outcome, kind === 'timeout' ? 'cancelled' : 'rejected');
    if (kind === 'timeout') { assert.ok(result.elapsedMs >= 29500); report.expiredKey = key; }
    await card.waitFor({ state: 'detached' });
    assert.equal(await node.evaluate(element => element.isConnected), false); await node.dispose();
    await input().waitFor(); assert.equal(await input().textContent(), testDraft);
    const asked = host.audit.filter(event => event.type === 'approval/asked');
    const decided = host.audit.filter(event => event.type === 'approval/decided');
    assert.equal(asked.length, decided.length);
    assert.equal(decided.at(-1).data.id, asked.at(-1).data.id);
    assert.equal(decided.at(-1).data.outcome, result.outcome);
    report.checks.push({ kind, outcome: result.outcome, elapsedMs: result.elapsedMs, cardRemoved: true, draftPreserved: true, matchingDurableAudit: true });
  }
  await page.screenshot({ path: 'artifacts/approval-timeout-restored-android.png' });
  await button(main, '返回').click();
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await input().waitFor(); assert.equal(await input().textContent(), originalDraft);
  report.originalChatAndDraftRestored = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  report.complete = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await writeFile('artifacts/approval-timeout-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
