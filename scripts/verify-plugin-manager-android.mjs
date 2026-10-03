import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { verifyApplyingCancellation } from './verify-plugin-applying-android.mjs';
import { verifyPluginWorker } from './verify-plugin-worker-android.mjs';

const phase = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'denied', 'verify', 'install', 'cleanup', 'config-inspect', 'config-write', 'config-restore', 'subagent-inspect', 'subagent-write', 'subagent-restore', 'subagent-model-write', 'subagent-model-restore', 'search-inspect', 'search-write', 'search-restore', 'component-off', 'component-on', 'install-failure', 'install-cancel', 'install-long', 'script-approval', 'script-cancel', 'install-revoked', 'install-restart', 'install-applying', 'worker-lifecycle'].includes(phase));
if (phase.startsWith('subagent-model-')) assert.equal(process.env.DSHM_RUN_LIVE, '1');
if (['script-approval', 'script-cancel', 'install-revoked', 'install-restart', 'install-applying', 'worker-lifecycle'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
if (phase.startsWith('component-') || phase === 'install-failure' || phase === 'install-cancel' || phase === 'install-long') assert.equal(process.env.DSHM_RUN_LIVE, '1');
if (phase.startsWith('search-')) assert.equal(process.env.DSHM_RUN_LIVE, '1');
if (['install', 'cleanup', 'config-write', 'config-restore', 'subagent-write', 'subagent-restore'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const ordinary = await (await androidAppWebView(device)).page();
  const phone = ordinary.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone);
  await phone.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await phone.getByRole('button', { name: 'Remote', exact: true }).click();
  const deadline = Date.now() + 30000;
  while (!page && Date.now() < deadline) {
    page = ordinary.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  if (await page.getByRole('button', { name: '重新连接', exact: true }).count()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor();
  const dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  if (!await manager.count()) {
    if (!await dialog.count()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    }
    await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
  }
  await manager.waitFor();
  if (phase === 'denied') {
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await manager.locator('[data-plugin-panel]').count(), 0);
    report.managementRequired = true;
  } else if (phase === 'worker-lifecycle') {
    await verifyPluginWorker({ page, manager, dialog, report });
  } else if (phase === 'install-applying') {
    await verifyApplyingCancellation({ page, manager, dialog, report });
  } else if (phase === 'install-restart') {
    const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
    const hashes = async () => Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name =>
      [name, createHash('sha256').update(await readFile(join(profile, name))).digest('hex')])));
    const before = await hashes(), requests = [];
    const server = createServer((request, response) => {
      const item = { path: request.url, closed: false }; requests.push(item);
      response.on('close', () => { item.closed = true; });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const spec = `http://127.0.0.1:${server.address().port}/dshm-restart-${Date.now()}.tgz`;
    try {
      if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null) {
        await manager.getByText('最近插件操作', { exact: true }).click();
      }
      await manager.getByRole('button', { name: '添加插件', exact: true }).click();
      const install = page.getByRole('dialog');
      await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
      await install.getByRole('button', { name: '安装', exact: true }).click();
      const by = Date.now() + 30000;
      while (!requests.length && Date.now() < by) await new Promise(resolve => setTimeout(resolve, 100));
      assert.ok(requests.length);
      report.spec = spec; report.downloadStarted = true;
      await writeFile('artifacts/plugin-manager-install-restart-seed.json', JSON.stringify({ spec, before, at: new Date().toISOString() }));
      const pageStartedAt = await page.evaluate(() => performance.timeOrigin);
      console.log(`DSHM_INSTALL_RESTART_READY ${spec}`);
      await manager.getByText('电脑连接已断开，重新连接后可继续操作。', { exact: true }).first().waitFor({ timeout: 120000 });
      report.disconnected = true;
      // 电脑换代可能重建客户端并关闭管理页；沿同一 WebView 重开，不能重启 Activity 清掉内存摘要。
      await page.getByText('已连接电脑', { exact: true }).waitFor({ timeout: 120000 });
      if (!await manager.count()) {
        await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '电脑插件', exact: true }).click();
        await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
      }
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor({ timeout: 120000 });
      if (await manager.locator('.remote-plugin-operations').getAttribute('open') === null) {
        await manager.getByText('最近插件操作', { exact: true }).click();
      }
      await manager.getByRole('button', { name: '刷新操作记录', exact: true }).click();
      // 重启清空电脑回执后，手机仍需把本次结果未知显示给用户，不能静默丢弃。
      await manager.locator('[data-operation-state="unknown"]').filter({ hasText: spec }).waitFor();
      report.unknownOutcomeVisible = true;
      assert.equal(await page.evaluate(() => performance.timeOrigin), pageStartedAt);
      report.sameWebView = true;
      assert.deepEqual(await hashes(), before);
      report.profileUnchanged = true;
      report.requests = requests;
      assert.ok(requests.every(item => item.closed), '旧安装进程退出后下载连接应关闭');
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } else if (phase === 'install-revoked') {
    const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
    const hashes = async () => Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name =>
      [name, createHash('sha256').update(await readFile(join(profile, name))).digest('hex')])));
    // 合法归档让pnpm正常结束，再由原manager拒绝非bundle；损坏远程tgz会触发pnpm下载重试。
    const before = await hashes(), invalid = await readFile('artifacts/dsh-mobile-non-bundle-verification-0.0.1.tgz');
    const responses = []; let released = false, requests = 0;
    const send = response => { response.writeHead(200, { 'content-type': 'application/octet-stream' }); response.end(invalid); };
    const server = createServer((_request, response) => { requests++; responses.push(response); if (released) send(response); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const spec = `http://127.0.0.1:${server.address().port}/dshm-revoked-${Date.now()}.tgz`;
    const openManager = async () => {
      await page.getByTestId('remote-workspace').waitFor();
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    };
    try {
      await manager.getByText('最近插件操作', { exact: true }).waitFor();
      await manager.getByRole('button', { name: '添加插件', exact: true }).click();
      const install = page.getByRole('dialog');
      await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
      await install.getByRole('button', { name: '安装', exact: true }).click();
      const by = Date.now() + 30000;
      while (!requests && Date.now() < by) await new Promise(resolve => setTimeout(resolve, 100));
      assert.ok(requests > 0);
      console.log('DSHM_INSTALL_REVOKE_READY: revoke this device management permission now.');
      await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor({ timeout: 120000 });
      assert.equal(await page.locator('[data-plugin-panel], .remote-plugin-operations, [data-install-phase]').count(), 0);
      report.managementUiDisposed = true;
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await openManager();
      await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
      assert.equal(await manager.locator('[data-plugin-panel], .remote-plugin-operations').count(), 0);
      report.basicConnectionDenied = true;
      await page.screenshot({ path: 'artifacts/plugin-manager-install-revoked-denied-android.png' });
      released = true; for (const response of responses) if (!response.destroyed) send(response);
      console.log('DSHM_INSTALL_REGRANT_READY: non-bundle test archive released; restore temporary management to read the original outcome.');
      await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor({ timeout: 120000 });
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await openManager();
      await manager.getByText('最近插件操作', { exact: true }).click();
      const receipt = manager.locator('[data-operation-state="complete"]').filter({ hasText: spec });
      await receipt.getByText('未完成', { exact: true }).waitFor();
      assert.equal(await receipt.count(), 1);
      assert.deepEqual(await hashes(), before);
      report.originalFailureRecovered = true; report.profileUnchanged = true; report.downloadRequests = requests;
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } else if (phase === 'script-cancel') {
    const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
    const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml');
    const name = '@dsh-mobile/script-cancel-verification';
    const spec = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/dsh-mobile-script-cancel-verification-0.0.1.tgz';
    const selector = `${name}@file:${spec}`;
    const policyPath = join(profile, 'pnpm-workspace.yaml');
    const beforePolicy = await readFile(policyPath, 'utf8'), policy = parse(beforePolicy);
    const originals = await Promise.all(['package.json', 'pnpm-lock.yaml'].map(async file => [file, await readFile(join(profile, file), 'utf8')]));
    assert.equal(JSON.parse(originals[0][1]).dependencies?.[name], undefined);
    assert.equal(policy.allowBuilds?.[selector], undefined);
    const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog');
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
    await install.getByRole('button', { name: '安装', exact: true }).click();
    await install.getByRole('button', { name: '允许这些脚本并重试', exact: true }).waitFor({ timeout: 60000 });
    assert.deepEqual(parse(await readFile(policyPath, 'utf8')), { ...policy, allowBuilds: { ...policy.allowBuilds, [selector]: 'set this to true or false' } });
    await install.getByRole('button', { name: '允许这些脚本并重试', exact: true }).click();
    await install.getByRole('button', { name: '查看安装详情', exact: true }).click();
    await install.getByText(/DSHM_CANCEL_SCRIPT_STARTED:\d+/).waitFor({ timeout: 60000 });
    const runningLog = await install.innerText();
    const pid = Number(runningLog.match(/DSHM_CANCEL_SCRIPT_STARTED:(\d+)/)?.[1]);
    assert.ok(pid > 0 && alive(pid), '必须观测到实际安装脚本仍在运行');
    assert.equal(runningLog.includes('DSHM_CANCEL_SCRIPT_FINISHED'), false);
    report.scriptPid = pid; report.scriptObservedRunning = true;
    await page.screenshot({ path: 'artifacts/plugin-manager-script-cancel-running-android.png' });
    await install.getByRole('button', { name: '取消安装', exact: true }).click();
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).waitFor();
    assert.equal(await install.getByRole('textbox', { name: '包名或地址', exact: true }).inputValue(), spec);
    assert.equal(alive(pid), false, '取消确认返回时实际脚本必须退出');
    for (const [file, original] of originals) assert.equal(await readFile(join(profile, file), 'utf8'), original);
    // 批准由原服务持久化，取消不会撤回。仅清理本次测试的来源选择器。
    const afterPolicy = await readFile(policyPath, 'utf8');
    assert.deepEqual(parse(afterPolicy), { ...policy, allowBuilds: { ...policy.allowBuilds, [selector]: true } });
    assert.equal(await readFile(policyPath, 'utf8'), afterPolicy);
    await writeFile(policyPath, beforePolicy);
    await install.getByRole('button', { name: '关闭', exact: true }).click();
    await manager.getByText('最近插件操作', { exact: true }).click();
    await manager.locator('[data-operation-state="complete"]').filter({ hasText: spec }).getByText('已取消', { exact: true }).waitFor();
    report.scriptExitedBeforeConfirmation = true; report.manifestAndLockRestored = true;
    report.testApprovalRemoved = true; report.cancelledReceipt = true;
  } else if (phase === 'script-approval') {
    const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
    const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml');
    const name = '@dsh-mobile/script-approval-verification';
    const spec = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/dsh-mobile-script-approval-verification-0.0.1.tgz';
    const selector = `${name}@file:${spec}`;
    const policyPath = join(profile, 'pnpm-workspace.yaml');
    const beforePolicy = await readFile(policyPath, 'utf8'), policy = parse(beforePolicy);
    assert.equal(policy.allowBuilds?.[name], undefined, '不得覆盖已有脚本决定');
    assert.equal(policy.allowBuilds?.[selector], undefined, '不得覆盖已有来源限定脚本决定');
    const beforeManifest = await readFile(join(profile, 'package.json'), 'utf8');
    assert.equal(JSON.parse(beforeManifest).dependencies?.[name], undefined, '必须使用未安装的专用测试包');
    const beforeLock = parse(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'));
    await manager.getByText('最近插件操作', { exact: true }).waitFor();
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog');
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
    await install.getByRole('button', { name: '安装', exact: true }).click();
    await install.getByRole('button', { name: '允许这些脚本并重试', exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await readFile(join(profile, 'package.json'), 'utf8'), beforeManifest);
    const pendingPolicy = parse(await readFile(policyPath, 'utf8'));
    assert.deepEqual(pendingPolicy, { ...policy, allowBuilds: { ...policy.allowBuilds, [selector]: 'set this to true or false' } });
    assert.ok((await install.innerText()).includes(name));
    assert.equal((await install.innerText()).includes('DSHM_APPROVED_INSTALL_SCRIPT_RAN_20260925'), false);
    report.blockedBeforeApproval = true;
    await page.screenshot({ path: 'artifacts/plugin-manager-script-approval-blocked-android.png' });
    await install.getByRole('button', { name: '允许这些脚本并重试', exact: true }).click();
    await install.getByRole('button', { name: '立即启用', exact: true }).waitFor({ timeout: 60000 });
    assert.deepEqual(parse(await readFile(policyPath, 'utf8')), { ...policy, allowBuilds: { ...policy.allowBuilds, [selector]: true } });
    await install.getByRole('button', { name: '查看安装详情', exact: true }).click();
    assert.ok((await install.innerText()).includes('DSHM_APPROVED_INSTALL_SCRIPT_RAN_20260925'), '只认实际脚本输出，不把保存批准当执行成功');
    assert.ok((await install.innerText()).includes(`已允许运行安装脚本：${selector}`));
    report.approvedScriptExecuted = true;
    await page.screenshot({ path: 'artifacts/plugin-manager-script-approval-done-android.png' });
    await install.getByRole('button', { name: '关闭', exact: true }).click();
    await manager.getByRole('button', { name: '查看 script-approval-verification', exact: true }).click();
    await manager.getByRole('button', { name: '卸载 script-approval-verification', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「script-approval-verification」？', exact: true });
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    await confirm.waitFor({ state: 'detached' });
    await manager.getByRole('button', { name: '查看 plugin', exact: true }).waitFor();
    assert.equal(await manager.getByRole('button', { name: '查看 script-approval-verification', exact: true }).count(), 0);
    assert.deepEqual(JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')), JSON.parse(beforeManifest));
    assert.deepEqual(parse(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8')), beforeLock);
    // 原 manager 明确保留脚本批准。只在配置恰好是原值+本测试包时恢复，拒绝覆盖并发用户修改。
    const afterPolicy = await readFile(policyPath, 'utf8');
    const afterParsed = parse(afterPolicy);
    delete afterParsed.allowBuilds?.[selector];
    if (!policy.allowBuilds && Object.keys(afterParsed.allowBuilds ?? {}).length === 0) delete afterParsed.allowBuilds;
    assert.deepEqual(afterParsed, policy);
    assert.equal(await readFile(policyPath, 'utf8'), afterPolicy);
    await writeFile(policyPath, beforePolicy);
    assert.equal(await readFile(policyPath, 'utf8'), beforePolicy);
    report.testPackageRemoved = true; report.originalProfileRestored = true;
  } else if (phase.startsWith('component-')) {
    if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).count()) await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '查看 partial-ui-verification', exact: true }).click();
    const bundle = manager.getByRole('switch', { name: '启用 partial-ui-verification', exact: true });
    const row = manager.getByRole('switch', { name: '启用组件 dshm-partial-ui-verification', exact: true });
    await row.waitFor(); assert.equal(await bundle.getAttribute('aria-checked'), 'true');
    const enabled = phase === 'component-on';
    assert.equal(await row.getAttribute('aria-checked'), String(!enabled));
    await row.click();
    await page.waitForFunction(enabled => {
      const row = document.querySelector('[aria-label="启用组件 dshm-partial-ui-verification"]');
      return row && row.getAttribute('aria-checked') === String(enabled) && !row.disabled
        || !!document.querySelector('[aria-label="查看 partial-ui-verification"]');
    }, enabled);
    // 兼容未安装增量补丁的旧电脑；严格验收模式禁止用重开详情掩盖状态丢失。
    const reopen = manager.getByRole('button', { name: '查看 partial-ui-verification', exact: true });
    report.navigationReset = await reopen.count() > 0;
    if (process.env.DSHM_EXPECT_INCREMENTAL_PLUGINS === '1') assert.equal(report.navigationReset, false, '组件切换必须保留原详情页实例');
    if (report.navigationReset) await reopen.click();
    await row.waitFor();
    assert.equal(await row.getAttribute('aria-checked'), String(enabled));
    assert.equal(await bundle.getAttribute('aria-checked'), 'true');
    report.bundleRemainsEnabled = true; report.componentEnabled = enabled;
    report.component = await manager.locator('[data-plugin-row]').innerText();
    assert.ok(report.component.includes(enabled ? '运行中' : '已关闭'));
  } else if (phase === 'install-cancel' || phase === 'install-long') {
    if (phase === 'install-long') await manager.getByText('最近插件操作', { exact: true }).waitFor();
    const profile = process.env.DSHM_PROFILE_DIR;
    assert.ok(profile, '明确指定本次 DSH profile，不能猜测用户配置目录');
    const hashes = async () => Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name => {
      try { return [name, createHash('sha256').update(await readFile(join(profile, name))).digest('hex')]; }
      catch (error) { if (error.code === 'ENOENT') return [name, null]; throw error; }
    })));
    const before = await hashes(); assert.ok(before['package.json']);
    // 电脑真实 pnpm 读取此地址；不发送任何包字节，让取消发生在可确定的下载阶段。
    // 不改 registry、不执行安装脚本，finally 会关闭本地服务及所有挂起连接。
    const requests = [];
    const server = createServer((request, response) => {
      const observed = { path: request.url, closed: false };
      requests.push(observed); response.on('close', () => { observed.closed = true; });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      report.cancellations = [];
      for (const closeAfter of [false, true]) {
        if (!await page.getByRole('dialog', { name: '添加插件', exact: true }).count()) await manager.getByRole('button', { name: '添加插件', exact: true }).click();
        const install = page.getByRole('dialog');
        const path = `/dshm-cancel-${closeAfter ? 'close' : 'edit'}-${Date.now()}.tgz`;
        const spec = `http://127.0.0.1:${server.address().port}${path}`;
        await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec);
        await install.getByRole('button', { name: '安装', exact: true }).click();
        const receivedBy = Date.now() + 30000;
        while (!requests.some(item => item.path === path) && Date.now() < receivedBy) await new Promise(resolve => setTimeout(resolve, 100));
        assert.ok(requests.some(item => item.path === path), '必须先观测到真实 pnpm 下载，不能只取消前置检查');
        const beganAt = Date.now();
        if (phase === 'install-long' && !closeAfter) {
          console.log('DSHM_LONG_INSTALL_STARTED: holding for 45 seconds; gateway may reconnect during this interval.');
          await new Promise(resolve => setTimeout(resolve, 45000));
          await install.locator('[data-install-phase="running"]').waitFor();
          report.longInstallMs = Date.now() - beganAt;
          assert.ok(report.longInstallMs > 35000);
          await page.screenshot({ path: 'artifacts/plugin-manager-install-long-running-android.png' });
        }
        if (phase === 'install-long' && closeAfter) {
          // 重建实际 WebView 页面，丢弃原组件内存状态后只从电脑查询回执。
          await page.reload();
          await page.getByTestId('remote-workspace').waitFor();
          await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
          await page.getByRole('button', { name: '电脑插件', exact: true }).click();
          await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
          await manager.getByText('最近插件操作', { exact: true }).click();
          const pending = manager.locator('[data-operation-state="pending"]').filter({ hasText: spec });
          await pending.waitFor();
          assert.equal(await pending.count(), 1);
          await pending.getByRole('button', { name: '取消此次安装', exact: true }).click();
          await manager.locator('[data-operation-state="complete"]').filter({ hasText: spec }).getByText('已取消', { exact: true }).waitFor();
          report.reloadedReceiptCancelled = true;
        } else await install.getByRole('button', { name: closeAfter ? '取消安装并关闭' : '取消安装', exact: true }).click();
        if (closeAfter) await install.waitFor({ state: 'detached' });
        else {
          await install.getByRole('textbox', { name: '包名或地址', exact: true }).waitFor();
          assert.equal(await install.getByRole('textbox', { name: '包名或地址', exact: true }).inputValue(), spec);
          assert.equal(await install.getByRole('button', { name: '安装', exact: true }).isEnabled(), true);
        }
        const endedBy = Date.now() + 10000;
        while (requests.some(item => item.path === path && !item.closed) && Date.now() < endedBy) await new Promise(resolve => setTimeout(resolve, 100));
        assert.ok(requests.filter(item => item.path === path).every(item => item.closed), '取消确认后下载连接必须退出');
        assert.deepEqual(await hashes(), before, '取消确认后原包清单、锁文件和脚本批准配置应保持不变');
        report.cancellations.push({ closeAfter, downloadStarted: true, downloadStopped: true, profileUnchanged: true });
        if (phase === 'install-long' && !closeAfter) await install.getByRole('button', { name: '关闭', exact: true }).click();
      }
    } finally {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
    await manager.getByRole('button', { name: '刷新', exact: true }).click();
    await manager.getByRole('button', { name: '查看 plugin', exact: true }).waitFor();
  } else if (phase === 'install-failure') {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog');
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill('Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/tests/fixtures/invalid-plugin.tgz');
    await install.getByRole('button', { name: '安装', exact: true }).click();
    await install.getByRole('button', { name: '重试', exact: true }).waitFor({ timeout: 60000 });
    report.installFailure = await install.innerText();
    assert.ok(!report.installFailure.includes('立即启用'));
    await install.getByRole('button', { name: '查看安装详情', exact: true }).click();
    report.failureDetails = await install.innerText();
    await page.screenshot({ path: 'artifacts/plugin-manager-install-failure-details-android.png' });
    await install.getByRole('button', { name: '返回编辑', exact: true }).click();
    assert.equal(await install.getByRole('textbox', { name: '包名或地址', exact: true }).inputValue(), 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/tests/fixtures/invalid-plugin.tgz');
    await install.getByRole('button', { name: '关闭', exact: true }).click();
    await install.waitFor({ state: 'detached' }); report.failedInstallClosed = true;
    await manager.getByRole('button', { name: '刷新', exact: true }).click();
    await manager.getByRole('button', { name: '查看 plugin', exact: true }).waitFor();
    report.packages = await manager.locator('[data-plugin-package]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-plugin-package')));
  } else if (phase.startsWith('search-')) {
    if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).count()) await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '查看 网页搜索', exact: true }).click();
    const maxUses = manager.locator('#plugin-config-web-search-max-uses');
    await maxUses.waitFor();
    await page.waitForFunction(() => !document.getElementById('plugin-config-web-search-max-uses')?.disabled);
    const values = () => maxUses.evaluate(node => ({ value: node.value,
      overridden: [...node.parentElement.querySelectorAll('button')].some(button => button.textContent === '恢复默认') }));
    report.before = await values();
    const save = manager.getByRole('button', { name: '保存', exact: true });
    if (phase === 'search-write' || phase === 'search-restore') {
      let expected;
      if (phase === 'search-write') {
        assert.ok(Number.isSafeInteger(Number(report.before.value)) && Number(report.before.value) > 0);
        await writeFile('artifacts/search-settings-live-baseline.json', JSON.stringify(report.before));
        expected = { value: String(Number(report.before.value) + 1), overridden: true };
        await maxUses.fill(expected.value);
      } else {
        expected = JSON.parse(await readFile('artifacts/search-settings-live-baseline.json', 'utf8'));
        if (expected.overridden) await maxUses.fill(expected.value);
        else await maxUses.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
      }
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(expected => document.getElementById('plugin-config-web-search-max-uses')?.value === expected && !document.getElementById('plugin-config-web-search-max-uses')?.disabled, expected.value);
      assert.deepEqual(await values(), expected); report.savedAndReread = true;
    } else {
      const endpoint = manager.getByRole('region', { name: '电脑网页搜索服务地址', exact: true });
      await endpoint.getByText('当前站点：', { exact: false }).waitFor();
      report.endpoint = await endpoint.innerText();
      await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill('https://search.example.invalid/anthropic/v1');
      await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
      await endpoint.getByRole('group', { name: '确认服务地址', exact: true }).waitFor();
      await endpoint.getByRole('button', { name: '取消更改地址', exact: true }).click();
      report.endpointDraftCancelled = true;
      const key = manager.getByRole('region', { name: '电脑网页搜索 Key', exact: true });
      await key.getByText(/^(已配置|尚未配置)$/).waitFor();
      report.keyConfigured = await key.getByText('已配置', { exact: true }).count() === 1;
      assert.equal(await manager.locator('input[type="password"]').count(), 0);
      const configure = key.getByRole('button', { name: '管理电脑 Key', exact: true });
      report.keyWritable = await configure.isEnabled();
      if (report.keyWritable) {
        await configure.click();
        try {
          await device.shell('uiautomator dump /data/local/tmp/dshm-search-key-check.xml');
          const xml = (await device.shell('cat /data/local/tmp/dshm-search-key-check.xml')).toString();
          assert.ok(xml.includes('电脑网页搜索 Key') && xml.includes('password="true"'));
          const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
          const cancel = nodes.filter(node => node.package === 'dev.dshmobile.validation' && node.class === 'android.widget.Button' && node.text === '取消');
          assert.equal(cancel.length, 1);
          const points = cancel[0].bounds.match(/\d+/g).map(Number);
          await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`);
        } catch (error) { await device.shell('input keyevent 4'); throw error; }
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '管理电脑 Key' && !node.disabled));
        assert.equal(await key.getByText('已配置', { exact: true }).count() === 1, report.keyConfigured);
        report.nativeKeyCancelled = true;
      }
    }
    report.after = await values();
  } else if (phase.startsWith('subagent-')) {
    if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).count()) await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '查看 Subagent', exact: true }).click();
    const depth = manager.getByRole('textbox', { name: '最大递归深度', exact: true });
    const toggle = manager.getByRole('switch', { name: '允许 Agent 为 Subagent 选择模型', exact: true });
    await depth.waitFor(); await toggle.waitFor();
    await page.waitForFunction(() => !document.getElementById('plugin-config-subagent-depth')?.disabled);
    const values = () => manager.locator('input[type="text"]').evaluateAll(nodes => nodes.map(node => ({ id: node.id, value: node.value,
      overridden: [...node.parentElement.querySelectorAll('button')].some(button => button.textContent === '恢复默认') })));
    report.before = await values(); report.modelSelection = await toggle.getAttribute('aria-checked');
    const save = manager.getByRole('button', { name: '保存', exact: true });
    const resetModels = manager.getByRole('button', { name: '恢复模型选择默认设置', exact: true });
    if (phase === 'subagent-model-write') {
      // 仅在原来完全继承、开关关闭时运行，以便准确恢复，不覆盖用户自定义选择。
      assert.equal(report.modelSelection, 'false');
      assert.equal(await resetModels.count(), 0);
      await toggle.click();
      const choices = manager.getByRole('checkbox'); await choices.first().waitFor();
      assert.deepEqual(await choices.evaluateAll(nodes => nodes.map(node => node.checked)), Array(await choices.count()).fill(false));
      report.selectedModel = await choices.first().locator('..').innerText();
      await writeFile('artifacts/subagent-model-live-baseline.json', JSON.stringify({ limits: report.before, inherited: true, enabled: false, selectedModel: report.selectedModel }, null, 2));
      await choices.first().check(); await save.click();
      await resetModels.waitFor();
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(() => !document.getElementById('plugin-config-subagent-depth')?.disabled);
      assert.equal(await toggle.getAttribute('aria-checked'), 'true');
      assert.equal(await choices.first().isChecked(), true);
      assert.equal(await choices.first().locator('..').innerText(), report.selectedModel);
      assert.deepEqual(await values(), report.before);
      report.savedAndReread = true;
    } else if (phase === 'subagent-model-restore') {
      const baseline = JSON.parse(await readFile('artifacts/subagent-model-live-baseline.json', 'utf8'));
      assert.equal(baseline.inherited, true); assert.equal(report.modelSelection, 'true');
      assert.equal(await manager.getByRole('checkbox').first().locator('..').innerText(), baseline.selectedModel);
      assert.equal(await manager.getByRole('checkbox').first().isChecked(), true);
      await resetModels.click();
      const confirmation = manager.getByRole('group', { name: '恢复模型选择默认设置', exact: true });
      await page.screenshot({ path: 'artifacts/subagent-model-reset-confirm-android.png' });
      await confirmation.getByRole('button', { name: '取消', exact: true }).click();
      assert.equal(await toggle.getAttribute('aria-checked'), 'true');
      await resetModels.click(); await confirmation.getByRole('button', { name: '确认恢复默认', exact: true }).click();
      await resetModels.waitFor({ state: 'detached' });
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(() => !document.getElementById('plugin-config-subagent-depth')?.disabled);
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      assert.equal(await resetModels.count(), 0);
      assert.deepEqual(await values(), baseline.limits);
      // 检查继承的模型列表仍为空，只打开草稿后丢弃，不再写入。
      await toggle.click();
      await manager.getByRole('checkbox').first().waitFor();
      assert.deepEqual(await manager.getByRole('checkbox').evaluateAll(nodes => nodes.map(node => node.checked)), Array(await manager.getByRole('checkbox').count()).fill(false));
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(() => !document.getElementById('plugin-config-subagent-depth')?.disabled);
      report.restoredInheritance = true;
    } else if (phase === 'subagent-write') {
      const original = report.before.find(field => field.id === 'plugin-config-subagent-depth');
      assert.ok(original && Number.isSafeInteger(Number(original.value)));
      await writeFile('artifacts/subagent-settings-live-baseline.json', JSON.stringify(report.before, null, 2));
      await depth.fill(String(Number(original.value) + 1)); await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(expected => document.getElementById('plugin-config-subagent-depth')?.value === expected && !document.getElementById('plugin-config-subagent-depth')?.disabled, String(Number(original.value) + 1));
      report.savedAndReread = true;
    } else if (phase === 'subagent-restore') {
      const original = JSON.parse(await readFile('artifacts/subagent-settings-live-baseline.json', 'utf8')).find(field => field.id === 'plugin-config-subagent-depth');
      if (original.overridden) await depth.fill(original.value);
      else await depth.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(expected => document.getElementById('plugin-config-subagent-depth')?.value === expected && !document.getElementById('plugin-config-subagent-depth')?.disabled, original.value);
      assert.deepEqual((await values()).find(field => field.id === original.id), original);
      report.restoredInheritance = true;
    } else {
      // 只编辑模型草稿再丢弃，不改变真实会话的模型选择授权。
      assert.equal(report.modelSelection, 'false');
      await toggle.click();
      await manager.getByRole('checkbox').first().waitFor();
      report.candidates = await manager.getByRole('checkbox').evaluateAll(nodes => nodes.map(node => node.parentElement.innerText));
      await manager.getByRole('checkbox').first().check();
      assert.equal(await save.isEnabled(), true);
      await page.screenshot({ path: 'artifacts/plugin-manager-subagent-model-draft-android.png' });
      await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
      await manager.getByRole('button', { name: '查看 Subagent', exact: true }).click();
      await toggle.waitFor();
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      report.modelDraftDiscarded = true;
    }
    report.after = await values();
    assert.equal(await toggle.getAttribute('aria-checked'), phase === 'subagent-model-write' ? 'true' : phase === 'subagent-model-restore' ? 'false' : report.modelSelection);
  } else if (phase.startsWith('config-')) {
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).count()) await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '查看 终端', exact: true }).click();
    const timeout = manager.getByRole('textbox', { name: '命令超时（毫秒）', exact: true });
    await timeout.waitFor();
    await page.waitForFunction(() => !document.getElementById('plugin-config-bash-timeout')?.disabled);
    const values = () => manager.locator('input').evaluateAll(nodes => nodes.map(node => ({ id: node.id, value: node.value,
      overridden: [...node.parentElement.querySelectorAll('button')].some(button => button.textContent === '恢复默认') })));
    report.before = await values();
    const save = manager.getByRole('button', { name: '保存', exact: true });
    if (phase === 'config-write') {
      await writeFile('artifacts/plugin-settings-live-baseline.json', JSON.stringify(report.before, null, 2));
      const original = report.before.find(field => field.id === 'plugin-config-bash-timeout');
      assert.ok(Number.isFinite(Number(original.value)) && Number(original.value) > 0);
      await timeout.fill(String(Number(original.value) + 1));
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
      assert.equal(await manager.getByText('设置未能保存。', { exact: true }).count(), 0);
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(expected => document.getElementById('plugin-config-bash-timeout')?.value === expected && !document.getElementById('plugin-config-bash-timeout')?.disabled, String(Number(original.value) + 1));
      report.savedAndReread = true;
    } else if (phase === 'config-restore') {
      const original = JSON.parse(await readFile('artifacts/plugin-settings-live-baseline.json', 'utf8')).find(field => field.id === 'plugin-config-bash-timeout');
      if (original.overridden) await timeout.fill(original.value);
      else await timeout.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
      await save.click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
      await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
      await page.waitForFunction(expected => document.getElementById('plugin-config-bash-timeout')?.value === expected && !document.getElementById('plugin-config-bash-timeout')?.disabled, original.value);
      const restored = (await values()).find(field => field.id === original.id);
      assert.deepEqual(restored, original); report.restoredInheritance = true;
    }
    report.after = await values();
    await page.screenshot({ path: `artifacts/plugin-manager-${phase}-terminal-android.png` });
    await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '查看 Agent 循环', exact: true }).click();
    await manager.getByRole('textbox', { name: '并行工具调用数', exact: true }).waitFor();
    report.agentLoop = await manager.getByRole('textbox', { name: '并行工具调用数', exact: true }).inputValue();
  } else if (phase === 'install' || phase === 'cleanup') {
    const id = '@dsh-mobile/partial-ui-verification';
    if (phase === 'install') {
      assert.equal(await manager.locator(`[data-plugin-package="${id}"]`).count(), 0, 'Test package must start absent');
      await manager.getByRole('button', { name: '添加插件', exact: true }).click();
      const install = page.getByRole('dialog', { name: '添加插件', exact: true });
      await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill('Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/dsh-mobile-partial-ui-verification-0.0.2.tgz');
      await install.getByRole('button', { name: '安装', exact: true }).click();
      const enable = page.getByRole('button', { name: '立即启用', exact: true });
      await enable.waitFor({ timeout: 60000 });
      await enable.click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      report.installedThroughPhone = true;
    }
    const card = manager.locator(`[data-plugin-package="${id}"]`);
    await card.waitFor();
    await card.getByRole('button', { name: '查看 partial-ui-verification', exact: true }).click();
    const enabled = manager.getByRole('switch', { name: '启用 partial-ui-verification', exact: true });
    if (phase === 'install') {
      await enabled.waitFor();
      // 原控制器先关闭安装弹窗，随后完成启用并重读清单；不能把中间旧值判为失败。
      await page.waitForFunction(() => {
        const row = document.querySelector('[aria-label="启用 partial-ui-verification"]');
        return row?.getAttribute('aria-checked') === 'true' && !row.disabled;
      });
      assert.equal(await enabled.getAttribute('aria-checked'), 'true');
      await enabled.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="启用 partial-ui-verification"]')?.getAttribute('aria-checked') === 'false');
      await enabled.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="启用 partial-ui-verification"]')?.getAttribute('aria-checked') === 'true');
      report.toggledOffAndOn = true;
    } else {
      await manager.getByRole('button', { name: '卸载 partial-ui-verification', exact: true }).click();
      const confirm = page.getByRole('dialog', { name: '卸载「partial-ui-verification」？', exact: true });
      await confirm.getByRole('button', { name: '卸载', exact: true }).click();
      await confirm.waitFor({ state: 'detached' });
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
      await manager.getByRole('button', { name: '查看 plugin', exact: true }).waitFor();
      await card.waitFor({ state: 'detached' }); report.uninstalledThroughPhone = true;
    }
  } else if (phase === 'verify') {
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog', { name: '添加插件', exact: true });
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill('DSHM_CANCEL_ONLY');
    await install.getByRole('button', { name: '关闭', exact: true }).click();
    await install.waitFor({ state: 'detached' });
    report.installDialogEditableAndCancelled = true;
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    await install.waitFor(); await device.shell('input keyevent 4');
    await install.waitFor({ state: 'detached' });
    await manager.waitFor(); report.androidBackClosesDialogFirst = true;
    report.desktopRootNotLoaded = await page.locator('iframe').count() === 0 && await page.getByTestId('remote-workspace').count() === 1;
  }
  report.body = (await manager.innerText()).slice(0, 2200);
  report.geometry = await manager.evaluate(node => [...node.querySelectorAll('[data-plugin-frame], [data-plugin-frame] > div, [data-plugin-panel]')].map(item => ({ tag: item.tagName, width: item.clientWidth, scrollWidth: item.scrollWidth, scrollLeft: item.scrollLeft, left: item.getBoundingClientRect().left, displayed: item.getBoundingClientRect().width, transform: getComputedStyle(item).transform })));
  assert.ok(report.geometry.every(item => item.left >= -1), 'Plugin content must not be clipped at the left edge');
  await page.screenshot({ path: `artifacts/plugin-manager-${phase}-android.png` });
  if (phase !== 'inspect') {
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(node => node.inert), false);
    report.returned = true;
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) report.body = (await page.locator('body').innerText()).slice(-2000);
} finally {
  await writeFile(`artifacts/plugin-manager-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
