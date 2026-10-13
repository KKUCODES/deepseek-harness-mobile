// 回到原发布载体，保留已接收的 Electron 测试消息；先让手机读取稳定，再审计全部历史。
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
const runtime=resolve(import.meta.dirname,'../../plugin/artifacts/latest-runtime-check');
const phase=process.argv[2];assert.ok(['prepare','check'].includes(phase));assert.ok(process.argv.length === 3 || process.argv.length === 4 && process.argv[3] === '--attempt-2');
const attempt=process.argv[3] ? 2 : 1;
const file=resolve(runtime,`latest-electron-android-${attempt === 2 ? 'attempt-2-' : ''}restored-${phase}.json`);await assert.rejects(access(file),{code:'ENOENT'});
const model=JSON.parse(await readFile(resolve(runtime,`latest-electron-android-attempt-${attempt}.json`)));
assert.equal(model.passed,true);assert.equal(model.inferenceVerified,true);
let live;const report={at:new Date().toISOString(),phase,passed:false};
try{
  live=await openLatestLiveAndroid(undefined,{openRecorded:true,reconnectRecorded:true});
  const {state,session,device,main,page,readSession}=live;
  assert.equal(state.executionMode,'release');assert.equal(state.reviewCandidate,undefined);
  assert.equal(state.home,model.home);assert.equal(session.sessionId,model.sessionId);assert.equal(state.previousHostPid,model.hostPid);
  assert.equal(Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim()),model.appPid);
  const apk=(await device.shell('pm path dev.dshmobile.validation.latesttest')).toString().trim();
  assert.match(apk,/^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  const sha=(await device.shell('sha256sum '+apk.slice(8))).toString().trim().split(/\s+/)[0];assert.equal(sha,model.apkSha256);
  await main.getByRole('article',{name:'模型回复',exact:true}).filter({hasText:model.marker}).waitFor();
  const snapshot=await readSession({allRecords:true});assert.equal(snapshot.row.running,false);
  assert.equal(snapshot.projections.values.permissions.currentValue,'workspace-write');
  assert.equal((await main.getByRole('textbox',{name:'消息',exact:true}).innerText()).trim(),'');
  assert.equal(await page.locator('iframe').count(),0);assert.ok(snapshot.projections.asOfSeq>=model.assistantSeq);
  if(phase==='check'){
    const audit=JSON.parse(await readFile(resolve(runtime,`latest-live-child-retention-${attempt === 2 ? 'electron-encoding-3' : 'electron'}-after-restore-audited.json`)));
    assert.equal(audit.passed,true);assert.equal(audit.hostPid,state.hostPid);assert.equal(audit.sessionCount,26);
    assert.equal(snapshot.projections.asOfSeq,audit.identity.sessions.find(row=>row.id===session.sessionId).seq);
    const active=audit.identity.devices.filter(row=>row.status==='active');assert.equal(active.length,1);
    assert.equal(active[0].management,false);assert.equal(active[0].fingerprint,'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  }
  Object.assign(report,{passed:true,hostPid:state.hostPid,home:state.home,sessionId:session.sessionId,appPid:model.appPid,
    apkSha256:sha,throughSeq:snapshot.projections.asOfSeq,realAndroidOwnRemote:true,originalReplyRetained:true,
    keyRead:false,appReinstalled:false,pairingReplaced:false,management:false});
}catch(error){report.failure={name:error.name,code:error.code,message:error.message};process.exitCode=1;}
finally{await writeFile(file,JSON.stringify(report,null,2),{flag:'wx'});if(live)await live.device.close();console.log(JSON.stringify(report));}
process.exit(process.exitCode??0);
