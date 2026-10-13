// 只在独立 home 创建测试工作区；目录安全描述符在创建时指定，原失败工作区保持原位。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

assert.equal(process.argv.length, 2); assert.equal(process.arch, 'x64'); assert.equal(process.platform, 'win32');
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, page, main, device, readSession, capture } = live;
const preparationPath = resolve(runtime, 'latest-live-ptc-owned-preparation.json');
const sessionPath = resolve(runtime, 'latest-live-ptc-owned-session.json');
const reportPath = resolve(runtime, 'latest-live-source-ptc-owned-android-prepare.json');
for (const path of [preparationPath, sessionPath, reportPath]) await assert.rejects(access(path), { code: 'ENOENT' });
const prepared = { at: new Date().toISOString(), home: state.home, sourceCommit: state.sourceCommit,
  workspacePath: resolve(state.home, 'ptc-owned-project-' + randomUUID()) };
const report = { at: new Date().toISOString(), home: state.home, hostPid: state.hostPid, passed: false };
try {
  assert.equal(state.executionMode, 'source'); assert.equal((await readSession()).row.running, false);
  assert.equal(dirname(prepared.workspacePath), state.home);
  assert.match(relative(state.home, prepared.workspacePath), /^ptc-owned-project-[0-9a-f-]{36}$/);
  const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
  const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
  const root = resolve(state.sourceRoot, 'packages/sandbox/sandbox-windows-acl');
  const ffi = await import(pathToFileURL(resolve(root, 'lib/types/ffi.js')));
  const api = ffi.win32Sync(); const koffi = createRequire(resolve(root, 'lib/types/ffi.js'))('koffi');
  const pointer = koffi.pointer('void');
  const attributes = koffi.struct('DSHM_OwnedPtcSecurityAttributes', {
    nLength: 'uint32', lpSecurityDescriptor: pointer, bInheritHandle: 'int',
  });
  assert.equal(koffi.sizeof(attributes), 24);
  const createDirectory = koffi.load('kernel32.dll').func('__stdcall', 'CreateDirectoryW', 'int', ['str16', koffi.pointer(attributes)]);
  const convertDescriptor = koffi.load('advapi32.dll').func('__stdcall', 'ConvertStringSecurityDescriptorToSecurityDescriptorW',
    'int', ['str16', 'uint32', koffi.pointer(pointer), koffi.pointer('uint32')]);
  const identities = execFileSync('C:/Windows/System32/whoami.exe', ['/user', '/fo', 'csv', '/nh'],
    { cwd: runtime, encoding: 'utf8', windowsHide: true }).match(/S-1-5-21-\d+-\d+-\d+-\d+/g);
  assert.equal(identities?.length, 1);
  await writeFile(preparationPath, JSON.stringify(prepared, null, 2), { flag: 'wx' });
  const slot = ffi.allocPtrSlot(); let descriptor;
  try {
    assert.notEqual(convertDescriptor(`D:(A;OICI;FA;;;${identities[0]})`, 1, slot, ffi.allocUint32()), 0);
    descriptor = ffi.decodePtr(slot); assert.notEqual(descriptor, null);
    assert.notEqual(createDirectory(prepared.workspacePath,
      { nLength: 24, lpSecurityDescriptor: descriptor, bInheritHandle: 0 }), 0);
    prepared.workspaceCreated = true;
    await writeFile(preparationPath, JSON.stringify(prepared, null, 2));
  } finally { if (descriptor != null) api.localFree(descriptor); }
  assert.equal(await realpath(prepared.workspacePath), prepared.workspacePath);
  // 使用原 DSH 已核对的电脑工作区登记协议；手机仍不能创建电脑目录。
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
  const url = new URL(loginURL); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
  const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const rpcId = randomUUID();
  const response = await fetch(new URL('/api/workspace/create', url), { method: 'POST',
    headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ type: 'client-request', rpcId, method: 'workspace/create',
      payload: { args: { request: { path: prepared.workspacePath } } } }) });
  assert.equal(response.status, 200); const frame = await response.json();
  assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true);
  prepared.workspaceId = frame.result.value.workspace.workspaceId;
  assert.equal(typeof prepared.workspaceId, 'string'); prepared.workspaceRegistered = true;
  await writeFile(preparationPath, JSON.stringify(prepared, null, 2));
  await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
  const picker = page.getByLabel('选择工作区', { exact: true });
  await picker.getByRole('button', { name: relative(state.home, prepared.workspacePath), exact: true }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  const title = 'DSHM 新版 PTC 有权限文件验收';
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
  await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(title);
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
  await main.getByRole('button', { name: '标准模式', exact: true }).click();
  await page.getByRole('menuitem', { name: /^PTC 模式 / }).click();
  await main.getByRole('button', { name: 'PTC 模式', exact: true }).waitFor();
  const selected = await main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, id = model.getSnapshot().selected;
      return { id, row: model.getSnapshot().list.byId[id] };
    }
    throw Error('latest_ptc_owned_selected_missing');
  });
  assert.match(selected.id, /^session-[0-9a-f-]{36}$/); assert.equal(selected.row.blank, true);
  assert.equal(selected.row.running, false); assert.equal(resolve(selected.row.cwd), prepared.workspacePath);
  await writeFile(sessionPath, JSON.stringify({ at: new Date().toISOString(), home: state.home,
    sessionId: selected.id, title, workspacePath: prepared.workspacePath,
    originalModeChosen: 'ptc', originalPhoneCreateVerified: true }, null, 2), { flag: 'wx' });
  report.sessionId = selected.id; report.workspacePath = prepared.workspacePath;
  report.originalPhoneCreateAndMode = true; report.passed = true;
  await capture('latest-live-source-ptc-owned-prepared');
} catch (error) { report.failure = { name: error.name, code: error.code, message: error.message }; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
