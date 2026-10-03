import assert from 'node:assert/strict';
import { fixtureText, fixtureReasoning } from '../src/stream-fixtures.mjs';

/** 在真正 WebView 中验证协议组件；仅离线字节回放，不替代真实模型/网络/历史验收。 */
export async function checkStream(page) {
  const results = [];
  for (const [scenario, status, error] of [['complete', 'completed', ''], ['truncated', 'interrupted', 'stream_closed'], ['stalled', 'interrupted', 'stopped']]) {
    await page.getByTestId(`stream-${scenario}`).click();
    await page.waitForFunction(text => document.querySelector('[data-testid="stream-content"]').textContent === text, fixtureText);
    if (scenario === 'stalled') await page.getByTestId('stream-stop').click();
    await page.waitForFunction(expected => document.querySelector('[data-testid="stream-status"]').dataset.status === expected, status);
    assert.equal(await page.getByTestId('stream-status').getAttribute('data-error'), error);
    assert.equal(await page.getByTestId('stream-reasoning').innerText(), fixtureReasoning);
    assert.equal(await page.getByTestId('stream-content').innerText(), fixtureText);
    assert.equal(await page.getByTestId('stream-stop').isDisabled(), true);
    results.push({ scenario, status, error });
  }
  return { method: 'offline synthetic SSE byte replay; NOT a model API call or network-performance test', results };
}
