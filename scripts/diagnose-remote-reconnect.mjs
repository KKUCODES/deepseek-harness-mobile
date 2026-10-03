import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// 开发诊断：仅操作已有绑定，重复正式页面的断开/连接，不发送聊天或更改权限。
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), attempts: [], errors: [] };
const delays = process.env.DSHM_RECONNECT_IDLE_MS ? process.env.DSHM_RECONNECT_IDLE_MS.split(',').map(Number) : [0, 1000, 5000, 0, 5000, 1000, 0, 5000];
assert.ok(delays.every(value => Number.isInteger(value) && value >= 0 && value <= 120000));
try {
  const first = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    await first.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await first.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.getByTestId('remote-state').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"]')
    || document.querySelector('[data-testid="remote-page"] [role="alert"]'), undefined, { timeout: 45000 });
  for (const idleMs of delays) {
    const workspace = page.getByTestId('remote-workspace');
    if (await workspace.count()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑连接', exact: true }).click();
      await page.getByRole('button', { name: '断开连接', exact: true }).click();
    }
    const retry = page.getByRole('button', { name: '重新连接', exact: true });
    await retry.waitFor();
    const deadline = Date.now() + 30000;
    while (!await retry.isEnabled()) { assert.ok(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 100)); }
    if (idleMs) await new Promise(resolve => setTimeout(resolve, idleMs));
    const started = Date.now();
    await retry.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"]')
      || document.querySelector('[data-testid="remote-page"] [role="alert"]'), undefined, { timeout: 30000 });
    const connected = await workspace.count() > 0;
    report.attempts.push({ idleMs, connected, elapsedMs: Date.now() - started });
    console.log(JSON.stringify(report.attempts.at(-1)));
  }
  assert.ok(report.attempts.every(item => item.connected));
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile('artifacts/remote-reconnect-diagnosis.json', JSON.stringify(report, null, 2));
  await device.close();
}
