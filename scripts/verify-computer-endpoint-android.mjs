import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 正式 App 只读/核对后取消，永不点击保存、不修改电脑真实服务地址。
const phase = process.argv[2] ?? 'blocked';
assert.ok(['blocked', 'review-cancel'].includes(phase));
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
    assert.equal(await dialog.locator('input,select').count(), 0); report.denied = true;
  } else {
    const section = dialog.getByRole('region', { name: '电脑模型服务地址', exact: true });
    const input = section.getByRole('textbox', { name: '新的完整服务地址', exact: true });
    await input.waitFor(); assert.equal(await input.inputValue(), '');
    const original = await section.locator('p').filter({ hasText: /^当前站点：/ }).innerText();
    await input.fill('http://127.0.0.1:43210/anthropic');
    await button('核对新地址').click();
    await section.getByText('这个地址使用 HTTP，传输未加密。', { exact: true }).waitFor();
    await section.getByRole('group', { name: '确认服务地址' }).getByText(/后续模型请求会把电脑 Key 和聊天内容发送到/).waitFor();
    const layout = await section.getByRole('group', { name: '确认服务地址' }).evaluate(node => ({
      overflow: node.scrollWidth > node.clientWidth + 1,
      controlsInside: [...node.querySelectorAll('button')].every(button => button.getBoundingClientRect().right <= node.getBoundingClientRect().right + 1),
    }));
    assert.equal(layout.overflow, false); assert.equal(layout.controlsInside, true);
    await button('确认更改服务地址').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/computer-endpoint-review-android.png', fullPage: true });
    await button('取消更改地址').click(); await button('重新读取服务地址').click();
    await input.waitFor();
    assert.equal(await input.inputValue(), '');
    assert.equal(await section.locator('p').filter({ hasText: /^当前站点：/ }).innerText(), original);
    report.read = true; report.reviewCancelled = true; report.originalSiteRetained = true;
  }
  await page.screenshot({ path: `artifacts/computer-endpoint-${phase}-android.png`, fullPage: true });
  await button('关闭窗口').click(); await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); console.log(JSON.stringify(report));
} catch (error) { report.failure = error.name; throw new Error(`endpoint verification failed: ${error.name}`); }
finally { await writeFile(`artifacts/computer-endpoint-${phase}-android.json`, JSON.stringify(report, null, 2)); await device.close(); }
