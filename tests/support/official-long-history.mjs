import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 在实际手机页点击历史按钮；公开事件窗口与独立电脑分页逐条比较。 */
export async function verifyOfficialLongHistory({ page, device, evidence, checks, title, mark,
  reopen = true, draft = 'DSHM_HISTORY_READING_DRAFT' }) {
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const report = { passed: false, phases: [], draft, reopen };
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (!model?.client) continue;
      const state = model.getSnapshot(), binding = model.reference?.binding;
      return { selected: state.selected, openState: state.session?.openState,
        hasMore: state.session?.hasMore, loadingOlder: state.session?.loadingOlder,
        events: binding?.eventSource.getSnapshot().entries.filter(entry => entry.type === 'event').map(entry => entry.event) };
    }
    throw Error('official_history_model_missing');
  });
  const frame = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  try {
    if (reopen) {
      report.seed = await checks.prepare();
      await editor.fill(draft);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ has: page.getByText(title, { exact: true }) }).click();
    }
    const oracle = await checks.current();
    report.officialPages = oracle.pages;
    await page.waitForFunction(sessionId => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model;
        if (!model?.client) continue;
        const state = model.getSnapshot();
        return state.selected === sessionId && state.session?.openState === 'open';
      }
      return false;
    }, checks.sessionId);
    const expected = oracle.records.map(row => row.event), initial = await snapshot();
    assert.equal(initial.selected, checks.sessionId);
    assert.equal(initial.openState, 'open');
    if (reopen) {
      assert.equal(initial.hasMore, true);
      assert.ok(initial.events.length < expected.length);
    }
    assert.deepEqual(initial.events, expected.slice(-initial.events.length));
    assert.equal(await editor.innerText(), draft);
    const container = main.locator('.conversation');
    for (let index = 0; index < 8 && (await snapshot()).hasMore; index++) {
      await container.evaluate(element => { element.scrollTop = 0; });
      const loader = main.getByRole('button', { name: '加载更早的消息', exact: true });
      await loader.waitFor(); await loader.scrollIntoViewIfNeeded(); await frame();
      const before = await snapshot();
      const anchor = await container.evaluate(element => {
        const top = element.getBoundingClientRect().top;
        const node = [...element.querySelectorAll('[data-chat-flow-key]')]
          .find(row => row.getBoundingClientRect().height > 0 && row.getBoundingClientRect().bottom > top);
        if (!node) throw Error('official_history_anchor_missing');
        return { key: node.getAttribute('data-chat-flow-key'), offset: node.getBoundingClientRect().top - top };
      });
      await loader.click();
      await page.waitForFunction(first => {
        const element = document.querySelector('[data-testid="remote-workspace"]');
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return) {
          const model = fiber.memoizedProps?.model;
          if (!model?.client) continue;
          const state = model.getSnapshot(), entries = model.reference?.binding.eventSource.getSnapshot().entries;
          return !state.session.loadingOlder && entries[0]?.event.seq < first;
        }
        return false;
      }, before.events[0].seq);
      await frame();
      const after = await snapshot();
      assert.deepEqual(after.events.slice(-before.events.length), before.events);
      assert.deepEqual(after.events, expected.slice(-after.events.length));
      assert.equal(new Set(after.events.map(event => event.seq)).size, after.events.length);
      const offset = await container.evaluate((element, key) => {
        const node = [...element.querySelectorAll('[data-chat-flow-key]')]
          .find(row => row.getAttribute('data-chat-flow-key') === key);
        if (!node) throw Error('official_history_anchor_lost');
        return node.getBoundingClientRect().top - element.getBoundingClientRect().top;
      }, anchor.key);
      assert.ok(Math.abs(offset - anchor.offset) <= 2, `history_anchor_shift:${offset - anchor.offset}`);
      assert.equal(await editor.innerText(), draft);
      report.phases.push({ index, beforeFirst: before.events[0].seq, afterFirst: after.events[0].seq,
        count: after.events.length, hasMore: after.hasMore, anchorShift: offset - anchor.offset,
        existingEventsUnchanged: true, officialWindowMatched: true, draftPreserved: true });
    }
    if (reopen) assert.ok(report.phases.length >= 2);
    report.initialWindowRetainedCompletely = initial.events.length === expected.length;
    const complete = await snapshot();
    assert.equal(complete.hasMore, false); assert.deepEqual(complete.events, expected);
    assert.equal(await main.locator('[data-history-loader]').count(), 0);
    for (const marker of oracle.markers) {
      assert.equal(await main.getByRole('article', { name: '模型回复', exact: true })
        .filter({ hasText: marker }).count(), 1);
      assert.equal(await main.getByText(`请只回复 ${marker}，不要调用工具。`, { exact: true }).count(), 1);
    }
    await writeFile(resolve(evidence, reopen ? 'history-oldest.png' : 'history-reconnected.png'), await device.screenshot());
    Object.assign(report, { passed: true, fullOfficialHistoryVerified: true,
      noDuplicateMessages: true, readingPositionPreserved: true, draftPreserved: true,
      realModelTurns: oracle.markers.length, selectedSessionPreserved: true });
    await mark(reopen ? 'official-long-history-pages-and-reading-anchor' : 'official-long-history-after-reconnect');
    return report;
  } finally {
    await writeFile(resolve(evidence, reopen ? 'long-history.json' : 'long-history-reconnect.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
