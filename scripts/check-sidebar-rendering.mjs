import assert from 'node:assert/strict';
import { checkRemoteResizeFollow } from './check-remote-resize-follow.mjs';
import { writeFile } from 'node:fs/promises';

// 合成事件通过原会话投影和正式旁栏入口；不调用模型或改写电脑历史。
export async function checkSidebarRendering(page) {
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  for (const path of ['src/ui/mobile.css', 'src/ui/remote-product.css', 'artifacts/tests/remote-rendering/test.css']) await page.addStyleTag({ path });
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  const main = page.getByTestId('remote-workspace');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const editor = aside.getByRole('textbox', { name: '消息', exact: true });
  await editor.fill('sidebar draft preserved');
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settle();
  const started = performance.now(), turns = 200;
  await page.evaluate(async turns => {
    window.__workspaceRenders = 0;
    for (let turn = 1; turn <= turns; turn++) {
      window.fixture.emitTurn('child-chat', turn, (turn - 1) * 5, `SIDEBAR_SCALE_${turn}`);
      if (turn % 20 === 0) await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  }, turns);
  await aside.getByText(`SIDEBAR_SCALE_${turns}`, { exact: true }).waitFor({ state: 'attached' });
  await settle();
  const loadedMs = performance.now() - started;
  const renders = await page.evaluate(() => window.__workspaceRenders);
  assert.equal(await aside.getByText(/^SIDEBAR_SCALE_\d+$/, { exact: true }).count(), turns);
  assert.equal(await editor.innerText(), 'sidebar draft preserved');
  const before = await page.evaluate(() => window.__messageRenders);
  await editor.fill('sidebar input still works'); await settle();
  const after = await page.evaluate(() => window.__messageRenders);
  for (const [key, item] of Object.entries(before)) assert.equal(after[key].count, item.count, '旁栏输入不重画已有回复');
  const resizeFollow = await checkRemoteResizeFollow(page, aside.getByRole('region', { name: '聊天内容', exact: true }));
  await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  const state = await page.evaluate(() => window.fixture.sidebarState());
  assert.equal(state.selected, 'one');
  assert.equal(state.drafts['child-chat'], 'sidebar input still works');
  const report = { at: new Date().toISOString(), environment: 'Headless desktop Edge 375×667; synthetic protocol replay, not Android/model throughput',
    turns, events: turns * 5, loadedMs, renders, repliesComplete: true, draftPreserved: true, inputNoHistoricalRenders: true, mainSelectionPreserved: true, resizeFollow };
  await writeFile('artifacts/remote-sidebar-scale-measurement.json', JSON.stringify(report, null, 2));
  assert.ok(renders < turns, `旁栏批量事件不应逐条重画，实际 ${renders} 次`);
  return report;
}
