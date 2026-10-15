import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { documentLayoutMetrics } from './check-remote-file-layout.mjs';
import { fileListMetrics } from './check-remote-file-list-layout.mjs';
import { checkBuiltinPanelsAndroid } from './check-builtin-panel-android.mjs';
import { attachmentImageFixture } from './attachment-image-fixture.mjs';
import { checkRemoteCacheAndroid, observeCacheWire } from './check-remote-cache-android.mjs';

// 本轮只在独立测试 UID/独立官方配置中导航，不读取 Key、不发送模型消息。
const root = resolve(import.meta.dirname, '..');
const adbPath = process.env.DSHM_ADB_PATH; assert.ok(adbPath);
const serial = process.env.DSHM_ANDROID_SERIAL; assert.equal(serial, '127.0.0.1:16384');
const toolLayout = process.argv.includes('--tool-layout');
const cacheSync = process.argv.includes('--cache-sync');
const builtinPanels = process.argv.includes('--builtin-panels');
const fileListLayout = process.argv.includes('--file-list-layout');
const fileLayout = process.argv.includes('--file-layout') || fileListLayout;
const isolatedStyle = toolLayout || fileLayout || builtinPanels || cacheSync;
const packageName = isolatedStyle ? 'dev.dshmobile.validation.toolstyletest' : 'dev.dshmobile.validation.officialtest';
const output = resolve(root, cacheSync ? 'artifacts/remote-sync-cache-android' : builtinPanels ? 'artifacts/builtin-panel-layout-android' : fileListLayout ? 'artifacts/remote-file-list-layout-android' : fileLayout ? 'artifacts/remote-file-layout-android' : toolLayout ? 'artifacts/remote-tool-layout-android' : 'artifacts/remote-motion-android', randomUUID()); await mkdir(output, { recursive: true });
const home = join(output, 'home'), project = join(output, 'project'); await mkdir(project);
const version = '0.2.1-alpha.2';
const installation = resolve(root, '../plugin/artifacts/official-dsh-alpha2');
const cli = join(installation, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
assert.equal(JSON.parse(await readFile(join(installation, 'node_modules/@deepseek-ai/dsh/package.json'))).version, version);
const archive = resolve(root, cacheSync ? '../plugin/artifacts/official-alpha2-sdk/candidate' : '../plugin/artifacts/public-release/0.1.84-latest.0/public/dshm-plugin-0.1.84-latest.0-dsh-0.2.1-alpha.2.tgz');
const apk = resolve(root, isolatedStyle ? 'artifacts/remote-tool-layout-android-build/outputs/apk/debug/app-debug.apk' : 'artifacts/official-alpha2-android-build/outputs/apk/debug/app-debug.apk');
const env = { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', npm_config_cache: join(output, 'npm-cache') };
for (const key of Object.keys(env)) if (/^(?:DSH_MOBILE_|DEEPSEEK_API_KEY|OPENAI_API_KEY|DSH_TELEMETRY_OTLP_URL|NODE_OPTIONS)/.test(key)) delete env[key];
const execute = promisify(execFile);
const run = async (binary, args, options = {}) => (await execute(binary, args, { cwd: output, env, windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024, ...options })).stdout.trim();
const adb = (...args) => run(adbPath, ['-s', serial, ...args]);
const port = async () => { const server = createServer().listen(0, '127.0.0.1'); await once(server, 'listening'); const value = server.address().port; await new Promise(done => server.close(done)); return value; };
const until = async (read, accepts, message) => {
  const end = Date.now() + 45000;
  while (Date.now() < end) { const value = await read(); if (accepts(value)) return value; await wait(150); }
  throw Error(message);
};
const report = { version, packageName, startedAt: new Date().toISOString(), apkSha256: createHash('sha256').update(await readFile(apk)).digest('hex'),
  passed: false, stages: [], errors: [], modelMessagesSent: 0 };
let host, hostDone, gateway, db, device, page, cookie, hostOrigin, deviceId, fingerprint, relayPort, reverseInstalled = false;
let originalHistory, historySessionId;
const cacheWire = cacheSync ? observeCacheWire() : null;
const forgetBinding = async expected => {
  await page.getByTestId('remote-page').waitFor();
  assert.equal(await page.getByTestId('remote-fingerprint').innerText(), expected);
  await page.getByRole('button', { name: '连接选项', exact: true }).click();
  const menu = page.getByRole('dialog', { name: '电脑连接', exact: true });
  await menu.getByText('移除本机绑定', { exact: true }).click();
  await menu.getByRole('button', { name: '确认移除', exact: true }).click();
  await page.getByLabel('设备名称', { exact: true }).waitFor();
};
const mark = async stage => { report.stages.push(stage); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ stage, output })); };
const manage = async action => {
  const response = await fetch(hostOrigin + '/api/dsh-mobile', { method: action ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' },
    body: action ? JSON.stringify(action) : undefined, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200); const result = await response.json(); assert.ok(!result.error); return result;
};
const desktop = async (method, args) => {
  const response = await fetch(hostOrigin + '/api/' + method, { method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload: { args } }), signal: AbortSignal.timeout(30000) });
  const frame = await response.json(); assert.equal(frame.result?.ok, true, method); return frame.result.value;
};
async function checkFileLayout(main, idle, createChat) {
    await createChat();
    const path = 'src/mobile/preview/long-directory-name/approval-reject.txt';
    const contents = 'DSHM 文件预览验收\n正常正文必须保持可读，长内容在预览区域内滚动。\n' + 'Long source line '.repeat(70) + '\n' + '文件内容保持完整\n'.repeat(120);
    await mkdir(join(project, 'src/mobile/preview/long-directory-name'), { recursive: true });
    await writeFile(join(project, path), contents);
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('文件预览验收：保留草稿'); await idle();
    await main.evaluate((element, path) => {
      for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
        if (fiber.memoizedProps?.model?.pluginPanels) {
          const model = fiber.memoizedProps.model;
          model.pluginPanels.openResource(`dsh-resource://file/session/${model.getSnapshot().selected}/${path}`); return;
        }
      }
      throw Error('Remote model not found');
    }, path);
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    const plain = panel.locator('[data-textpreview-plain]');
    await plain.getByText('DSHM 文件预览验收', { exact: true }).waitFor(); await idle();
    const cases = [];
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      const metrics = await documentLayoutMetrics(panel);
      assert.ok(metrics.text.renderedFont >= 14 && metrics.path.renderedFont >= 13, JSON.stringify(metrics));
      assert.ok(metrics.body.height > 100 && metrics.pageWidth <= metrics.viewport, JSON.stringify(metrics));
      cases.push({ dark, ...metrics });
      await writeFile(join(output, dark ? 'file-layout-dark.png' : 'file-layout-light.png'), await device.screenshot());
    }
    const wrap = panel.locator('[data-textpreview-tool="wrap"]');
    if (await wrap.getAttribute('aria-pressed') === 'true') await wrap.click();
    const scroll = await panel.locator('[data-textpreview-body]').evaluate(element => { element.scrollLeft = 100; element.scrollTop = 100; return { left: element.scrollLeft, top: element.scrollTop }; });
    assert.ok(scroll.left > 0 && scroll.top > 0, JSON.stringify(scroll));
    assert.ok((await documentLayoutMetrics(panel)).text.renderedFont >= 14);
    await wrap.click();
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
    assert.equal(await input.innerText(), '文件预览验收：保留草稿'); await input.fill('');
    report.fileLayout = { cases, internalScroll: scroll, draftPreserved: true, actualFile: true };
    if (fileListLayout) {
      // 目录条目是真实文件；通过面板选择器进入实际电脑下发的 FilesBody。
      await mkdir(join(project, 'folder'), { recursive: true });
      await writeFile(join(project, 'folder/nested.txt'), '嵌套文件的真实正文');
      await Promise.all(Array.from({ length: 75 }, (_, index) => writeFile(join(project, `approval-${String(index).padStart(3, '0')}.txt`), `真实文件 ${index}`)));
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '插件面板', exact: true }).click(); await idle();
      await panel.getByRole('button', { name: '打开面板', exact: true }).click(); await idle();
      await panel.locator('[data-sidebar-right-guide-entry="files"]').click();
      const tree = panel.locator('[data-files-state="tree"]');
      await tree.getByRole('button', { name: 'approval-000.txt', exact: true }).waitFor(); await idle();
      const fileCases = [];
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
        const metrics = await fileListMetrics(panel);
        assert.ok(metrics.row.size >= 14 && metrics.path.size >= 13 && metrics.height > 200 && metrics.scrollHeight > metrics.height, JSON.stringify(metrics));
        assert.ok(metrics.pageWidth <= metrics.viewport, JSON.stringify(metrics)); fileCases.push({ dark, ...metrics });
        await writeFile(join(output, dark ? 'file-list-dark.png' : 'file-list-light.png'), await device.screenshot());
      }
      await tree.getByRole('button', { name: 'folder', exact: true }).click();
      await tree.getByRole('button', { name: 'nested.txt', exact: true }).click();
      await panel.locator('[data-textpreview-plain]').filter({ visible: true }).getByText('嵌套文件的真实正文', { exact: true }).waitFor();
      assert.ok((await documentLayoutMetrics(panel)).text.renderedFont >= 14);
      await panel.locator('nav').getByRole('button', { name: '文件', exact: true }).click();
      assert.equal(await tree.getByRole('button', { name: 'folder', exact: true }).getAttribute('aria-expanded'), 'true');
      await tree.locator('[data-files-reload]').click();
      await tree.getByRole('button', { name: 'nested.txt', exact: true }).waitFor();
      const position = await tree.locator('[data-files-body]').evaluate(async element => {
        element.scrollTop = 200;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return element.scrollTop;
      }); assert.ok(position > 0);
      report.fileList = { cases: fileCases, actualPluginEntry: true, nestedFileOpened: true, expansionPreserved: true, refreshed: true, scrollBeforeClose: position };
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '插件面板', exact: true }).click(); await idle();
      await panel.locator('nav').getByRole('button', { name: '文件', exact: true }).click();
      await tree.waitFor(); await idle();
      const restored = await tree.locator('[data-files-body]').evaluate(element => element.scrollTop);
      report.fileList.restoredScroll = restored;
      assert.equal(restored, position);
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
      report.fileList = { cases: fileCases, actualPluginEntry: true, nestedFileOpened: true, expansionPreserved: true, refreshed: true, localScrollPreserved: true };
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    await mark('android-real-file-preview-readable-and-scrollable');
}
try {
  if (toolLayout || cacheSync) {
    // 只复制已验收的自有测试会话；不复制 profile、Key 或其他聊天，也不伪造工具事件。
    const previous = JSON.parse(await readFile(resolve(root, '../backend/artifacts/official-plugin-only/official-android-7e20012a-4519-464c-bb8b-ec9f6a9ba395.json')));
    assert.equal(previous.passed, true); assert.equal(previous.version, version);
    historySessionId = previous.sessionId;
    assert.equal(historySessionId, 'session-80d246d8-29b8-41ba-8322-06372d7cdc9c');
    const sessions = join(installation, 'home/sessions');
    for (const group of await readdir(sessions, { withFileTypes: true })) {
      if (!group.isDirectory()) continue;
      const children = await readdir(join(sessions, group.name), { withFileTypes: true });
      if (!children.some(item => item.isDirectory() && item.name === historySessionId)) continue;
      originalHistory = join(sessions, group.name, historySessionId, 'session.v4.jsonl.zstd');
      const destination = join(home, 'sessions', group.name, historySessionId); await mkdir(destination, { recursive: true });
      await copyFile(originalHistory, join(destination, 'session.v4.jsonl.zstd')); break;
    }
    assert.ok(originalHistory, 'Original dedicated approval-test session');
    report.historySourceSha256 = createHash('sha256').update(await readFile(originalHistory)).digest('hex');
    report.historySessionId = historySessionId;
  }
  await mark('installing-published-plugin-in-owned-official-profile');
  await run(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', archive]);
  const hostPort = await port(); hostOrigin = `http://127.0.0.1:${hostPort}`;
  host = spawn(process.execPath, [cli, 'web', '--no-open', '--host', '127.0.0.1', '--port', String(hostPort)], { cwd: output, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  report.ownedHost = { pid: host.pid, origin: hostOrigin };
  hostDone = new Promise(done => host.once('close', done));
  let logs = ''; host.stdout.setEncoding('utf8'); host.stderr.setEncoding('utf8');
  for (const stream of [host.stdout, host.stderr]) stream.on('data', text => { logs = (logs + text).slice(-65536); });
  const loginUrl = await until(() => logs.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/)?.[1], Boolean, 'Official host startup');
  const login = await fetch(loginUrl, { redirect: 'manual' }); assert.equal(login.status, 303);
  cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const backend = resolve(root, '../backend'), require = createRequire(join(backend, 'package.json'));
  const { PGlite } = require('@electric-sql/pglite');
  const { Store } = await import(pathToFileURL(join(backend, 'packages/gateway/dist/store.js')).href);
  const { buildGateway } = await import(pathToFileURL(join(backend, 'packages/gateway/dist/app.js')).href);
  db = new PGlite(); const store = new Store({ query: (sql, args) => db.query(sql, args), transaction: work => db.transaction(tx => work({ query: (sql, args) => tx.query(sql, args) })), close: () => db.close() });
  await store.migrate(); relayPort = await port(); const origin = `http://127.0.0.1:${relayPort}`;
  report.ownedRelayPort = relayPort;
  gateway = await buildGateway({ store, publicOrigin: origin, registrationMode: 'open' }); await gateway.listen({ host: '127.0.0.1', port: relayPort });
  if (cacheWire) gateway.websocketServer.on('connection', (socket, request) => cacheWire.attach(socket, request));
  await manage({ action: 'setup', origin, name: 'DSHM 动效验收电脑' }); await manage({ action: 'enable' });
  await until(manage, value => value.connection === 'online', 'Relay connection');
  await writeFile(join(project, 'notes.md'), '# 随身推进项目\n\n这里是电脑上的真实文件，用于检查手机预览的进出过渡。\n\n- 保持阅读位置\n- 审阅执行结果\n- 回到同一个聊天\n');
  if (builtinPanels) {
    await writeFile(join(project, 'image.png'), attachmentImageFixture(320, 200));
    await writeFile(join(project, 'example.ts'), '// 日常代码阅读\n' + 'const message = "保持可读与局部滚动";\n'.repeat(120));
    await writeFile(join(project, 'page.html'), '<!doctype html><html lang="zh"><meta charset="utf-8"><body><h1>随身查看网页文件</h1><p>这是本次验证创建的独立 HTML 文件。</p></body></html>');
    await copyFile(join(root, 'artifacts/dshm-pdf-1790183840471.pdf'), join(project, 'document.pdf'));
    await copyFile(join(root, 'artifacts/dshm-office-1790187656727.docx'), join(project, 'document.docx'));
  }
  const workspaceId = (await desktop('workspace/create', { request: { path: project } })).workspace.workspaceId;
  await mark('official-host-and-real-relay-ready');
  await adb('install', '-r', apk);
  const installedPath = (await adb('shell', 'pm', 'path', packageName)).slice('package:'.length);
  assert.match(installedPath, /^\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
  assert.equal((await adb('shell', 'sha256sum', installedPath)).split(/\s+/)[0], report.apkSha256);
  await adb('reverse', `tcp:${relayPort}`, `tcp:${relayPort}`);
  reverseInstalled = true;
  await mark('owned-android-forward-ready');
  const link = (await manage({ action: 'pair' })).link;
  const key = new URLSearchParams(new URL(link).hash.slice(1)).get('key'); assert.match(key, /^[A-Za-z0-9_-]{43}$/);
  await adb('shell', 'am', 'start', '-W', '-n', `${packageName}/dev.dshmobile.validation.ValidationActivity`);
  // MuMu 安装/启动期间 ADB 可能短暂拒绝枚举。只重试同一只读探测，
  // 不重启 ADB/模拟器，也不重建 App 或配对。
  const devices = await until(async () => {
    try { return await _android.devices({ omitDriverInstall: true }); }
    catch { report.adbEnumerationRetries = (report.adbEnumerationRetries ?? 0) + 1; return null; }
  }, Boolean, 'Android device discovery');
  device = devices.find(item => item.serial() === serial);
  await Promise.all(devices.filter(item => item !== device).map(item => item.close())); assert.ok(device);
  const first = await (await androidAppWebView(device, packageName)).page();
  const context = first.context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opening = context.waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  page = await opening;
  page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-fingerprint').or(page.getByLabel('设备名称', { exact: true })).waitFor();
  if (await page.getByTestId('remote-fingerprint').isVisible()) {
    assert.ok(process.env.DSHM_MOTION_PREVIOUS_FINGERPRINT, 'Only an explicitly identified prior motion-test binding may be removed');
    await forgetBinding(process.env.DSHM_MOTION_PREVIOUS_FINGERPRINT); report.previousOwnTestBindingRemoved = true;
  }
  await page.evaluate(() => {
    window.motionEvidence = [];
    const active = new WeakSet();
    new MutationObserver(records => {
      for (const { target } of records) {
        if (active.has(target) || !(target instanceof HTMLElement)) continue;
        const label = target.dataset.navigationMotion ?? target.dataset.motionState;
        if (!label || label === 'idle') continue;
        active.add(target);
        const entry = { label, frames: [] }; window.motionEvidence.push(entry);
        const sample = () => {
          if (!target.isConnected) { active.delete(target); return; }
          entry.frames.push({ transform: getComputedStyle(target).transform, opacity: getComputedStyle(target).opacity,
            width: document.documentElement.scrollWidth, viewport: innerWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight });
          if (entry.frames.length < 20 && target.getAnimations().some(item => item.playState === 'running')) requestAnimationFrame(sample);
          else active.delete(target);
        };
        requestAnimationFrame(sample);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-navigation-motion', 'data-motion-state'] });
  });
  await page.getByLabel('一次性配对链接', { exact: true }).fill(link);
  await page.getByLabel('设备名称', { exact: true }).fill('DSHM 动效验证');
  await page.getByRole('button', { name: '继续配对', exact: true }).click();
  fingerprint = await page.getByTestId('remote-fingerprint').innerText(); report.deviceFingerprint = fingerprint;
  const row = (await manage()).devices.find(item => item.fingerprint === fingerprint); assert.equal(row?.status, 'pending'); deviceId = row.id;
  await manage({ action: 'approve', deviceId });
  if (builtinPanels) await manage({ action: 'management', deviceId, enabled: true });
  await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const idle = () => page.waitForFunction(() => document.getAnimations().every(item => item.playState !== 'running'));
  const createChat = async () => {
    await main.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).locator('button.option').first().click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor(); await idle();
  };
  if (cacheSync) {
    const reconnect = async () => {
        await adb('shell', 'am', 'force-stop', packageName);
        await adb('shell', 'am', 'start', '-W', '-n', `${packageName}/dev.dshmobile.validation.ValidationActivity`);
        const first = await (await androidAppWebView(device, packageName)).page(), context = first.context();
        const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
        await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
        const opening = context.waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
        await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
        page = await opening; page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
        return page;
      };
    report.cacheSync = await checkRemoteCacheAndroid({ page, device, packageName, historySessionId, workspaceId, desktop,
      wire: cacheWire, output, adb, reconnect });
    if (process.argv.includes('--startup-check')) {
      // 只停本轮独立电脑插件的连接；网关和撤销入口保留，最后恢复原连接意图。
      await manage({ action: 'disable' });
      page = await reconnect();
      await page.getByTestId('remote-fingerprint').waitFor();
      await page.locator('#dshm-startup').waitFor({ state: 'detached' });
      await page.getByText('电脑暂时离线，请检查 DSH 是否正在运行。', { exact: true }).waitFor();
      await adb('shell', 'uiautomator', 'dump', '/sdcard/dshm-offline-startup.xml');
      assert.doesNotMatch(await adb('shell', 'cat', '/sdcard/dshm-offline-startup.xml'), /content-desc="DSHM"/);
      await writeFile(join(output, 'startup-paired-offline.png'), await device.screenshot());
      assert.equal(await page.getByTestId('remote-fingerprint').innerText(), fingerprint);
      await manage({ action: 'enable' });
      await until(manage, value => value.connection === 'online', 'Owned test host reconnect');
      if (!await page.getByTestId('remote-workspace').isVisible()) {
        const button = page.getByRole('button', { name: '重新连接', exact: true });
        if (await button.isEnabled()) await button.click();
      }
      await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
      await page.locator('#dshm-startup').waitFor({ state: 'detached' });
      await adb('shell', 'rm', '-f', '/sdcard/dshm-offline-startup.xml');
      report.startup = { pairedOfflineActionable: true, coverDismissedWithoutHost: true, sameBinding: true, connectedWorkspaceRestored: true };
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    await mark('android-real-persistent-resource-and-incremental-sync');
  } else if (builtinPanels) {
    report.builtinPanels = await checkBuiltinPanelsAndroid({ page, main, idle, createChat, output, screenshot: () => device.screenshot() });
    assert.deepEqual(report.errors, []); report.passed = true;
    await mark('android-published-builtin-panels-readable');
  } else if (fileLayout) {
    await checkFileLayout(main, idle, createChat);
  } else if (toolLayout) {
    await main.locator('.remote-session-row').first().click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor(); await idle();
    const selected = await main.evaluate(element => {
      for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.pluginPanels) return fiber.memoizedProps.model.getSnapshot().selected;
    });
    assert.equal(selected, historySessionId);
    const error = main.locator('[data-chat-flow-kind="tool-call"]').filter({ hasText: 'Error: the user rejected escalating this operation' }).first();
    for (let count = 0; !await error.count() && count < 5; count++) {
      await main.locator('[data-history-loader]').click(); await idle();
    }
    await error.waitFor({ state: 'attached' });
    const turn = await error.getAttribute('data-chat-turn');
    const toggle = main.locator(`[data-turn-process="${turn}"]`);
    if (!await error.isVisible()) await toggle.click(); await idle();
    const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.fill('排版验收：保留草稿'); await idle();
    const cases = [];
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      await error.scrollIntoViewIfNeeded();
      const metrics = await error.evaluate(element => {
        const summary = Array.from(element.querySelectorAll('*')).find(item => item.childNodes.length === 1 && item.firstChild.nodeType === 3 && item.textContent.startsWith('Error: the user rejected escalating'));
        if (!summary) throw Error('Recorded error text not found');
        const rect = summary.getBoundingClientRect(); let scale = 1;
        const clippedBy = [];
        for (let item = summary; item && !item.matches('[data-chat-flow-key]'); item = item.parentElement) {
          const style = getComputedStyle(item), bounds = item.getBoundingClientRect();
          if (style.transform !== 'none') scale *= new DOMMatrix(style.transform).a;
          if (['hidden', 'clip'].includes(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) clippedBy.push(item.tagName);
        }
        return { renderedFont: Number.parseFloat(getComputedStyle(summary).fontSize) * scale, textHeight: rect.height, clippedBy,
          nativeFrames: element.querySelectorAll('.remote-native-tool').length, scaledFrames: element.querySelectorAll('[data-plugin-frame]').length,
          viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth };
      });
      assert.ok(metrics.renderedFont >= 14, JSON.stringify(metrics)); assert.ok(metrics.textHeight > 24);
      assert.deepEqual(metrics.clippedBy, []); assert.ok(metrics.nativeFrames > 0); assert.ok(metrics.pageWidth <= metrics.viewportWidth);
      await writeFile(join(output, dark ? 'tool-layout-dark.png' : 'tool-layout-light.png'), await device.screenshot());
      cases.push({ dark, ...metrics });
    }
    await error.getByRole('button', { name: '工具详情', exact: true }).click();
    const details = page.getByRole('dialog', { name: '工具详情', exact: true });
    await details.getByText(/Error: the user rejected escalating/).waitFor();
    await details.getByRole('button', { name: '关闭工具详情', exact: true }).click(); await idle();
    assert.equal(await input.innerText(), '排版验收：保留草稿');
    await input.fill(''); await idle();
    await toggle.click(); await idle(); assert.equal(await error.getAttribute('hidden'), 'until-found');
    await toggle.click(); await idle(); assert.equal(await error.isVisible(), true);
    report.toolLayout = { cases, originalHistory: true, detailsAccessible: true, draftPreserved: true, collapseAndExpand: true };
    assert.deepEqual(report.errors, []); report.passed = true;
    await mark('android-published-tool-plugin-real-approval-history-readable');
  } else {
  await createChat();
  const sessionId = await main.evaluate(element => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.pluginPanels) return fiber.memoizedProps.model.getSnapshot().selected;
  });
  assert.ok(sessionId); report.sessionId = sessionId;
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.fill('动效验收：保留此草稿'); await idle();
  await main.getByRole('button', { name: /选择模型，当前/ }).click(); await idle();
  const dialog = page.getByRole('dialog', { name: '选择模型', exact: true }); await dialog.waitFor();
  await writeFile(join(output, 'model-sheet.png'), await device.screenshot());
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).evaluate(button => button.click());
  await page.waitForFunction(() => document.querySelector('dialog[data-motion-state="exit"]')?.inert === true);
  await idle(); assert.equal(await input.innerText(), '动效验收：保留此草稿');
  await mark('android-own-remote-model-sheet-exit-and-draft');
  await main.evaluate((element, id) => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.model?.pluginPanels) { fiber.memoizedProps.model.pluginPanels.openResource(`dsh-resource://file/session/${id}/notes.md`); return; }
    }
    throw Error('Remote model not found');
  }, sessionId);
  const panel = page.getByRole('region', { name: '插件面板', exact: true }); await panel.waitFor();
  await panel.getByText('这里是电脑上的真实文件，用于检查手机预览的进出过渡。', { exact: true }).waitFor(); await idle();
  await writeFile(join(output, 'file-panel.png'), await device.screenshot());
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
  assert.equal(await main.evaluate(element => element.inert), false);
  assert.equal(await input.innerText(), '动效验收：保留此草稿');
  await input.fill(''); await idle();
  await main.getByRole('button', { name: '返回', exact: true }).click(); await idle();
  await main.locator('.remote-project-row').first().click(); await idle();
  await createChat();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '');
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight }));
  assert.ok(size.width <= size.viewport && size.height <= size.viewportHeight, JSON.stringify(size)); report.viewport = size;
  report.motion = await page.evaluate(() => window.motionEvidence);
  assert.ok(report.motion.some(item => item.label === 'forward' && item.frames.length > 1));
  assert.ok(report.motion.some(item => item.label === 'back' && item.frames.length > 1));
  assert.ok(report.motion.some(item => item.label === 'exit' && item.frames.length > 1));
  assert.ok(report.motion.every(item => item.frames.every(frame => frame.width <= frame.viewport && frame.height <= frame.viewportHeight)), '动画中不能撑开页面滚动区');
  assert.deepEqual(report.errors, []); report.passed = true;
  await mark('android-real-file-panel-close-focus-and-no-overflow');
  }
} catch (error) {
  report.failure = error.message.replace(/\?token=[^\s]+/g, '?token=[redacted]').replace(/#key=[^\s]+/g, '#key=[redacted]');
  report.failureCause = error.cause?.code;
  process.exitCode = 1;
} finally {
  report.cleanupErrors = [];
  if (deviceId) try { await manage({ action: 'revoke', deviceId }); report.deviceRevoked = true; } catch (error) { report.cleanupErrors.push(error.message); }
  if (report.deviceRevoked && page) try { await forgetBinding(fingerprint); report.ownTestBindingRemoved = true; } catch (error) { report.cleanupErrors.push(error.message); }
  if (gateway) await gateway.close(); if (db) await db.close();
  if (host && host.exitCode === null) { await run('taskkill.exe', ['/PID', String(host.pid), '/T', '/F']); await hostDone; report.ownedHostStopped = true; }
  if (reverseInstalled) await adb('reverse', '--remove', `tcp:${relayPort}`).catch(error => report.cleanupErrors.push(error.message));
  if (device) await device.close();
  if (originalHistory) {
    report.originalHistoryUnchanged = createHash('sha256').update(await readFile(originalHistory)).digest('hex') === report.historySourceSha256;
    if (!report.originalHistoryUnchanged) report.cleanupErrors.push('Original history changed');
  }
  if (report.cleanupErrors.length) { report.passed = false; process.exitCode = 1; }
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ output, passed: report.passed, stages: report.stages, viewport: report.viewport,
  failure: report.failure, errors: report.errors, cleanupErrors: report.cleanupErrors,
  deviceRevoked: report.deviceRevoked, ownTestBindingRemoved: report.ownTestBindingRemoved, ownedHostStopped: report.ownedHostStopped }));
process.exit(process.exitCode ?? 0);
