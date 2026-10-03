import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

const api = await localDesktopManagement();
const identity = (await api()).devices.find(row => row.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
assert.equal(identity?.name, 'DSHM Android'); assert.equal(identity.management, false);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
let settings;
try {
  await api({ action: 'management', deviceId: identity.id, enabled: true });
  await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(p => p.url().includes('appassets.androidplatform.net'));
  const existing = context.pages().find(p => p.url().includes('remote.dshm.invalid'));
  const opened = existing ? Promise.resolve(existing) : context.waitForEvent('page');
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened;
  page.on('pageerror', () => report.errors.push('page-error'));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.count()) await reconnect.click();
  await page.locator('.connection-dot.online').waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.count()) await welcome.getByRole('button').click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const card = settings.locator('[data-testid="live-provider-card"][data-provider="deepseek-official"]');
  const draft = card.getByRole('textbox', { name: '提供方扩展草稿', exact: true });
  await draft.fill('DSHM provider draft');
  // 记录DOM实例，等到真实回包后再核对，避免只在事件尚未到达时读到旧值。
  await card.evaluate(node => {
    window.cardDraftProbe = { node, hidden: false, restored: false };
    const observer = new MutationObserver(() => {
      const hidden = !node.isConnected || node.closest('[hidden]') !== null;
      if (hidden) window.cardDraftProbe.hidden = true;
      else if (window.cardDraftProbe.hidden) window.cardDraftProbe.restored = true;
    });
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    window.cardDraftProbe.stop = () => observer.disconnect();
  });
  const sequence = randomUUID();
  await writeFile('artifacts/provider-card-refresh-command.json', JSON.stringify({ sequence }));
  await page.waitForFunction(() => window.cardDraftProbe.restored, null, { timeout: 20000 });
  const host = JSON.parse(await readFile('artifacts/provider-card-refresh-host.json', 'utf8'));
  assert.equal(host.sequence, sequence); assert.equal(host.emitted, true);
  assert.equal(await draft.inputValue(), 'DSHM provider draft');
  assert.equal(await card.evaluate(node => node === window.cardDraftProbe.node), true);
  await page.evaluate(() => window.cardDraftProbe.stop());
  report.realHostInvalidation = true; report.samePluginInstance = true; report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await settings?.getByRole('button', { name: '关闭窗口', exact: true }).click().catch(() => {});
  await api({ action: 'management', deviceId: identity.id, enabled: false });
  const after = (await api()).devices.find(row => row.id === identity.id);
  assert.equal(after.management, false); assert.equal(after.status, 'active'); report.managementWithdrawn = true;
  await writeFile('artifacts/provider-card-draft-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
