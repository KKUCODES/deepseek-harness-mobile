import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 不授予管理权限。写入阶段只在用户确认后设置 DSHM_RUN_LIVE=1；不读取或更改 Key。
const phase = process.argv[2] ?? 'blocked';
assert.ok(['blocked', 'read', 'change', 'restore'].includes(phase));
if (['change', 'restore'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('重新连接').isVisible()) await button('重新连接').click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  if (await button('关闭窗口').isVisible()) await button('关闭窗口').click();
  await button('Remote 选项').click(); await button('电脑设置').click();
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  if (phase === 'blocked') {
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.denied = true;
  } else {
    const field = dialog.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true });
    await field.waitFor();
    if (phase === 'read') {
      const original = Number(await field.inputValue()); assert.ok(Number.isFinite(original));
      const overridden = await field.locator('..').getByText('已单独设置', { exact: true }).count() === 1;
      const changed = original <= 2147482647 ? original + 1000 : original - 1000;
      await writeFile('artifacts/computer-settings-restore.json', JSON.stringify({ original, overridden, changed }, null, 2));
      report.read = true;
    } else {
      const backup = JSON.parse(await readFile('artifacts/computer-settings-restore.json', 'utf8'));
      const expected = phase === 'change' ? backup.changed : backup.original;
      if (phase === 'restore' && !backup.overridden) await field.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
      else await field.fill(String(expected));
      await button('保存到电脑').click(); await dialog.getByText('已保存到电脑。', { exact: true }).waitFor();
      assert.equal(Number(await field.inputValue()), expected);
      await button('重新读取设置').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.remote-computer-settings button')].some(button => button.textContent === '重新读取设置' && !button.disabled));
      assert.equal(Number(await field.inputValue()), expected);
      if (phase === 'restore') assert.equal(await field.locator('..').getByText('已单独设置', { exact: true }).count() === 1, backup.overridden);
      report[phase] = true;
    }
  }
  await page.screenshot({ path: `artifacts/computer-settings-${phase}-android.png`, fullPage: true });
  await button('关闭窗口').click(); await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  console.log(JSON.stringify(report));
} catch (error) { report.failure = error.message; throw error; }
finally { await writeFile(`artifacts/computer-settings-${phase}-android.json`, JSON.stringify(report, null, 2)); await device.close(); }
