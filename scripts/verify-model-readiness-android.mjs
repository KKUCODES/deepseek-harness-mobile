import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), source: 'live Android, native bridge, gateway and desktop', errors: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
  await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
  for (let i = 0; i < 100 && !page; i++) {
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  // 只观察正式组件的请求和返回类型；所有消息原样传递，不读取配置或凭据。
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage;
    const ids = new Set(); window.__readinessAudit = [];
    bridge.postMessage = function (raw) {
      const value = JSON.parse(raw);
      if (value.op === 'socket.send' && value.data?.frame?.operation?.method === 'remote.modelReadiness') ids.add(value.data.frame.id);
      return send.call(this, raw);
    };
    bridge.onmessage = function (event) {
      const value = JSON.parse(event.data).event;
      if (value && ids.has(value.id) && value.type === 'result') window.__readinessAudit.push(value.value.kind);
      return receive.call(this, event);
    };
    window.__restoreReadinessAudit = () => { bridge.postMessage = send; bridge.onmessage = receive; delete window.__readinessAudit; };
  });
  const row = main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) });
  let draft;
  if (await main.locator('.remote-heading strong').innerText() !== 'Remote') {
    const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor(); draft = await input.textContent();
    await button(main, '返回').click();
  }
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  // 进入真实历史再返回，确保观察的是这一次正式首页引导读取。
  await row.click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  if (draft !== undefined) assert.equal(await input.textContent(), draft);
  else draft = await input.textContent();
  await button(main, '返回').click();
  await page.waitForFunction(() => window.__readinessAudit.includes('provider-ready'));
  await page.waitForTimeout(500);
  assert.equal(await page.getByRole('dialog', { name: '添加一个 API Key 开始使用', exact: true }).count(), 0);
  report.readiness = await page.evaluate(() => window.__readinessAudit);
  report.configuredProviderSkipsPrompt = true;
  await page.screenshot({ path: 'artifacts/model-readiness-android.png' });
  await row.click(); await input.waitFor(); assert.equal(await input.textContent(), draft);
  report.chatDraftPreserved = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; throw error; }
finally {
  if (page) await page.evaluate(() => { window.__restoreReadinessAudit?.(); delete window.__restoreReadinessAudit; }).catch(() => {});
  await writeFile('artifacts/model-readiness-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
