import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createValidationServer } from './serve.mjs';
const folder = resolve('artifacts/unified-updates/web'); await mkdir(folder, { recursive: true });
const server = createValidationServer(resolve('artifacts/ci/web')); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { nativeStateReplay: true, entries: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await context.addInitScript(() => {
    const apk = { version: '0.1.0-preview.12', versionCode: 14, bytes: 11000000, requiredPluginVersion: '0.1.87-latest.0',
      notes: '## 更新说明\n\n- **保留聊天**与草稿。\n\n[发行记录](https://github.com/KKUCODES/deepseek-harness-mobile/releases)\n\n<script>window.noteScriptRan=true</script>' };
    const resource = { revision: 2, bytes: 6000000, notes: '## 页面更新\n\n- **优化更新体验**。' };
    let state = { phase: 'current', revision: 1, currentVersion: '0.1.0-preview.11-dev', currentVersionCode: 13, release: null, requiredPluginVersion: '0.1.87-latest.0',
      resources: { phase: 'current', currentRevision: 0, pendingRevision: 0, received: 0, release: null, restartSupported: true } };
    window.updateFixture = { apk, resource, sent: [], push(patch) { state = { ...state, ...patch, revision: state.revision + 1 }; window.DSHMUpdates.onmessage?.({ data: JSON.stringify({ event: state }) }); },
      resources(patch) { this.push({ resources: { ...state.resources, ...patch } }); } };
    window.DSHMUpdates = { postMessage(raw) {
      const req = JSON.parse(raw), f = window.updateFixture; f.sent.push(req);
      if (req.op === 'updates.check') f.push({ phase: 'available', release: apk });
      if (req.op === 'updates.download') f.push({ phase: 'downloading', received: 5500000 });
      if (req.op === 'updates.cancel') f.push({ phase: 'cancelled' });
      if (req.op === 'updates.install') f.push({ phase: 'permission' });
      if (req.op === 'updates.resources.download') f.resources({ phase: 'downloading', received: 3000000 });
      if (req.op === 'updates.resources.cancel') f.resources({ phase: 'cancelled' });
      if (req.op === 'updates.resources.restart') f.resources({ phase: 'preparing' });
      if (req.op === 'updates.resources.recover') window.recoveryRequested = true;
      if (req.op === 'updates.openLink') window.noteOpenedLink = req.data.url;
      queueMicrotask(() => window.DSHMUpdates.onmessage({ data: JSON.stringify({ id: req.id, data: state }) }));
    } };
    window.DSHMRemote = { postMessage(raw) { const req = JSON.parse(raw);
      const data = req.op === 'binding.info' ? { paired: false } : req.op === 'appearance.read' ? { preference: 'dark', fontSize: 14, language: 'zh', enabled: true } : {};
      queueMicrotask(() => window.DSHMRemote.onmessage({ data: JSON.stringify({ id: req.id, data }) }));
    } };
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => report.errors.push(e.message));
  for (const entry of ['mobile', 'remote']) {
    await page.goto('http://127.0.0.1:' + server.address().port + '/' + entry + '.html');
    if (entry === 'mobile') {
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await page.getByRole('button', { name: '设置', exact: true }).click();
    } else await page.getByRole('button', { name: '连接选项', exact: true }).click();
    await page.getByRole('button', { name: /^软件更新/ }).click();
    const panel = page.getByRole('dialog', { name: '软件更新', exact: true }), footer = panel.locator('.app-update-footer');
    await panel.getByText('已是最新版本', { exact: true }).waitFor();
    await page.evaluate(() => window.updateFixture.resources({ phase: 'available', release: window.updateFixture.resource }));
    await footer.getByRole('button', { name: '下载更新', exact: true }).waitFor();
    assert.equal(await footer.getByRole('button').count(), 1);
    assert.equal(await panel.locator('.app-update-notes').count(), 0);
    await page.screenshot({ path: resolve(folder, entry + '-available.png') });
    await footer.getByRole('button', { name: '下载更新', exact: true }).click();
    assert.equal(await panel.getByRole('progressbar').getAttribute('value'), '3000000');
    await footer.getByRole('button', { name: '取消', exact: true }).click();
    await footer.getByRole('button', { name: '下载更新', exact: true }).click();
    await page.evaluate(() => window.updateFixture.resources({ phase: 'staged', pendingRevision: 2 }));
    await footer.getByRole('button', { name: '重启并应用', exact: true }).waitFor();
    await page.screenshot({ path: resolve(folder, entry + '-staged.png') });
    for (const viewport of [{ width: 360, height: 800 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(100);
      assert.equal(await panel.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
      const box = await footer.getByRole('button', { name: '重启并应用', exact: true }).boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1, 'Primary action stays visible');
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await footer.getByRole('button', { name: '重启并应用', exact: true }).click();
    await panel.getByText('正在保存当前状态', { exact: true }).first().waitFor();
    assert.equal(await panel.getByRole('button', { name: '关闭窗口', exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape'); assert.equal(await panel.isVisible(), true);
    assert.equal(await footer.getByRole('button', { name: '重启并应用', exact: true }).count(), 0);
    await page.evaluate(() => window.updateFixture.resources({ phase: 'staged', error: 'web_restart_save_failed' }));
    await panel.getByText('当前内容未能保存，已取消重启，请重试。', { exact: true }).waitFor();
    await footer.getByRole('button', { name: '重启并应用', exact: true }).waitFor();
    await page.evaluate(() => window.updateFixture.resources({ restartSupported: false, error: null }));
    assert.equal(await footer.getByRole('button').count(), 0);
    await page.evaluate(() => window.updateFixture.push({ phase: 'available', release: window.updateFixture.apk, resources: { phase: 'current', currentRevision: 2, restartSupported: true } }));
    await panel.getByText('0.1.0-preview.12', { exact: true }).waitFor();
    await panel.locator('.app-update-changelog summary').click();
    await panel.getByRole('heading', { name: '更新说明', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => !!window.noteScriptRan), false);
    await panel.getByRole('link', { name: '发行记录', exact: true }).click();
    assert.equal(await page.evaluate(() => window.noteOpenedLink), 'https://github.com/KKUCODES/deepseek-harness-mobile/releases');
    await footer.getByRole('button', { name: '下载更新', exact: true }).click();
    assert.equal(await panel.getByRole('progressbar').getAttribute('value'), '5500000');
    await page.evaluate(() => window.updateFixture.push({ phase: 'ready' }));
    await footer.getByRole('button', { name: '安装更新', exact: true }).click();
    await panel.getByText('允许安装后继续', { exact: true }).waitFor();
    await page.evaluate(() => window.updateFixture.push({ phase: 'error', error: 'update_signature_mismatch' }));
    await panel.getByText('安装包签名与当前 App 不一致，不能覆盖安装。', { exact: true }).waitFor();
    await panel.locator('.app-update-more summary').click();
    await panel.getByRole('button', { name: '恢复内置页面', exact: true }).click();
    assert.equal(await page.evaluate(() => window.recoveryRequested), true);
    report.entries.push(entry);
  }
  assert.deepEqual(report.errors, []); report.passed = true;
  await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); server.close(); }
