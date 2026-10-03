import assert from 'node:assert/strict';
import { stat, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立插件通过原 resources 服务读元数据，不发送模型消息或更改文件。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  const draft = await editor.inputValue();
  const existing = page.getByRole('region', { name: '插件面板', exact: true });
  if (await existing.isVisible()) {
    await existing.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await existing.isVisible()) await existing.getByRole('button', { name: '返回聊天', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const dialog = page.getByRole('region', { name: '插件面板', exact: true });
  await dialog.getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
  const panel = page.getByTestId('live-panel');
  const path = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/file-mention-1790345487578.txt';
  await panel.getByRole('textbox', { name: '面板测试文件', exact: true }).fill(path);
  await panel.getByRole('button', { name: '观察文件资源', exact: true }).click();
  const output = panel.getByTestId('live-file-resource');
  await output.filter({ hasText: '"status":"live"' }).waitFor();
  const snapshot = JSON.parse(await output.innerText());
  assert.equal(snapshot.value.bytes, (await stat(path)).size);
  assert.equal(snapshot.value.absolutePath.replaceAll('\\', '/').toLowerCase(), path.toLowerCase());
  assert.ok(snapshot.value.version); report.snapshot = snapshot;
  await page.screenshot({ path: 'artifacts/file-resource-android.png' });
  await panel.getByRole('button', { name: '停止文件观察', exact: true }).click();
  await output.waitFor({ state: 'detached' });
  await panel.getByRole('textbox', { name: '面板测试文件', exact: true }).fill(`${path}.missing`);
  await panel.getByRole('button', { name: '观察文件资源', exact: true }).click();
  await output.filter({ hasText: '"status":"failed"' }).waitFor();
  report.missing = JSON.parse(await output.innerText());
  assert.equal(report.missing.value, undefined);
  await panel.getByRole('button', { name: '停止文件观察', exact: true }).click();
  await output.waitFor({ state: 'detached' });
  await dialog.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await editor.inputValue(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = String(error); throw error; }
finally { await writeFile('artifacts/file-resource-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
