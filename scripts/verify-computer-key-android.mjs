import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 只验证状态及打开后取消；不输入、保存或移除电脑凭据，不授予设备权限。
const phase = process.argv[2] ?? 'blocked';
assert.ok(['blocked', 'view-cancel'].includes(phase));
if (phase === 'view-cancel') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
let nativeOpen = false;
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
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('重新连接').isVisible()) await button('重新连接').click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  if (await button('关闭窗口').isVisible()) await button('关闭窗口').click();
  await button('Remote 选项').click(); await button('电脑设置').click();
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  if (phase === 'blocked') {
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    assert.equal(await button('管理电脑 Key').count(), 0); report.denied = true;
  } else {
    const key = dialog.getByRole('region', { name: '电脑 DeepSeek Key', exact: true });
    await key.getByText(/^(已配置|尚未配置)$/).waitFor();
    report.configured = await key.getByText('已配置', { exact: true }).count() === 1;
    report.writable = await button('管理电脑 Key').isEnabled();
    assert.equal(await dialog.locator('input[type=password]').count(), 0);
    if (report.writable) {
      report.stage = 'open';
      await button('管理电脑 Key').click(); nativeOpen = true;
      report.stage = 'native-window';
      // 复用系统选择器的观测方式，不依赖 MuMu 上未安装的 Playwright 输入驱动。
      await device.shell('uiautomator dump /data/local/tmp/dshm-key-check.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-key-check.xml')).toString();
      const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
        .filter(node => node.package === 'dev.dshmobile.validation');
      assert.ok(nodes.some(node => node.text === '电脑 DeepSeek Key'));
      assert.ok(nodes.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
      report.stage = 'cancel';
      const cancel = nodes.filter(node => node.text === '取消' && node.class === 'android.widget.Button');
      assert.equal(cancel.length, 1);
      const points = cancel[0].bounds.match(/\d+/g).map(Number);
      await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`); nativeOpen = false;
      report.stage = 'read-after-cancel';
      await button('管理电脑 Key').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === '管理电脑 Key' && !b.disabled));
      assert.equal(await key.getByText('已配置', { exact: true }).count() === 1, report.configured);
      report.openedAndCancelled = true;
    } else {
      await key.getByText('电脑 Key 来自只读配置，请在电脑上修改。', { exact: true }).waitFor();
      report.readOnly = true;
    }
  }
  await page.screenshot({ path: `artifacts/computer-key-${phase}-android.png`, fullPage: true });
  await button('关闭窗口').click(); await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  console.log(JSON.stringify(report));
} catch (error) { report.failure = error.name; throw new Error(`computer-key verification failed: ${error.name}`); }
finally {
  if (nativeOpen) await device.shell('input keyevent 4').catch(() => {});
  await writeFile(`artifacts/computer-key-${phase}-android.json`, JSON.stringify(report, null, 2)); await device.close();
}
