import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const seed = JSON.parse(await readFile('artifacts/review-live-host.json', 'utf8'));
assert.ok(seed.ready && !seed.cleaned);
const report = { at: new Date().toISOString(), source: seed.source, sessionId: seed.sessionId, checks: [], errors: [], resources: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(15000);
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  if (process.argv.includes('--launch')) {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click();
    await button(ordinary, 'Remote').click();
    const deadline = Date.now() + 20000;
    while (!first.context().pages().some(item => item.url().startsWith('https://remote.dshm.invalid/')) && Date.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 100));
  }
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await button(panel, '返回聊天').click();
  const title = () => main.locator('.remote-heading strong').innerText();
  if (!['Remote', seed.title, 'DSHM Remote 联调提示'].includes(await title())) await button(main, '返回').click();
  if (await title() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  }
  let originalDraft;
  if (await title() === 'DSHM Remote 联调提示') {
    originalDraft = await main.getByRole('textbox', { name: '消息', exact: true }).textContent();
    await button(main, '返回').click();
  } else assert.ok(['Remote', seed.title].includes(await title()));
  if (await title() === 'Remote') {
    // 受控事件不运行 Agent，不产生原客户端清除 blank 所依赖的 running 状态帧。
    await button(main, 'Remote 选项').click();
    await button(page, '刷新会话').click();
    await button(page, '关闭窗口').click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).waitFor({ state: 'detached' });
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.title, { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText(seed.title, { exact: true }).waitFor();
  const entry = page.getByRole('button', { name: /^(查看第 \d+ 轮文件改动|在侧边栏查看本轮改动)$/ }).first();
  await entry.click(); await panel.waitFor();
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const review = active.locator('[data-changes-review]');
  await review.locator('[data-review-view="unified"]').getByText('DSHM_REVIEW_BEFORE', { exact: true }).waitFor();
  await review.getByText('DSHM_REVIEW_AFTER', { exact: true }).waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), 'alpha.txt');
  assert.doesNotMatch(await review.innerText(), /DSHM_REVIEW_LATEST/);
  report.checks.push('Actual turn card opens original ReviewTab with original Host git before/after snapshots');
  await review.locator('[data-review-tool="split"]').click();
  await review.locator('[data-diff-side="left"]').getByText('DSHM_REVIEW_BEFORE', { exact: true }).waitFor();
  await review.locator('[data-diff-side="right"]').getByText('DSHM_REVIEW_AFTER', { exact: true }).waitFor();
  await review.locator('[data-review-tool="wrap"]').click();
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  await review.locator('[data-review-file]').click();
  await page.getByRole('menuitem').filter({ hasText: 'beta.txt' }).click();
  await review.getByText('DSHM_SECOND_BEFORE', { exact: true }).waitFor();
  await review.getByText('DSHM_SECOND_AFTER', { exact: true }).waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), 'beta.txt');
  await page.screenshot({ path: 'artifacts/review-live-multi-android.png' });
  report.checks.push('Split before/after, line wrap and second-file selection use real snapshots');
  if (seed.boundaries) {
    for (const [path, message] of [['binary.dat', '二进制文件，无法显示改动'], ['large.txt', '文件过大，无法显示改动']]) {
      await review.locator('[data-review-file]').click();
      await page.getByRole('menuitem').filter({ hasText: path }).click();
      await review.getByText(message, { exact: true }).waitFor();
      assert.equal(await review.locator('[data-review-view]').count(), 0, 'Unsupported file must not retain the previous text diff');
      assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), path);
      await page.screenshot({ path: `artifacts/review-boundary-${path.split('.')[0]}-android.png` });
    }
    report.checks.push('Original binary and oversized responses display explicit notices and clear the prior text diff');
  }
  await review.locator('[data-review-file]').click();
  await page.getByRole('menuitem').filter({ hasText: 'alpha.txt' }).click();
  await review.getByText('DSHM_REVIEW_AFTER', { exact: true }).waitFor();
  await review.locator('[data-review-tool="open-native"]').click();
  await active.getByRole('group', { name: '确认在电脑打开', exact: true }).waitFor();
  await button(active, '取消').click();
  await review.locator('[data-review-tool="open-file"]').click();
  await active.locator('[data-textpreview-plain]').getByText('DSHM_REVIEW_LATEST', { exact: true }).waitFor();
  assert.equal(await readFile(join(seed.cwd, 'alpha.txt'), 'utf8'), 'DSHM_REVIEW_LATEST\n');
  assert.equal(await readFile(join(seed.cwd, 'beta.txt'), 'utf8'), 'DSHM_SECOND_AFTER\n');
  report.checks.push('Computer-open requires confirmation and can cancel; latest file differs from preserved turn snapshot');
  await panel.getByRole('button', { name: /第 1 轮|Review · turn 1/ }).click();
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  await review.getByText('DSHM_REVIEW_AFTER', { exact: true }).waitFor();
  assert.doesNotMatch(await review.innerText(), /DSHM_REVIEW_LATEST/);
  await page.screenshot({ path: 'artifacts/review-live-snapshot-android.png' });
  await button(panel, '返回聊天').click(); await button(main, '返回').click();
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  if (originalDraft !== undefined) assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), originalDraft);
  report.draftPreserved = originalDraft !== undefined;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.complete = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/review-live-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
