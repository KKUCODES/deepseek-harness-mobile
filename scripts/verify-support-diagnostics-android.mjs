import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], checks: [] };
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
  ordinary.setDefaultTimeout(20000); ordinary.on('pageerror', e => report.errors.push(e.message));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: '设置', exact: true }).click();
  async function inspect(page, mode, expectedStage) {
    const dialog = page.getByRole('dialog', { name: '问题诊断', exact: true });
    const text = dialog.getByTestId('support-diagnostics'); await text.waitFor();
    const value = JSON.parse(await text.innerText());
    assert.equal(value.mode, mode); assert.equal(value.app.version, '0.1.0-ordinary');
    assert.ok(value.app.androidApi >= 28); assert.ok(value.app.webView);
    assert.deepEqual(Object.keys(value.app).sort(), ['androidApi', 'version', 'versionCode', 'webView']);
    if (mode === 'ordinary') assert.equal('remote' in value, false);
    else {
      assert.equal(value.remote.paired, true);
      if (expectedStage) assert.equal(value.remote.stage, expectedStage);
      assert.equal('origin' in value.remote, false); assert.equal('entries' in value.remote.plugins, false);
    }
    await dialog.getByRole('button', { name: '复制诊断信息', exact: true }).click();
    await dialog.getByText('诊断信息已复制', { exact: true }).waitFor();
    const before = value.capturedAt;
    await dialog.getByRole('button', { name: '重新读取', exact: true }).click();
    await page.waitForFunction(before => JSON.parse(document.querySelector('[data-testid="support-diagnostics"]').textContent).capturedAt !== before, before);
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
    await page.screenshot({ path: `artifacts/diagnostics-${mode}-${expectedStage ?? 'local'}.png` });
    report.checks.push({ mode, stage: expectedStage, nativeVersions: value.app, remote: value.remote, copied: true, refreshed: true });
    await device.shell('input keyevent 4'); await dialog.waitFor({ state: 'detached' });
  }
  await ordinary.getByRole('button', { name: '问题诊断', exact: true }).click();
  await inspect(ordinary, 'ordinary');
  await ordinary.getByRole('button', { name: '退出设置', exact: true }).click();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  let remote; const until = Date.now() + 20000;
  while (!remote && Date.now() < until) { remote = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/')); if (!remote) await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(remote); remote.setDefaultTimeout(20000); remote.on('pageerror', e => report.errors.push(e.message));
  const main = remote.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  const draft = await main.getByRole('textbox', { name: '消息', exact: true }).innerText();
  const openConnection = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await remote.getByRole('button', { name: '电脑连接', exact: true }).click();
  };
  await openConnection(); await remote.getByRole('button', { name: '问题诊断', exact: true }).click();
  await inspect(remote, 'remote', 'connected');
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  await openConnection(); await remote.getByRole('button', { name: '断开连接', exact: true }).click();
  await remote.getByTestId('remote-page').waitFor();
  await remote.getByRole('button', { name: '连接选项', exact: true }).click();
  await remote.getByRole('button', { name: '问题诊断', exact: true }).click();
  await inspect(remote, 'remote', 'disconnected');
  await remote.getByRole('button', { name: '重新连接', exact: true }).click();
  await main.waitFor({ timeout: 60000 });
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true; report.reconnected = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/support-diagnostics-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
