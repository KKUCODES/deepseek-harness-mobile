import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium, _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seed = JSON.parse(await readFile('artifacts/approval-timeout-host.json', 'utf8'));
assert.ok(seed.ready && !seed.cleaned && !seed.failure && seed.results.length === 0);
const report = { at: new Date().toISOString(), sessionId: seed.sessionId,
  source: 'Original desktop UI plus actual Android Remote; original ApprovalService; controlled session events; no model/tool execution',
  checks: [], errors: [], resources: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const button = (root, name) => root.getByRole('button', { name, exact: true });
let phone, originalDraft;
try {
  // 原登录入口交换身份；启动链接只在内存使用，不写入报告/截图或异常文本。
  const log = await readFile('artifacts/review-boundary-dsh.stdout.log', 'utf8');
  const urls = [...new Set(log.match(/http:\/\/127\.0\.0\.1:3080\/\?token=[A-Za-z0-9_-]+/g))];
  assert.equal(urls.length, 1);
  const desktop = await browser.newPage();
  try { await desktop.goto(urls[0]); } catch { throw new Error('Desktop login failed; URL omitted'); }
  await desktop.getByText('DSHM 审批超时测试', { exact: true }).click();
  await desktop.getByRole('treeitem').filter({ has: desktop.getByText(seed.title, { exact: true }) }).click();
  await desktop.getByText('DSHM 审批生命周期验收：受控事件，不调用模型，不执行工具。', { exact: true }).waitFor();
  const first = await (await androidAppWebView(device)).page();
  phone = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(phone);
  for (const [name, page] of [['phone', phone], ['desktop', desktop]]) {
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push({ page: name, error: error.message }));
    page.on('response', response => { if (response.status() >= 400) report.resources.push({ page: name, path: new URL(response.url()).pathname, status: response.status() }); });
  }
  const main = phone.getByTestId('remote-workspace'), title = main.locator('.remote-heading strong');
  assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
  const input = () => main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input().textContent();
  originalDraft = draft;
  await button(main, '返回').click();
  await button(main, 'Remote 选项').click(); await button(phone, '刷新会话').click(); await button(phone, '关闭窗口').click();
  await main.locator('button.remote-session-row').filter({ has: phone.getByText(seed.title, { exact: true }) }).click();
  await title.getByText(seed.title, { exact: true }).waitFor();
  const phoneCard = phone.locator('[data-approval-key]'), desktopCard = desktop.locator('[data-approval-key]');
  for (const mode of ['phone', 'desktop', 'race']) {
    const id = randomUUID();
    await writeFile('artifacts/approval-timeout-control.json', JSON.stringify({ id, kind: 'reject', sessionId: seed.sessionId }));
    await Promise.all([phoneCard.waitFor(), desktopCard.waitFor()]);
    const phoneNode = await phoneCard.elementHandle(), desktopNode = await desktopCard.elementHandle();
    await desktop.screenshot({ path: `artifacts/approval-two-${mode}-desktop.png` });
    let race;
    if (mode === 'race') {
      // 两端先定位已呈现的按钮，再按校准时刻触发原click处理器；不改wire或审批结果。
      // 普通locator.click的自动等待可能在另一端已处理后才执行，不能据此宣称同时提交。
      const clockOffset = async page => {
        const before = Date.now(), clientNow = await page.evaluate(() => Date.now()), after = Date.now();
        return { offset: clientNow - (before + after) / 2, uncertaintyMs: (after - before) / 2 };
      };
      const clocks = await Promise.all([clockOffset(phone), clockOffset(desktop)]);
      const buttons = await Promise.all([button(phoneCard, '允许一次').elementHandle(), button(desktopCard, '拒绝').elementHandle()]);
      const planned = Date.now() + 1500;
      race = await Promise.all(buttons.map((element, index) => element.evaluate((node, time) => new Promise(resolve => {
        setTimeout(() => {
          const connected = node.isConnected && !node.disabled, at = Date.now();
          if (connected) node.click();
          resolve({ connected, at });
        }, Math.max(0, time - Date.now()));
      }), planned + clocks[index].offset)));
      await Promise.all(buttons.map(element => element.dispose()));
      report.raceTiming = { clocks, submissions: race, estimatedGapMs: Math.abs((race[0].at - clocks[0].offset) - (race[1].at - clocks[1].offset)) };
      assert.ok(race.every(action => action.connected), 'Both original UI handlers must run before either card is detached');
    } else await button(mode === 'phone' ? phoneCard : desktopCard, '拒绝').click();
    const deadline = Date.now() + 10000;
    let host, result;
    while (Date.now() < deadline) {
      host = JSON.parse(await readFile('artifacts/approval-timeout-host.json', 'utf8'));
      assert.ok(!host.failure, host.failure); result = host.results.find(item => item.id === id);
      if (result) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(result);
    if (mode === 'race') assert.ok(['allowed-once', 'rejected'].includes(result.outcome));
    else assert.equal(result.outcome, 'rejected');
    await Promise.all([phoneCard.waitFor({ state: 'detached' }), desktopCard.waitFor({ state: 'detached' })]);
    assert.equal(await phoneNode.evaluate(node => node.isConnected), false);
    assert.equal(await desktopNode.evaluate(node => node.isConnected), false);
    await phoneNode.dispose(); await desktopNode.dispose();
    const asked = host.audit.filter(event => event.type === 'approval/asked');
    const decisions = host.audit.filter(event => event.type === 'approval/decided');
    assert.equal(asked.length, report.checks.length + 1); assert.equal(decisions.length, asked.length);
    assert.equal(decisions.filter(event => event.data.id === asked.at(-1).data.id).length, 1);
    assert.equal(decisions.at(-1).data.outcome, result.outcome);
    report.checks.push({ mode, outcome: result.outcome, bothCardsRemoved: true, exactlyOneDurableDecision: true, ...(race ? { clicks: race } : {}) });
  }
  await input().waitFor();
  await button(main, '返回').click();
  await main.locator('button.remote-session-row').filter({ has: phone.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await input().waitFor(); assert.equal(await input().textContent(), draft);
  report.originalChatAndDraftRestored = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.complete = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await unlink('artifacts/approval-timeout-control.json').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (report.failure && phone && originalDraft !== undefined) {
    try {
      const main = phone.getByTestId('remote-workspace');
      if (await main.locator('.remote-heading strong').innerText() === seed.title) await button(main, '返回').click();
      if (await main.locator('.remote-heading strong').innerText() === 'Remote')
        await main.locator('button.remote-session-row').filter({ has: phone.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
      const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
      assert.equal(await input.textContent(), originalDraft); report.restoredAfterFailure = true;
    } catch { report.restoredAfterFailure = false; }
  }
  await writeFile('artifacts/approval-two-clients.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await browser.close(); await device.close();
}
