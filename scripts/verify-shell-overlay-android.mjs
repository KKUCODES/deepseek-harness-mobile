import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device);
const report = { at: new Date().toISOString(), cleanup, errors: [] };
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const until = Date.now() + 15000;
    while (!page && Date.now() < until) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const title = main.locator('.remote-heading strong');
  if ((await title.innerText()) !== 'DSHM Remote 联调提示') {
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const overlay = page.getByTestId('live-shell-overlay');
  if (cleanup) {
    await overlay.waitFor({ state: 'detached' });
    const previous = JSON.parse(await readFile('artifacts/shell-overlay-live-android.json', 'utf8'));
    assert.equal(await editor.innerText(), previous.draft); report.unloadClears = true;
  } else {
    report.draft = await editor.innerText();
    await overlay.waitFor(); assert.equal(await overlay.count(), 1);
    assert.equal(await overlay.getAttribute('data-session'), 'none');
    await overlay.getByRole('button', { name: '浮层计数 0', exact: true }).click();
    await overlay.getByRole('button', { name: '浮层计数 1', exact: true }).waitFor();
    report.geometry = await overlay.evaluate(node => ({ natural: node.offsetWidth, displayed: node.getBoundingClientRect().width,
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert.equal(report.geometry.natural, 600); assert.ok(report.geometry.displayed <= report.geometry.viewport + 0.1);
    assert.equal(report.geometry.scrollWidth, report.geometry.clientWidth);
    await editor.click(); assert.equal(await editor.innerText(), report.draft);
    await device.shell('input keyevent 111');
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await overlay.count(), 1); await overlay.getByRole('button', { name: '浮层计数 1', exact: true }).waitFor();
    assert.equal(await editor.innerText(), report.draft);
    report.rootScope = true; report.interactive = true; report.navigationPreservesState = true; report.draftPreserved = true;
  }
  await page.screenshot({ path: `artifacts/shell-overlay-${cleanup ? 'cleanup' : 'live'}-android.png` });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/shell-overlay-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
