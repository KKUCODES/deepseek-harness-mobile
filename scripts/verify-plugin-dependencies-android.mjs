import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const removed = process.argv.includes('--removed');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), removed, errors: [] };
const id = '@dsh-mobile/missing-dependency-verification';
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-workspace').waitFor();
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  await dialog.getByTestId('remote-plugin-list').waitFor();
  const row = dialog.locator(`[data-plugin-id="${id}"]`);
  if (removed) {
    assert.equal(await row.count(), 0); report.fixtureRemoved = true;
  } else {
    await row.waitFor(); assert.equal(await row.getAttribute('data-plugin-state'), 'waiting');
    await row.getByText('插件依赖尚未就绪，请检查电脑上相关插件是否已启用。', { exact: true }).waitFor();
    await row.getByText('查看缺少的依赖', { exact: true }).click();
    await row.getByText('dshmVerificationMissingService', { exact: true }).waitFor();
    report.missing = await row.locator('li').allTextContents();
    assert.deepEqual(report.missing, ['dshmVerificationMissingService']);
    report.horizontalOverflow = await row.evaluate(node => node.scrollWidth > node.clientWidth + 1);
    assert.equal(report.horizontalOverflow, false);
    await page.screenshot({ path: 'artifacts/plugin-dependencies-android.png' });
  }
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true; assert.deepEqual(report.errors, []);
} catch(error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/plugin-dependencies${removed ? '-removed' : ''}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
