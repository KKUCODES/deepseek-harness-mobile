import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyOfficialLongHistory } from './official-long-history.mjs';

/** 在真实分页回执已到达中转但尚未送达手机时，操作原导航与连接入口。 */
export async function verifyOfficialHistoryInflight({ page, device, evidence, checks, title, mark, disconnect, reconnect }) {
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const report = { passed: false, phases: [] };
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (!model?.client) continue;
      const state = model.getSnapshot();
      return { selected: state.selected, hasMore: state.session?.hasMore, loadingOlder: state.session?.loadingOlder,
        events: model.reference?.binding.eventSource.getSnapshot().entries.filter(entry => entry.type === 'event').map(entry => entry.event) };
    }
    throw Error('official_history_inflight_model_missing');
  });
  const back = () => main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  const select = async name => {
    await main.locator('.remote-session-row').filter({ has: page.getByText(name, { exact: true }) }).click();
    await editor.waitFor();
    await page.waitForFunction(() => {
      const loader = document.querySelector('[data-history-loader]');
      return !loader || !loader.disabled;
    });
  };
  const prepare = async () => {
    const state = await snapshot(); assert.equal(state.selected, checks.sessionId); assert.equal(state.hasMore, true);
    await checks.arm(state.events[0].seq);
    await main.getByRole('button', { name: '加载更早的消息', exact: true }).click();
    const held = await checks.held();
    assert.equal((await snapshot()).loadingOlder, true);
    assert.equal(held.forwarded, true); assert.equal(held.released, false);
    return { state, held };
  };
  try {
    const other = await snapshot(), original = await checks.original();
    assert.deepEqual(other.events, original);
    await editor.fill('DSHM_HISTORY_OTHER_CHAT_DRAFT');
    await back(); await select(checks.title);
    await editor.fill('DSHM_HISTORY_LATE_DRAFT');
    const switching = await prepare();
    await back(); await select(title);
    assert.equal((await snapshot()).selected, other.selected);
    assert.equal(await editor.innerText(), 'DSHM_HISTORY_OTHER_CHAT_DRAFT');
    const release = await checks.release(); assert.equal(release.lateReceiptDelivered, true);
    await page.waitForTimeout(500);
    assert.deepEqual((await snapshot()).events, original);
    assert.equal(await main.locator('.messages').getByText(/DSHM_HISTORY_[0-9a-f]+_/).count(), 0);
    assert.equal(await main.getByText('未能加载更早的记录，请重试。', { exact: true }).count(), 0);
    assert.equal(await editor.innerText(), 'DSHM_HISTORY_OTHER_CHAT_DRAFT');
    report.phases.push({ phase: 'switch-chat-before-real-page-receipt', held: switching.held, release,
      otherSessionAndEventsUnchanged: true, otherDraftPreserved: true, noLateErrorInOtherChat: true });
    await mark('official-history-late-receipt-does-not-change-other-chat');
    await back(); await select(checks.title);
    assert.equal(await editor.innerText(), 'DSHM_HISTORY_LATE_DRAFT');
    const interrupted = await prepare();
    await disconnect(); await main.getByTestId('remote-offline-status').waitFor();
    const offlineRelease = await checks.release();
    await reconnect(); await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await editor.waitFor();
    await page.waitForTimeout(500);
    const requests = await checks.reads();
    assert.equal(requests.length, 2);
    assert.equal(await editor.innerText(), 'DSHM_HISTORY_LATE_DRAFT');
    report.retry = await verifyOfficialLongHistory({ page, device, evidence, checks, title: checks.title,
      mark, reopen: false, draft: 'DSHM_HISTORY_LATE_DRAFT' });
    report.phases.push({ phase: 'disconnect-before-real-page-receipt', held: interrupted.held, release: offlineRelease,
      noAutomaticOlderPageReplay: true, explicitRealPaginationPassed: report.retry.passed, originalDraftPreserved: true });
    await writeFile(resolve(evidence, 'history-inflight-restored.png'), await device.screenshot());
    await back(); await select(title);
    assert.deepEqual((await snapshot()).events, original);
    assert.equal(await editor.innerText(), 'DSHM_HISTORY_OTHER_CHAT_DRAFT');
    report.seed = await checks.unchanged();
    assert.equal(report.seed.originalHistoryUnchanged, true);
    await mark('official-history-disconnect-explicit-retry-and-seed-unchanged');
    report.passed = true;
    return report;
  } finally { await writeFile(resolve(evidence, 'history-inflight.json'), JSON.stringify(report, null, 2) + '\n'); }
}
