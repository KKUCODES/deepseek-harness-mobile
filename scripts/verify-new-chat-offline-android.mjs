import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device);
const probe = process.argv.includes('--probe');
const report = { at: new Date().toISOString(), probe, errors: [] };
try {
  const page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  const heading = main.locator('.remote-heading strong');
  await main.getByTestId('remote-offline-status').waitFor();
  report.before = await heading.innerText();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  const create = main.getByRole('button', { name: '新建聊天', exact: true });
  report.disabled = await create.isDisabled();
  if (probe) {
    await create.click();
    const dialog = page.getByRole('dialog', { name: '选择工作区', exact: true });
    await dialog.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await main.getByRole('alert').filter({ hasText: /连接|离线/ }).waitFor();
    report.alerts = await main.getByRole('alert').allTextContents();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  } else {
    assert.equal(report.disabled, true);
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click();
    assert.equal(await main.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).isDisabled(), true);
    report.homeDisabled = true;
  }
  report.after = await heading.innerText();
  if (probe) assert.equal(report.after, report.before);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/new-chat-offline-${probe ? 'probe' : 'guard'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
