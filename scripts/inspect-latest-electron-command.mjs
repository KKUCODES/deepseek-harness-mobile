// 只重读原手机已提交的专用测试，不重复发送失败命令或改变权限。
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
const runtime=resolve(import.meta.dirname,'../../plugin/artifacts/latest-runtime-check');
const prefix='latest-live-electron-attempt-1-encoding';
const file=resolve(runtime,prefix+'-original-failure.json');await assert.rejects(access(file),{code:'ENOENT'});
const seed=JSON.parse(await readFile(resolve(runtime,prefix+'-seed.json')));assert.equal(seed.sent,true);
let live;
try{
  live=await openLatestLiveAndroid('latest-live-encoding-session.json',{openRecorded:true,reconnectRecorded:true});
  assert.equal(live.state.executionMode,'electron');assert.equal(live.session.sessionId,seed.sessionId);
  const snapshot=await live.readSession({allRecords:true});assert.equal(snapshot.row.running,false);
  assert.equal(snapshot.projections.values.permissions.currentValue,'read-only');
  const added=snapshot.records.filter(row=>row.event.seq>seed.initialSeq).map(row=>row.event);
  const calls=added.filter(event=>event.type==='tool/call');assert.equal(calls.length,1);assert.equal(calls[0].data.name,'pwsh');
  assert.equal(JSON.parse(calls[0].data.arguments).command,seed.command);
  const results=added.filter(event=>event.type==='tool/result');assert.equal(results.length,1);
  const report={at:new Date().toISOString(),readOnly:true,originalSingleCall:true,sessionId:seed.sessionId,hostPid:live.state.hostPid,
    callId:calls[0].data.callId,callSeq:calls[0].seq,resultSeq:results[0].seq,originalResult:results[0].data,
    eventTypes:added.map(event=>({seq:event.seq,type:event.type})),throughSeq:snapshot.projections.asOfSeq,permission:'read-only'};
  await writeFile(file,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report));
}finally{if(live)await live.device.close();}
process.exit(0);
