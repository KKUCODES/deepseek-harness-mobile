// 清理本次排他创建的工作区；保留原会话与持久历史，不更改其他项目或绑定。
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { access, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const resuming = process.argv[2] === '--resume';
assert.ok(process.argv.length === 2 || (resuming && process.argv.length === 3));
const live = await openLatestLiveAndroid(resuming ? undefined : 'latest-live-ptc-owned-session.json', { openRecorded: true });
const { runtime, state, device, main, readSession } = live;
const session = resuming ? JSON.parse(await readFile(resolve(runtime, 'latest-live-ptc-owned-session.json'), 'utf8')) : live.session;
assert.equal(session.home, state.home);
const output = resolve(runtime, 'latest-live-ptc-owned-cleanup' + (resuming ? '-resumed' : '') + '.json');
await assert.rejects(access(output), { code: 'ENOENT' });
const report = { at: new Date().toISOString(), hostPid: state.hostPid, home: state.home,
  sessionId: session.sessionId, workspacePath: session.workspacePath, passed: false, files: [] };
const read = async name => JSON.parse(await readFile(resolve(runtime, name + '.json'), 'utf8'));
try {
  const prepared = await read('latest-live-ptc-owned-preparation');
  assert.equal(prepared.workspacePath, session.workspacePath); assert.equal(prepared.home, state.home);
  assert.match(relative(state.home, prepared.workspacePath), /^ptc-owned-project-[0-9a-f-]{36}$/);
  assert.equal(await realpath(prepared.workspacePath), prepared.workspacePath);
  const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  let original;
  if (!resuming) original = await readSession();
  for (const mode of ['source', 'release']) for (const scenario of ['read-only', 'workspace-write']) {
    const prefix = 'latest-live-' + (mode === 'source' ? 'source-' : '') + 'ptc-owned-file-' + scenario;
    const seed = await read(prefix + '-seed'); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    for (const phase of ['observe', 'replay', 'return']) {
      const result = await read(prefix + '-android-' + phase); assert.equal(result.passed, true);
      assert.equal(result.sessionId, session.sessionId);
    }
    assert.equal(dirname(seed.file), prepared.workspacePath); assert.equal(await readFile(seed.file, 'utf8'), seed.before);
    report.files.push({ path: seed.file, before: seed.before });
  }
  assert.equal(new Set(report.files.map(file => file.path)).size, 4);
  assert.deepEqual((await readdir(prepared.workspacePath)).sort(), report.files.map(file => relative(prepared.workspacePath, file.path)).sort());
  // 原电脑协议仅用于本次登记的工作区和会话；凭据只在内存里交换。
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
  const url = new URL(loginURL); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
  const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) }); assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const rpc = async (method, args) => {
    assert.ok(['workspace/archiveSession', 'workspace/delete', 'session/list', 'session/projections', 'session/page'].includes(method));
    const rpcId = randomUUID();
    const response = await fetch(new URL('/api/' + method, url), { method: 'POST',
      headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }) });
    assert.equal(response.status, 200); const frame = await response.json();
    assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true); return frame.result.value;
  };
  if (resuming) {
    const failed = await read('latest-live-ptc-owned-cleanup');
    for (const key of ['home', 'sessionId', 'workspacePath']) assert.equal(failed[key], report[key]);
    assert.equal(failed.passed, false); assert.equal(failed.returnedToPrimary, true); assert.equal(failed.sessionArchived, true);
    assert.equal(failed.failure.code, 'ERR_MODULE_NOT_FOUND');
    assert.equal(failed.originalGrantRevoked, undefined); assert.equal(failed.workspaceRegistrationRemoved, undefined);
    assert.deepEqual(failed.files, report.files);
    const projections = await rpc('session/projections', { request: { sessionId: session.sessionId } });
    const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: session.sessionId },
      throughSeq: projections.asOfSeq, maxMessages: 60 } });
    const row = (await rpc('session/list', { _request: {} })).items.find(item => item.sessionId === session.sessionId);
    assert.ok(row); assert.equal(resolve(row.cwd), prepared.workspacePath);
    assert.equal(projections.asOfSeq, failed.asOfSeq); assert.equal(digest(history.records), failed.originalPageSha256);
    original = { row, projections, records: history.records };
    report.priorFailurePreserved = true; report.alreadyArchived = true;
    assert.equal((await readSession()).row.running, false);
  } else {
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: 'DSHM 新版手机真实模型验收' }).click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    const archived = await rpc('workspace/archiveSession', { request: { sessionId: session.sessionId } });
    assert.ok(archived.archivedSessionIds.includes(session.sessionId));
  }
  assert.equal(original.row.running, false);
  assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
  report.asOfSeq = original.projections.asOfSeq; report.originalPageSha256 = digest(original.records);
  report.returnedToPrimary = true; report.sessionArchived = true;
  const libraryRoot = resolve(runtime, 'node_modules/@deepseek-ai/dsh-sandbox-windows-acl');
  const pkg = JSON.parse(await readFile(resolve(libraryRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '0.2.1-alpha.1');
  const library = await import(pathToFileURL(resolve(libraryRoot, 'lib/index.js')));
  // 发布包仅公开原 grant；只读 Win32 描述符解析使用已经核验的同版本源码库。
  const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
  const { sourceRoot } = await import('../../plugin/compatibility/latest-upstream/source-runtime.mjs');
  const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, prepared.sourceCommit);
  const nativeRoot = resolve(sourceRoot, 'packages/sandbox/sandbox-windows-acl/lib/types');
  const ffi = await import(pathToFileURL(resolve(nativeRoot, 'ffi.js')));
  const abi = await import(pathToFileURL(resolve(nativeRoot, 'win32-abi.js')));
  report.readOnlyNativeSourceCommit = installed.sourceCommit;
  const api = ffi.win32Sync();
  const writeSid = library.workspaceWriteSid(prepared.workspacePath);
  const grant = library.AclWriteGrant.create(writeSid);
  try { grant.add(prepared.workspacePath, false); } finally { grant.dispose(); }
  report.originalGrantRevoked = true;
  // 原 revoke 之后按真实描述符检查 capability 与 Low；不手工替换权限或抹掉原删除拒绝。
  report.securityAfterRevoke = [];
  for (const path of [prepared.workspacePath, ...report.files.map(file => file.path)]) {
    const slots = Array.from({ length: 5 }, () => ffi.allocPtrSlot());
    assert.equal(api.getNamedSecurityInfoW(path, abi.SE_FILE_OBJECT, 20, ...slots), 0);
    const descriptor = ffi.decodePtr(slots[4]);
    try {
      const label = ffi.decodePtr(slots[3]);
      assert.ok(label === null || ffi.decodeUint16At(label, 4) === 0);
      const dacl = ffi.decodePtr(slots[2]); assert.notEqual(dacl, null);
      const size = ffi.decodeUint16At(dacl, 2), count = ffi.decodeUint16At(dacl, 4);
      assert.ok(size >= 8 && size <= 1048576); let offset = 8, remaining = 0;
      for (let i = 0; i < count; i++) {
        const length = ffi.decodeUint16At(dacl, offset + 2); assert.ok(length >= 16 && offset + length <= size);
        const subCount = ffi.decodeUint8At(dacl, offset + 9); assert.ok(subCount <= 15 && 16 + 4 * subCount <= length);
        let authority = 0n;
        for (let j = 0; j < 6; j++) authority = authority * 256n + BigInt(ffi.decodeUint8At(dacl, offset + 10 + j));
        const subs = Array.from({ length: subCount }, (_, j) => ffi.decodeUint32At(dacl, offset + 16 + 4 * j));
        const sid = `S-${ffi.decodeUint8At(dacl, offset + 8)}-${authority}-${subs.join('-')}`;
        if (sid === writeSid) remaining++;
        offset += length;
      }
      assert.equal(remaining, 0); report.securityAfterRevoke.push({ path, capabilityEntries: 0, lowLabels: 0 });
    } finally { if (descriptor !== null) api.localFree(descriptor); }
  }
  const deleted = await rpc('workspace/delete', { request: { workspaceId: prepared.workspaceId } });
  assert.equal(deleted.deleted, true); report.workspaceRegistrationRemoved = true;
  for (const file of report.files) {
    assert.equal(await readFile(file.path, 'utf8'), file.before); await unlink(file.path);
  }
  assert.deepEqual(await readdir(prepared.workspacePath), []); await rmdir(prepared.workspacePath);
  await assert.rejects(access(prepared.workspacePath), { code: 'ENOENT' }); report.createdFilesAndDirectoryRemoved = true;
  const projections = await rpc('session/projections', { request: { sessionId: session.sessionId } });
  assert.deepEqual(projections, original.projections);
  const history = await rpc('session/page', { request: { address: { kind: 'session', sessionId: session.sessionId },
    throughSeq: projections.asOfSeq, maxMessages: 60 } });
  assert.equal(digest(history.records), report.originalPageSha256); report.originalProjectionAndPagePreserved = true;
  report.passed = true;
} catch (error) { report.failure = { name: error.name, code: error.code, message: error.message }; process.exitCode = 1; }
finally { await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
