import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const removed = process.argv.includes('--removed');
const cards = process.argv.includes('--cards');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554'); assert.ok(device);
const report = { at: new Date().toISOString(), cleanup, errors: [] };
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const deadline = Date.now() + 20000;
    while (!page && Date.now() < deadline) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  if (cleanup) {
    const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
    if (await reconnect.isVisible()) {
      await reconnect.click(); report.reconnectedAfterPermissionChange = true;
    }
  }
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const title = main.locator('.remote-heading strong');
  if (await title.innerText() !== 'DSHM Remote 联调提示') await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.waitFor(); const draft = await input.innerText();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '电脑设置', exact: true }).click();
  const footer = page.getByTestId('live-model-footer');
  if (cleanup) {
    await page.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await footer.count(), 0); report.managementWithdrawn = true;
  } else if (removed) {
    await page.getByLabel('等待输出超时（毫秒）', { exact: true }).first().waitFor();
    assert.equal(await footer.count(), 0); report.uninstalled = true;
  } else {
    await footer.waitFor(); assert.equal(await footer.count(), 1);
    assert.equal(await footer.getAttribute('data-session'), 'none');
    await footer.getByRole('button', { name: '扩展计数 0', exact: true }).click();
    await footer.getByRole('button', { name: '扩展计数 1', exact: true }).waitFor();
    const width = await footer.evaluate(node => node.getBoundingClientRect().width);
    assert.ok(width > 0 && width < 600 && width <= 420); report.scaledWidth = width;
    report.rootScope = true; report.interactive = true;
    if (cards) {
      const official = page.locator('[data-testid="live-provider-card"][data-provider="deepseek-official"]');
      await official.waitFor();
      assert.equal(await official.getAttribute('data-session'), 'none');
      assert.equal(await official.getAttribute('data-configured'), 'true');
      assert.equal(await official.getAttribute('data-key'), 'true');
      assert.equal(await official.getAttribute('data-namespace'), 'llm-deepseek');
      assert.equal(await official.getAttribute('data-path'), '[]');
      const directory = page.getByRole('region', { name: '其他模型提供方', exact: true });
      await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
      await directory.getByRole('button', { name: '新增模型提供方', exact: true }).click();
      await directory.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('catalog');
      const picker = directory.getByRole('combobox', { name: '选择内置提供方', exact: true });
      const route = await picker.inputValue(); assert.ok(route);
      const dormant = directory.locator('[data-testid="live-provider-card"]').filter({ hasText: /未配置/ });
      await dormant.waitFor(); assert.equal(await dormant.getAttribute('data-provider'), route);
      assert.equal(await dormant.getAttribute('data-session'), 'none');
      assert.equal(await dormant.getAttribute('data-namespace'), 'llm-pi-ai');
      assert.equal(await dormant.getAttribute('data-path'), JSON.stringify(['providers', route]));
      assert.equal(await dormant.getAttribute('data-configured'), 'false');
      assert.ok(['true', 'false'].includes(await dormant.getAttribute('data-key')));
      report.providerCards = { official: true, dormant: true, rootScope: true, directoryAddress: true, noSettingsWritten: true };
      await dormant.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/provider-card-dormant-android.png' });
      await directory.getByRole('button', { name: '取消', exact: true }).click();
      await dormant.waitFor({ state: 'detached' });
    }
    await footer.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/model-footer-live-android.png' });
  }
  if (cards && (cleanup || removed)) {
    assert.equal(await page.getByTestId('live-provider-card').count(), 0);
    report.providerCardsAbsent = true;
  }
  await device.shell('input keyevent 4'); await page.locator('.remote-computer-settings').waitFor({ state: 'hidden' });
  assert.equal(await input.innerText(), draft); report.draftPreserved = true; report.androidBack = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/${cards ? 'provider-card' : 'model-footer'}-${cleanup ? 'cleanup' : removed ? 'removed' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
