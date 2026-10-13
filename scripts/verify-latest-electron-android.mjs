// 官方Electron完整桌面Host→原网关→原Android输入框；不读取Key、不重装或重新配对。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, copyFile, readFile, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
const args = process.argv.slice(2);
assert.ok(args.length === 0 || args[0] === '--attempt-2' &&
  (args.length === 1 || args.length === 2 && args[1] === '--retry-before-device'));
const attempt = args.length ? 2 : 1;
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const file = resolve(runtime,`latest-electron-android-attempt-${attempt}.json`);
const attemptFile = resolve(runtime,`latest-electron-message-attempt-${attempt}.json`);
if (args.includes('--retry-before-device')) {
  // 首次在连接设备前因缺少序列号失败；只有原发送凭据尚未生成才能重试。
  assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
  await assert.rejects(access(attemptFile), {code:'ENOENT'});
  const original = await readFile(file, 'utf8');
  assert.deepEqual(JSON.parse(original), {
    at:'2026-10-07T16:59:15.052Z', passed:false,
    failure:{name:'AssertionError',code:'ERR_ASSERTION',
      location:'at async file:///Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/scripts/verify-latest-electron-android.mjs:15:10'}
  });
  const backup = resolve(runtime, 'latest-electron-android-attempt-2-before-device-failed.json');
  await copyFile(file, backup, constants.COPYFILE_EXCL);
  assert.equal(await readFile(backup, 'utf8'), original);
  assert.equal(await readFile(file, 'utf8'), original);
  await unlink(file);
}
await assert.rejects(access(file),{code:'ENOENT'});await assert.rejects(access(attemptFile),{code:'ENOENT'});
const report = {at:new Date().toISOString(),passed:false};let live;
try {
  live = await openLatestLiveAndroid(undefined,{openRecorded:true,reconnectRecorded:true});
  const {state,session,main,page,device,readSession,capture} = live;
  assert.equal(state.executionMode,'electron');assert.equal(state.command,'official Electron desktop main');
  assert.equal(state.reviewCandidate,'candidate-package-check-1xqe3A');
  assert.equal(state.electronCarrier.release.nodeVersion,'24.18.1');
  if (attempt === 2) { assert.equal(state.electronCarrier.attempt, 2); assert.equal(state.electronCarrier.encodingUpgrade, true); }
  const audit = JSON.parse(await readFile(resolve(runtime,`latest-live-child-retention-${attempt === 2 ? 'electron-encoding-3' : 'electron'}-after-review-audited.json`)));
  assert.equal(audit.passed,true);assert.equal(audit.hostPid,state.hostPid);
  const active = audit.identity.devices.filter(row => row.status === 'active');
  assert.equal(active.length,1);assert.equal(active[0].management,false);
  assert.equal(active[0].fingerprint,'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  const appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
  assert.equal(appPid,3250);
  const apk = (await device.shell('pm path dev.dshmobile.validation.latesttest')).toString().trim();
  assert.match(apk,/^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  const apkSha256 = (await device.shell('sha256sum ' + apk.slice(8))).toString().trim().split(/\s+/)[0];
  assert.equal(apkSha256,'58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  const before = await readSession({allRecords:true});assert.equal(before.row.running,false);
  assert.equal(before.projections.values.permissions.currentValue,'workspace-write');
  const input = main.getByRole('textbox',{name:'消息',exact:true});assert.equal((await input.innerText()).trim(),'');
  const marker = 'DSHM_ELECTRON_' + randomUUID().replaceAll('-','').slice(0,16);
  await writeFile(attemptFile,JSON.stringify({at:new Date().toISOString(),home:state.home,hostPid:state.hostPid,
    sessionId:session.sessionId,marker,throughSeq:before.projections.asOfSeq}),{flag:'wx'});
  Object.assign(report,{home:state.home,hostPid:state.hostPid,electronHostPid:state.electronCarrier.electronHostPid,
    appPid,apkSha256,sessionId:session.sessionId,marker});
  await input.fill(`这是 DSHM 官方 Electron 桌面联调。请只回复 ${marker}，不要调用任何工具。`);
  await main.getByRole('button',{name:'发送消息',exact:true}).click();
  console.log(JSON.stringify({stage:'electron-android-model-wait',hostPid:state.hostPid}));
  await main.getByRole('article',{name:'模型回复',exact:true}).filter({hasText:marker}).waitFor({timeout:240000});
  await main.getByRole('button',{name:'停止生成',exact:true}).waitFor({state:'hidden',timeout:240000});
  const after = await readSession({allRecords:true});assert.equal(after.row.running,false);
  assert.deepEqual(after.records.slice(0,before.records.length),before.records);
  const added = after.records.slice(before.records.length).map(row => row.event);
  const text = event => (event.data.message?.content ?? event.data.content ?? []).filter(part=>part.type==='text').map(part=>part.text).join('\n');
  const users = added.filter(event=>event.type==='user/message' && text(event).includes(marker));
  const replies = added.filter(event=>event.type==='assistant/message' && text(event).trim()===marker);
  assert.equal(users.length,1);assert.equal(replies.length,1);assert.equal(added.filter(event=>event.type==='tool/call').length,0);
  assert.equal(after.projections.values.permissions.currentValue,'workspace-write');
  assert.deepEqual(after.projections.values.modelSelection,before.projections.values.modelSelection);
  assert.equal((await input.innerText()).trim(),'');assert.equal(await page.locator('iframe').count(),0);
  await capture(`latest-live-electron-attempt-${attempt}`);
  Object.assign(report,{userSeq:users[0].seq,assistantSeq:replies[0].seq,originalHistoryPrefixPreserved:true,
    originalAndroidComposerAndReply:true,noDesktopIframe:true,management:false,inferenceVerified:true,passed:true});
} catch(error) {report.failure={name:error.name,code:error.code ?? 'validation_failed',
  location:error.stack?.split('\n').find(line=>line.includes('verify-latest-electron-android.mjs:'))?.trim()};process.exitCode=1;}
finally {await writeFile(file,JSON.stringify(report,null,2),{flag:'wx'});if(live)await live.device.close();
  console.log(JSON.stringify({passed:report.passed,inferenceVerified:report.inferenceVerified,failure:report.failure}));}
process.exit(process.exitCode ?? 0);
