import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取实际插件列表和安装目录的公开包元数据；加载状态不是功能兼容结论。
const hostRoot = process.env.DSHM_HOST_ROOT;
assert.ok(hostRoot, '请指定正在运行的 DSH 安装目录 DSHM_HOST_ROOT');
const packages = new Map();
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) await collect(join(directory, entry.name));
    if (entry.isFile() && entry.name === 'package.json') {
      const path = join(directory, entry.name);
      const data = JSON.parse(await readFile(path, 'utf8'));
      if (data.name) packages.set(data.name, { version: data.version ?? null, manifest: relative(hostRoot, path).replaceAll('\\', '/') });
    }
  }
}
await collect(join(hostRoot, 'packages'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, '指定的 Android 设备未连接');
const report = { at: new Date().toISOString(), mode: 'Remote', environment: 'Android app / local gateway', errors: [], entries: [] };
let dialog;
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, '请先进入已绑定的 Remote 页面');
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  await main.waitFor();
  const composer = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await composer.count() ? await composer.textContent() : null;
  const heading = await main.locator('.remote-heading strong').innerText();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  await dialog.getByTestId('remote-plugin-list').waitFor();
  report.entries = await dialog.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({
    id: row.dataset.pluginId, state: row.dataset.pluginState,
    reason: row.querySelector('p.muted')?.textContent ?? null,
    missing: [...row.querySelectorAll('li code')].map(node => node.textContent),
  })));
  assert.ok(report.entries.length > 0);
  for (const row of report.entries) row.installedPackage = packages.get(row.id) ?? null;
  report.versionEvidence = 'Installed package.json metadata; not proof of the bytes loaded by this WebView. Unmatched packages remain unknown.';
  report.counts = report.entries.reduce((counts, row) => ({ ...counts, [row.state]: (counts[row.state] ?? 0) + 1 }), {});
  report.androidVersion = (await device.shell('getprop ro.build.version.release')).toString().trim();
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await main.locator('.remote-heading strong').innerText(), heading);
  if (draft !== null) assert.equal(await composer.textContent(), draft);
  report.pageAndDraftPreserved = true;
  assert.deepEqual(report.errors, []);
  report.inspectionComplete = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (dialog && await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click().catch(() => {});
  await writeFile('artifacts/plugin-compatibility-inventory-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ at: report.at, counts: report.counts, complete: report.inspectionComplete, failure: report.failure }));
  await device.close();
}
