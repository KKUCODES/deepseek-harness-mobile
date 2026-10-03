import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { basename } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取刚刚真实模型写入的轮次，不恢复文件、不重放工具或创建快照。
const seed = JSON.parse(await readFile('artifacts/original-tool-approval-live-20260927-seed.json', 'utf8'));
assert.ok(seed.verified && seed.cleaned);
await assert.rejects(access(seed.path), { code: 'ENOENT' });
const report = { at: new Date().toISOString(), errors: [], resources: [], source: 'original-tool-approval-live-20260927' };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device);
let page, panel, input, draft;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  input = main.getByRole('textbox', { name: '消息', exact: true });
  draft = await input.textContent();
  const entries = page.getByRole('button', { name: /^(查看第 \d+ 轮文件改动|在侧边栏查看本轮改动)$/ });
  let entry;
  for (const candidate of await entries.all()) {
    if ((await candidate.evaluate(node => node.parentElement.innerText)).includes(basename(seed.path))) entry = candidate;
  }
  assert.ok(entry, '只打开已核实的真实写入轮次');
  await entry.click();
  panel = page.getByRole('region', { name: '插件面板', exact: true }); await panel.waitFor();
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const review = active.locator('[data-changes-review]');
  await active.locator('[data-review-file], [data-changes-review][data-review-state="missing"]').first().waitFor();
  report.state = await review.getAttribute('data-review-state');
  assert.notEqual(report.state, 'missing', '真实写入轮次必须有可读快照');
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), basename(seed.path));
  await review.locator('[data-review-view="unified"]').getByText(seed.before, { exact: true }).waitFor();
  await review.getByText(seed.after, { exact: true }).waitFor();
  report.unifiedMatchesActualWrite = true;
  await review.locator('[data-review-tool="split"]').click();
  await review.locator('[data-diff-side="left"]').getByText(seed.before, { exact: true }).waitFor();
  await review.locator('[data-diff-side="right"]').getByText(seed.after, { exact: true }).waitFor();
  report.splitMatchesActualWrite = true;
  await assert.rejects(access(seed.path), { code: 'ENOENT' });
  report.snapshotSurvivesSourceDeletion = true;
  await page.screenshot({ path: 'artifacts/model-review-android.png' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (panel && await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (input && draft !== undefined) {
    report.draftPreserved = await input.textContent() === draft;
    if (!report.draftPreserved) { report.failure ??= '草稿不一致'; process.exitCode = 1; }
  }
  await writeFile('artifacts/model-review-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
