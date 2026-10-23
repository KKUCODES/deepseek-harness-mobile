import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createValidationServer } from './serve.mjs';
const folder = resolve('artifacts/web-update-tests/web'); await mkdir(folder, { recursive: true });
const server = createValidationServer(resolve('artifacts/official-rc21-mobile-dist')); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { syntheticNativeState: true, errors: [], entries: [] };
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await context.addInitScript(() => {
    let state = { phase: 'current', revision: 1, currentVersion: '0.1.0-preview.9', currentVersionCode: 11, release: null, requiredPluginVersion: '0.1.87-latest.0',
      resources: { phase: 'current', currentRevision: 0, pendingRevision: 0, received: 0, release: null } };
    const release = { revision: 1, bytes: 2000000, notes: '## 页面更新\n\n- **保留聊天**与草稿。' };
    window.webUpdateFixture = { push(patch) {
      state = { ...state, revision: state.revision + 1, resources: { ...state.resources, ...patch } };
      window.DSHMUpdates.onmessage?.({ data: JSON.stringify({ event: state }) });
    } };
    window.DSHMUpdates = { postMessage(raw) {
      const request = JSON.parse(raw);
      if (request.op === 'updates.resources.check') window.webUpdateFixture.push({ phase: 'available', release, error: null });
      if (request.op === 'updates.resources.download') window.webUpdateFixture.push({ phase: 'downloading', received: 1000000 });
      if (request.op === 'updates.resources.cancel') window.webUpdateFixture.push({ phase: 'cancelled' });
      if (request.op === 'updates.resources.recover') window.recoveryRequested = true;
      queueMicrotask(() => window.DSHMUpdates.onmessage({ data: JSON.stringify({ id: request.id, data: state }) }));
    } };
    window.DSHMRemote = { postMessage(raw) {
      const request = JSON.parse(raw), data = request.op === 'binding.info' ? { paired: false } : request.op === 'appearance.read' ? { preference: 'dark', fontSize: 14, language: 'zh', enabled: true } : {};
      queueMicrotask(() => window.DSHMRemote.onmessage({ data: JSON.stringify({ id: request.id, data }) }));
    } };
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const entry of ['mobile', 'remote']) {
    await page.goto(`${base}/${entry}.html`);
    if (entry === 'mobile') {
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await page.getByRole('button', { name: '设置', exact: true }).click();
    } else await page.getByRole('button', { name: '连接选项', exact: true }).click();
    await page.getByRole('button', { name: /^软件更新/ }).click();
    const panel = page.getByRole('dialog', { name: '软件更新', exact: true });
    const resources = panel.getByTestId('resource-updates');
    await resources.getByText('APK 内置页面', { exact: true }).waitFor();
    await resources.getByRole('button', { name: '检查页面更新', exact: true }).click();
    await resources.getByRole('button', { name: '下载页面更新', exact: true }).waitFor();
    await resources.locator('summary').filter({ hasText: '更新内容' }).click();
    await resources.getByRole('heading', { name: '页面更新', exact: true }).waitFor();
    await resources.getByRole('button', { name: '下载页面更新', exact: true }).click();
    assert.equal(await resources.getByRole('progressbar').getAttribute('value'), '1000000');
    await resources.getByRole('button', { name: '取消', exact: true }).click();
    await resources.getByRole('button', { name: '下载页面更新', exact: true }).click();
    await page.evaluate(() => window.webUpdateFixture.push({ phase: 'staged', pendingRevision: 1 }));
    await resources.getByText('已下载，下次完整启动后生效', { exact: true }).waitFor();
    assert.equal(await resources.getByRole('button', { name: '下载页面更新', exact: true }).count(), 0);
    assert.equal(await resources.getByText('APK 内置页面', { exact: true }).count(), 1, '下载完成不冒充已经启用');
    await page.screenshot({ path: resolve(folder, `${entry}-staged.png`) });
    assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.evaluate(() => window.webUpdateFixture.push({ phase: 'error', pendingRevision: 0, error: 'web_signature_invalid' }));
    await resources.getByText('页面资源签名校验失败，已拒绝更新。', { exact: true }).waitFor();
    await page.evaluate(() => window.webUpdateFixture.push({ phase: 'current', currentRevision: 1, error: null, release: null, notice: 'web_rolled_back' }));
    await resources.getByText('上次页面启动失败，已恢复可用页面。', { exact: true }).waitFor();
    await resources.locator('summary').filter({ hasText: '更多' }).click();
    await resources.getByRole('button', { name: '恢复内置页面', exact: true }).click();
    assert.equal(await page.evaluate(() => window.recoveryRequested), true);
    report.entries.push(entry);
  }
  assert.deepEqual(report.errors, []); report.passed = true;
  await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); server.close(); }
