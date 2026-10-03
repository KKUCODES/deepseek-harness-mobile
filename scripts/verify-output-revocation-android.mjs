import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立包/独立绑定，真实授权和撤销必须通过电脑插件公开页面操作。
const action = process.argv[2];
assert.ok(['hold', 'revoked'].includes(action));
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), action, errors: [] };
const control = async path => {
  const result = await fetch(`http://127.0.0.1:18794/${path}`, { method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(result.ok); return result.json();
};
try {
  const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.pairingtest')).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  if (action === 'hold') {
    const seed = JSON.parse(await readFile('artifacts/stopped-job-output-seed.json', 'utf8'));
    assert.equal(seed.cleaned, true); assert.equal(seed.verified, true);
    const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
    assert.equal(await heading.innerText(), seed.original);
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '查看已归档聊天', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
    await heading.filter({ hasText: seed.title }).waitFor();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click();
    const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
    await jobs.locator(`[data-job-id="${seed.stopId}"]`).getByRole('button', { name: '查看实时输出', exact: true }).click();
    const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
    await output.locator('pre').filter({ hasText: 'DSHM_STOP_TICK=' }).waitFor();
    report.title = seed.title; report.initialOutput = await output.locator('pre').innerText();
    const before = await control('stats'); assert.equal(before.devices, 1, '只能暂缓独立验收包的一条连接');
    await control('pause');
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    const deadline = Date.now() + 10000;
    do {
      report.proxy = await control('stats');
      if (report.proxy.heldBytes > 0) break;
      assert.ok(Date.now() < deadline, '没有观察到真实在途输出响应');
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (true);
    assert.equal(await output.locator('pre').count(), 0, '被暂缓的输出不能已经出现在页面');
    await output.getByRole('status').filter({ hasText: '正在读取' }).waitFor();
    report.pendingOutputHeld = true;
    await page.screenshot({ path: 'artifacts/output-revocation-held-android.png' });
  } else {
    await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal(await page.getByRole('dialog', { name: '实时任务输出', exact: true }).count(), 0);
    report.revokedWorkspaceRemoved = true;
    report.proxy = await control('stats');
    assert.equal(report.proxy.heldBytes, 0); assert.ok(report.proxy.droppedBytes > 0);
    await control('resume');
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.reconnectRejected = true;
    await page.screenshot({ path: 'artifacts/output-revocation-denied-android.png' });
  }
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(`artifacts/output-revocation-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
