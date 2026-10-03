import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const seed = JSON.parse(await readFile('artifacts/cordis-history-host.json', 'utf8'));
assert.equal(seed.complete, true);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), sessionId: seed.sessionId, sourceHash: seed.sourceHash, errors: [], resources: [] };
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const button = name => main.getByRole('button', { name, exact: true });
  const heading = main.locator('.remote-heading strong');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.count()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const original = 'DSHM Remote 联调提示';
  if (await heading.innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
    await main.getByRole('button', { name: new RegExp(`^${original}`) }).click();
    await heading.getByText(original, { exact: true }).waitFor();
  }
  // 失败后可从同一测试会话继续；原草稿从已保留的前次报告恢复核对。
  let draft;
  if (await heading.innerText() === seed.title) {
    const prior = JSON.parse(await readFile('artifacts/cordis-history-android.json', 'utf8')); draft = prior.originalDraft;
  } else {
    assert.equal(await heading.innerText(), original);
    draft = await main.getByRole('textbox', { name: '消息', exact: true }).innerText();
  }
  report.originalDraft = draft;
  async function openFixture() {
    if (await heading.innerText() !== 'Remote') await button('返回').click();
    const search = main.getByRole('textbox', { name: '搜索远程聊天', exact: true }); await search.fill(seed.title);
    await main.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
    await heading.getByText(seed.title, { exact: true }).waitFor();
    await main.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
    for (let i = 0; i < 6 && !await main.locator('[data-tool="cordis_define"]').count(); i++) {
      const older = button('加载更早的消息');
      if (!await older.count()) break;
      const count = await main.locator('.conversation article').count(); await older.click();
      await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
    }
    for (const toggle of await main.locator('[data-turn-process][aria-expanded="false"]').all()) {
      if (await toggle.isVisible()) await toggle.click();
    }
  }
  await openFixture();
  const define = main.locator('[data-tool="cordis_define"]');
  const run = main.locator('[data-tool="cordis_run"]');
  const stop = main.locator('[data-tool="cordis_stop"]');
  await define.waitFor(); await run.waitFor(); await stop.waitFor();
  assert.equal(await define.getAttribute('data-state'), 'ok');
  assert.equal(await run.getAttribute('data-state'), 'ok');
  assert.equal(await stop.getAttribute('data-state'), 'ok');
  await define.locator('[aria-expanded]').first().click();
  await define.getByRole('tabpanel').filter({ hasText: 'snapshot-probe' }).waitFor();
  await define.getByRole('tab', { name: 'Host', exact: true }).click();
  await define.getByRole('tabpanel').filter({ hasText: 'snapshot-noop' }).waitFor();
  assert.ok((await run.innerText()).includes('awaiting user approval'));
  assert.ok((await stop.innerText()).includes('snap-1'));
  assert.equal(await page.locator('[data-snapshot-probe], [data-cordis-business-view]').count(), 0);
  const bounds = await define.boundingBox();
  const width = await page.evaluate(() => innerWidth);
  assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
  report.cards = { definition: true, clientAndHostSource: true, recordedRunResult: true, stopped: true, noHistoricalCodeExecution: true, bounds, width };
  await page.screenshot({ path: 'artifacts/cordis-history-android.png' });
  await openFixture();
  await define.waitFor(); await run.waitFor(); await stop.waitFor();
  report.reopened = true;
  await button('Remote 选项').click(); await button('归档聊天').click();
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await main.getByRole('button', { name: new RegExp(`^${original}`) }).click();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.originalDraftPreserved = true; report.fixtureArchived = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) { report.visible = (await page.locator('body').innerText()).slice(0, 5500); await page.screenshot({ path: 'artifacts/cordis-history-failure.png' }).catch(() => {}); }
} finally {
  await writeFile('artifacts/cordis-history-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, originalDraft: undefined })); await device.close();
}
