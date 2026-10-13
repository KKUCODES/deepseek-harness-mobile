// App 安装记录已丢失后的原页面重配对；不清除数据、不创建会话、不读取 Key。
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2]; assert.ok(['claim', 'connect', 'inspect'].includes(phase));
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
const child = relative(resolve(runtime, 'live-homes'), state.home); assert.match(child, /^[0-9a-f-]{36}$/);
assert.equal(await realpath(state.home), resolve(await realpath(resolve(runtime, 'live-homes')), child));
assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(state.ready, true);
const pkg = 'dev.dshmobile.validation.latesttest';
const reportFile = resolve(runtime, 'latest-live-binding-recovery-' + phase + '.json');
const report = { at: new Date().toISOString(), home: state.home, packageName: pkg, phase, passed: false };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
try {
  const root = await (await androidAppWebView(device, pkg)).page();
  const page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page);
  if (phase === 'claim') {
    await page.getByRole('heading', { name: '连接你的电脑', exact: true }).waitFor();
    const pairing = JSON.parse(await readFile(resolve(state.home, 'private-pair.json'), 'utf8'));
    assert.equal(new URL(pairing.link).origin, state.origin);
    assert.match(new URLSearchParams(new URL(pairing.link).hash.slice(1)).get('key'), /^[A-Za-z0-9_-]{43}$/);
    await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).fill(pairing.link);
    await page.getByRole('textbox', { name: '设备名称', exact: true }).fill('DSHM latest model validation');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    report.fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    assert.match(report.fingerprint, /^[A-Za-z0-9_-]{43}$/);
  } else {
    const claim = JSON.parse(await readFile(resolve(runtime, 'latest-live-binding-recovery-claim.json'), 'utf8'));
    assert.equal(claim.home, state.home); assert.equal(claim.passed, true);
    report.fingerprint = claim.fingerprint;
    if (phase === 'connect') {
      assert.equal(await page.getByTestId('remote-fingerprint').innerText(), claim.fingerprint);
      await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    }
    const main = page.getByTestId('remote-workspace'); await main.waitFor();
    report.sessionTitles = await main.locator('button.remote-session-row').allTextContents();
    assert.ok(report.sessionTitles.some(title => title.includes('DSHM 新版手机真实模型验收')));
    assert.ok(report.sessionTitles.some(title => title.includes('DSHM 新版 PTC 取消验收')));
    assert.equal(await page.locator('iframe').count(), 0);
    report.originalSessionsListed = true;
    await writeFile(resolve(runtime, 'latest-live-reinstalled-remote.png'), await device.screenshot());
  }
  report.passed = true;
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed' }; process.exitCode = 1;
} finally {
  await writeFile(reportFile, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
