import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 只使用独立验收包；有效链接从标准输入读取，不写入报告或命令行参数。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['claim', 'pending', 'connected', 'revoked', 'forget-revoked'].includes(phase));
const pkg = 'dev.dshmobile.validation.pairingtest';
const foregroundCase = process.env.DSHM_PAIR_CASE === 'foreground-output-revocation';
const revokeCase = process.env.DSHM_PAIR_CASE === 'output-revocation';
const resourceCase = process.env.DSHM_PAIR_CASE === 'resource-revocation';
const workerCase = process.env.DSHM_PAIR_CASE === 'worker-revocation';
const cordisCase = process.env.DSHM_PAIR_CASE === 'cordis-revocation';
const twoClientsCase = process.env.DSHM_PAIR_CASE === 'cordis-two-clients';
const inflightCase = process.env.DSHM_PAIR_CASE === 'cordis-inflight';
const approvalRaceCase = process.env.DSHM_PAIR_CASE === 'cordis-approval-race';
const approvalOverlapCase = process.env.DSHM_PAIR_CASE === 'cordis-approval-overlap';
const artifact = foregroundCase ? 'foreground-output-revocation-pair' : approvalOverlapCase ? 'cordis-approval-overlap-pair' : approvalRaceCase ? 'cordis-approval-race-pair' : inflightCase ? 'cordis-inflight-pair' : twoClientsCase ? 'cordis-two-clients-pair' : cordisCase ? 'cordis-revocation-pair' : workerCase ? 'worker-revocation-pair' : resourceCase ? 'resource-revocation-pair' : revokeCase ? 'output-revocation-pair' : 'remote-pair-valid';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), phase, package: pkg, errors: [] };
try {
  let canonical;
  if (phase === 'claim') {
    let raw = ''; for await (const chunk of process.stdin) raw += chunk;
    const link = raw.trim(); const parsed = new URL(link);
    assert.equal(parsed.protocol, 'dshm:'); assert.equal(parsed.host, 'pair');
    assert.equal(parsed.searchParams.get('server'), 'http://127.0.0.1:8787');
    assert.match(parsed.hash, /^#key=[A-Za-z0-9_-]{43}$/);
    canonical = `http://127.0.0.1:8787/pair${parsed.hash}`;
    assert.equal(link, `dshm://pair?server=${encodeURIComponent('http://127.0.0.1:8787')}${parsed.hash}`);
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${link}' -p ${pkg}`);
  }
  const first = await (await androidAppWebView(device, pkg)).page();
  let page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page && phase !== 'claim') {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); page = await opened;
  }
  page ??= await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  if (phase === 'claim') {
    const field = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
    await field.waitFor(); assert.equal(await field.inputValue(), canonical);
    assert.equal(await page.getByTestId('remote-fingerprint').count(), 0);
    report.prefilledWithoutClaim = true;
    await page.getByRole('textbox', { name: '设备名称', exact: true }).fill(foregroundCase ? 'DSHM 前台输出撤销验收 039' : approvalOverlapCase ? 'DSHM 启动并发审批验收 038' : approvalRaceCase ? 'DSHM 双端审批验收 037' : inflightCase ? 'DSHM 动态调用在途验收 036' : twoClientsCase ? 'DSHM 双客户端同步验收 035' : cordisCase ? 'DSHM 动态插件撤销验收 034' : workerCase ? 'DSHM Worker 在途验收 033' : resourceCase ? 'DSHM 资源撤销验收 032' : revokeCase ? 'DSHM 输出撤销验收 031' : 'DSHM App 链接验收 019');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    report.fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    assert.equal(await field.count(), 0);
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.pendingWithoutSessionAccess = true;
  } else if (phase === 'forget-revoked') {
    // 只移除独立包内已经失效的测试绑定，不清除日常App或仍有效的授权。
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
    await page.getByRole('button', { name: '连接选项', exact: true }).click();
    await page.getByText('移除本机绑定', { exact: true }).click();
    await page.getByRole('button', { name: '确认移除', exact: true }).click();
    await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).waitFor();
    report.revokedTestBindingRemoved = true;
  } else if (phase === 'pending') {
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    report.fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.pendingWithoutSessionAccess = true;
  } else if (phase === 'connected') {
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    report.ownWorkspaceLoaded = true;
    report.pageUrl = page.url();
    assert.ok(report.pageUrl.startsWith('https://remote.dshm.invalid/'));
    await page.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    const history = page.getByRole('region', { name: '聊天内容', exact: true });
    await history.getByRole('article', { name: '模型回复' }).first().waitFor();
    report.testChat = await page.getByTestId('remote-workspace').locator('.remote-heading strong').innerText();
    assert.equal(report.testChat, 'DSHM Remote 联调提示');
    report.assistantMessages = await history.getByRole('article', { name: '模型回复' }).count();
    assert.ok(report.assistantMessages > 0);
  } else {
    await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.revokedWorkspaceRemoved = true;
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.reconnectRejected = true;
  }
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `artifacts/${artifact}-${phase}-android.png` });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/${artifact}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
