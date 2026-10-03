import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

// 独立包撤销，日常绑定只核验；发送前落盘，观察超时不能再次发送。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['prepare', 'send', 'inspect', 'revoke', 'cleanup', 'restored'].includes(phase));
const prefix = 'artifacts/foreground-output-revocation';
const seedPath = `${prefix}-seed.json`;
const pkg = 'dev.dshmobile.validation.pairingtest';
const dailyPkg = 'dev.dshmobile.validation';
const fingerprint = 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE';
const api = await localDesktopManagement();
const report = { at: new Date().toISOString(), phase, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
let seed, page;
const control = async action => {
  const r = await fetch(`http://127.0.0.1:18794/${action}`, { method: action === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(r.ok); return r.json();
};
const save = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const pairing = (action, input = '') => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/verify-remote-pair-valid-android.mjs', action], {
    cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'],
    env: { ...process.env, DSHM_PAIR_CASE: 'foreground-output-revocation' },
  });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(`Pairing ${action} failed; inspect scoped report`)));
  child.stdin.end(input);
});
const remote = async app => {
  const first = await (await androidAppWebView(device, app)).page();
  let result = first.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!result) {
    const ordinary = first.context().pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const next = first.context().waitForEvent('page', { predicate: p => p.url().startsWith('https://remote.dshm.invalid/') });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); result = await next;
  }
  result.setDefaultTimeout(20000); return result;
};
try {
  const daily = (await api()).devices.filter(d => d.fingerprint === fingerprint);
  assert.equal(daily.length, 1); assert.equal(daily[0].status, 'active'); assert.equal(daily[0].management, false);
  if (phase === 'prepare') {
    try {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      assert.equal(seed.testId, undefined); assert.equal(seed.attempted, undefined);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      seed = { dailyId: daily[0].id, marker: `DSHM_REVOKE_${Date.now()}`, original: 'DSHM Remote 联调提示' };
      await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    }
    const dailyPage = await remote(dailyPkg);
    assert.equal(await dailyPage.getByTestId('remote-workspace').locator('.remote-heading strong').innerText(), seed.original);
    assert.equal(await dailyPage.getByRole('textbox', { name: '消息', exact: true }).innerText(), '');
    assert.equal(await dailyPage.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    await device.shell(`am force-stop ${dailyPkg}`);
    assert.equal((await device.shell(`pidof ${dailyPkg}`)).toString().trim(), '');
    const ids = new Set((await api()).devices.map(d => d.id));
    const link = new URL((await api({ action: 'pair' })).link);
    assert.equal(link.origin, 'http://127.0.0.1:8787'); assert.equal(link.pathname, '/pair');
    await pairing('claim', `dshm://pair?server=${encodeURIComponent(link.origin)}${link.hash}`);
    const claim = JSON.parse(await readFile(`${prefix}-pair-claim-android.json`, 'utf8'));
    const matches = (await api()).devices.filter(d => !ids.has(d.id) && d.fingerprint === claim.fingerprint && d.name === 'DSHM 前台输出撤销验收 039');
    assert.equal(matches.length, 1); assert.equal(matches[0].status, 'pending');
    seed.testId = matches[0].id; seed.testFingerprint = matches[0].fingerprint; await save();
    assert.notEqual(seed.testFingerprint, fingerprint);
    await api({ action: 'approve', deviceId: seed.testId }); await pairing('connected');
    report.prepared = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.dailyId, daily[0].id); assert.notEqual(seed.testFingerprint, fingerprint);
    assert.equal((await api()).devices.find(d => d.id === seed.testId)?.fingerprint, seed.testFingerprint);
    if (phase === 'restored') {
      assert.equal(seed.cleaned, true);
      page = await remote(dailyPkg); page.on('pageerror', e => report.errors.push(e.message));
      const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
      if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
        await main.locator('button.remote-session-row').filter({ hasText: seed.original }).click();
      }
      await main.locator('.remote-heading strong').getByText(seed.original, { exact: true }).waitFor();
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
      await main.getByRole('region', { name: '聊天内容', exact: true }).getByText('DSHM_REVOKE_DONE', { exact: true }).waitFor();
      assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '');
      report.dailyEntryRestored = true; report.draftPreserved = true; report.requestSettled = true;
      await page.screenshot({ path: `${prefix}-restored.png` });
    } else if (phase === 'cleanup') {
      await control('resume');
      const current = (await api()).devices.find(d => d.id === seed.testId);
      if (current.status !== 'revoked') await api({ action: 'revoke', deviceId: seed.testId });
      report.testRevoked = (await api()).devices.find(d => d.id === seed.testId)?.status === 'revoked';
      assert.equal(report.testRevoked, true);
      await pairing('forget-revoked');
      seed.cleaned = true; await save();
    } else {
      page = await remote(pkg); page.on('pageerror', e => report.errors.push(e.message));
      const main = page.getByTestId('remote-workspace');
      assert.equal(await main.locator('.remote-heading strong').innerText(), seed.original);
      const editor = main.getByRole('textbox', { name: '消息', exact: true });
      if (phase === 'send') {
        assert.equal(seed.attempted, undefined); assert.equal(await editor.innerText(), '');
        seed.command = `[Console]::WriteLine('${seed.marker}_OUT'); [Console]::Error.WriteLine('${seed.marker}_ERR'); Start-Sleep -Seconds 35; [Console]::WriteLine('${seed.marker}_END')`;
        await editor.fill(`这是DSHM前台输出撤销联调。只调用一次pwsh，command精确为：${seed.command}。run_in_background=false，timeoutMs=60000，description=DSHM_REVOKE_OUTPUT。只输出固定标记、等待和退出；不读写文件、不访问网络、不调用其他工具、不重试、不修改权限。完成后只回复 DSHM_REVOKE_DONE。`);
        seed.attempted = true; await save();
        await main.getByRole('button', { name: '发送消息', exact: true }).click();
        seed.sent = true; await save(); report.sent = true;
      } else {
        assert.equal(seed.attempted, true);
        const call = main.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="pwsh"]') }).filter({ hasText: 'DSHM_REVOKE_OUTPUT' }).last();
        await call.waitFor({ timeout: 50000 });
        const disclosure = call.locator('[data-disclosure-row][aria-expanded="false"]').first();
        if (await disclosure.count()) await disclosure.click();
        report.callId = await call.getAttribute('data-chat-call-id');
        report.toolText = await call.innerText();
        assert.ok(report.toolText.includes(seed.marker), '展开原工具后核对本次唯一命令标记');
        report.buttons = await call.getByRole('button').allTextContents();
        const pending = page.locator('[data-approval-key]');
        if (await pending.count()) {
          assert.equal(await pending.count(), 1); assert.equal(seed.approved, undefined);
          assert.match(await pending.innerText(), /pwsh/i);
          assert.ok(report.toolText.includes(seed.command));
          seed.approved = true; await save(); await pending.getByRole('button', { name: '允许一次', exact: true }).click();
        }
        if (phase === 'revoke') {
          const details = page.getByRole('dialog', { name: '命令详情', exact: true });
          if (!await details.count()) await call.getByRole('button', { name: '查看', exact: true }).click();
          const output = details.getByLabel('独立命令输出', { exact: true });
          // 原只读沙箱禁止 Console 类型调用；用真实 stderr 验证，不提升权限或重发。
          assert.match(report.toolText, /InvalidOperation/);
          await details.getByRole('button', { name: '错误输出', exact: true }).click();
          await output.filter({ hasText: 'InvalidOperation' }).waitFor();
          report.stderrRead = true;
          assert.equal((await device.shell(`pidof ${dailyPkg}`)).toString().trim(), '');
          const before = await control('stats'); assert.ok(before.devices >= 1 && before.devices <= 2); assert.equal(before.heldBytes, 0);
          await control('pause');
          await details.getByRole('button', { name: '标准输出', exact: true }).click();
          const until = Date.now() + 10000;
          while (!(report.held = await control('stats')).heldOutputResults) {
            assert.ok(Date.now() < until, 'Actual output response not observed'); await new Promise(r => setTimeout(r, 100));
          }
          await details.getByRole('status').filter({ hasText: '正在读取' }).waitFor();
          await page.screenshot({ path: `${prefix}-held.png` });
          await api({ action: 'revoke', deviceId: seed.testId });
          await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor();
          assert.equal(await main.count(), 0); assert.equal(await details.count(), 0);
          report.revoked = await control('stats'); assert.equal(report.revoked.heldBytes, 0);
          assert.ok(report.revoked.droppedBytes >= report.held.heldBytes);
          await control('resume');
          await page.getByRole('button', { name: '重新连接', exact: true }).click();
          await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
          assert.equal(await main.count(), 0); assert.equal(await details.count(), 0);
          report.workspaceRemoved = true; report.reconnectRejected = true;
          await page.screenshot({ path: `${prefix}-revoked.png` }); seed.verified = true; await save();
        }
      }
    }
  }
  const after = (await api()).devices.find(d => d.id === seed.dailyId);
  assert.equal(after.status, 'active'); assert.equal(after.management, false); report.dailyAuthorizationPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`${prefix}-${phase}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
