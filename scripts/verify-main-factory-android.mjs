import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', item => { if (item.type() === 'error') report.errors.push(item.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  await input.waitFor();
  assert.match(await main.locator('.remote-heading strong').innerText(), /^DSHM Remote 联调提示/);
  const frame = main.locator('[data-conversation-content][data-content-variant="main"]'); await frame.waitFor();
  if (cleanup) {
    const previous = JSON.parse(await readFile('artifacts/main-factory-live-android.json', 'utf8'));
    await main.getByTestId('live-main-replace').waitFor({ state: 'detached' });
    await main.getByTestId('live-main-replacement').waitFor({ state: 'detached' });
    assert.equal(await input.innerText(), previous.originalDraft);
    report.unloaded = true; report.originalRestored = true;
  } else {
    report.originalDraft = await input.innerText();
    const editor = await input.elementHandle();
    const scroller = main.getByRole('region', { name: '聊天内容', exact: true });
    await scroller.evaluate(async node => {
      node.scrollTop = 40;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const position = await scroller.evaluate(node => node.scrollTop);
    const trigger = main.getByTestId('live-main-replace'); await trigger.waitFor();
    report.sessionId = await trigger.getAttribute('data-session');
    await trigger.click();
    const replacement = main.getByTestId('live-main-replacement'); await replacement.waitFor();
    assert.equal(await replacement.getAttribute('data-session'), report.sessionId);
    assert.equal(await replacement.getAttribute('data-open'), 'open');
    assert.equal(await replacement.getAttribute('data-main-count'), '1');
    assert.equal(await input.evaluate((node, before) => node === before, editor), true);
    assert.equal(await input.innerText(), report.originalDraft);
    const box = await input.boundingBox(); assert.ok(box && box.y + box.height <= await page.evaluate(() => innerHeight));
    await page.screenshot({ path: 'artifacts/main-factory-live-android.png' });
    await replacement.getByRole('button', { name: '恢复正文', exact: true }).click();
    await replacement.waitFor({ state: 'detached' });
    await scroller.waitFor();
    assert.equal(await input.evaluate((node, before) => node === before, editor), true);
    assert.equal(await input.innerText(), report.originalDraft);
    await page.waitForFunction(expected => document.querySelector('[data-testid="remote-workspace"] .conversation')?.scrollTop === expected, position);
    report.scrollRestored = position; report.residentComposer = true; report.mainReferencePreserved = true;
    report.originalRestored = true; await editor.dispose();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  await writeFile(`artifacts/main-factory-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  if (page) {
    const restore = page.getByRole('button', { name: '恢复正文', exact: true });
    if (await restore.isVisible().catch(() => false)) await restore.click().catch(() => {});
    await page.screenshot({ path: 'artifacts/main-factory-failure-android.png' }).catch(() => {});
  }
  throw error;
} finally { await device.close(); }
