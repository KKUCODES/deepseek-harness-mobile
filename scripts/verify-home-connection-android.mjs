import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只观察正式首页；外部重启已核对的本地 DSH，不发送消息或更改绑定。
const device = (await _android.devices({ omitDriverInstall: true }))
  .find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], samples: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace');
  await workspace.waitFor({ timeout: 60000 });
  if (await workspace.locator('.remote-heading').innerText() === 'DSHM Remote 联调提示') {
    await page.getByRole('button', { name: '返回', exact: true }).click();
  }
  assert.equal(await workspace.locator('.remote-heading').innerText(), 'Remote');
  const strip = workspace.locator('.connection-strip');
  await strip.getByText('已连接电脑', { exact: true }).waitFor();
  assert.equal(await strip.locator('.connection-dot.online').count(), 1);
  console.log('READY: observe a verified local DSH restart');
  let previous, interrupted = false, stableAt;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="remote-workspace"] .connection-strip');
      return strip ? { label: strip.textContent, online: !!strip.querySelector('.connection-dot.online') } : null;
    });
    if (JSON.stringify(sample) !== previous) {
      previous = JSON.stringify(sample); report.samples.push({ at: new Date().toISOString(), ...sample });
      console.log(previous);
    }
    if (sample && sample.label !== '已连接电脑') {
      assert.ok(['电脑连接已断开', '正在连接电脑…'].includes(sample.label));
      assert.equal(sample.online, false, 'Disconnected/reconnecting must not show the online dot');
      if (!interrupted) await page.screenshot({ path: 'artifacts/home-connection-offline-android.png' });
      interrupted = true; stableAt = undefined;
    }
    if (interrupted && sample?.label === '已连接电脑') {
      assert.equal(sample.online, true);
      stableAt ??= Date.now();
      if (Date.now() - stableAt > 1500) { report.recovered = true; break; }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(interrupted, true);
  assert.equal(report.recovered, true);
  await page.screenshot({ path: 'artifacts/home-connection-recovered-android.png' });
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await workspace.locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  report.returned = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile('artifacts/home-connection-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
