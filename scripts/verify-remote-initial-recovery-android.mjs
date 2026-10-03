import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 已配对的日常 App，真实认证后暂缓首次协商响应并断开载体；不更改绑定或发送聊天。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const artifact = process.env.DSHM_RECOVERY_ARTIFACT ?? 'remote-initial-recovery-android';
assert.match(artifact, /^[a-z0-9-]+$/);
const cancel = process.argv.includes('--cancel');
const control = async path => {
  const response = await fetch(`http://127.0.0.1:18794/${path}`, {
    method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000),
  });
  assert.ok(response.ok); return response.json();
};
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page;
try {
  await device.shell('am force-stop dev.dshmobile.validation');
  await control('pause-initial-load');
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const untilProcess = Date.now() + 30000;
  while (!/^[1-9]\d*$/.test((await device.shell('pidof dev.dshmobile.validation')).toString().trim()) && Date.now() < untilProcess) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  context.on('page', candidate => {
    if (!candidate.url().startsWith('https://remote.dshm.invalid/')) return;
    candidate.on('pageerror', error => report.errors.push(error.message));
    candidate.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    candidate.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  });
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const untilPage = Date.now() + 20000;
  while (!page && Date.now() < untilPage) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page);
  const untilHeld = Date.now() + 20000;
  do {
    report.held = await control('stats');
    if (report.held.heldNegotiations > 0) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < untilHeld);
  assert.ok(report.held.heldNegotiations > 0, '必须实际暂缓电脑协商结果');
  assert.equal(await page.getByTestId('remote-workspace').count(), 0);
  await page.getByTestId('remote-state').filter({ hasText: '正在读取电脑会话…' }).waitFor();
  report.held = await control('stats');
  await page.screenshot({ path: `artifacts/${artifact}-held.png` });
  if (cancel) {
    await page.getByRole('button', { name: '连接选项', exact: true }).click();
    await page.getByRole('button', { name: '断开连接', exact: true }).click();
    await control('resume');
    await page.getByTestId('remote-state').filter({ hasText: '连接已断开' }).waitFor();
    await page.waitForTimeout(2000);
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal(await page.getByRole('alert').count(), 0);
    report.cancelledWithoutReconnect = true;
  } else {
    await control('drop');
    await page.getByTestId('remote-workspace').waitFor({ timeout: 45000 });
    report.recoveredWithoutClick = true;
  }
  assert.equal(await page.getByRole('heading', { name: '连接授权已失效', exact: true }).count(), 0);
  await page.screenshot({ path: `artifacts/${artifact}-recovered.png` });
  // 本轮故意断开一条尚未完成的只读协商，原生请求按原错误终止，不伪造成功。
  report.expectedDisconnectErrors = report.errors.filter(error => error === '[Remote] connection_closed_outcome_unknown' || error === '[Remote] remote_generation_changed');
  report.errors = report.errors.filter(error => !report.expectedDisconnectErrors.includes(error));
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  report.ok = true;
} catch (error) {
  report.failure = error.message;
  if (page) await page.screenshot({ path: `artifacts/${artifact}-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await control('drop').catch(() => {});
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
}
