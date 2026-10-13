// 仅检查已提交的原请求和进程，不激活父任务或重新发送消息。
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const mode = process.argv[2];
if (!['release', 'source'].includes(mode)) throw new Error('invalid_mode');
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
try {
  const seed = JSON.parse(await readFile(resolve(live.runtime, `latest-live-${mode}-nested-resume-seed.json`), 'utf8'));
  const root = await live.readSession({ allRecords: true });
  const middle = await live.readChild(seed.middleId);
  const grand = await live.readChild(seed.grandId, { ancestors: [seed.middleId] });
  const summary = value => ({ running: value.row?.running, parentSummary: value.parentSummary && {
    sessionId: value.parentSummary.sessionId, running: value.parentSummary.running,
    agentAvailable: value.parentSummary.agentAvailable },
    asOfSeq: value.projections.asOfSeq,
    inbox: Object.fromEntries(Object.entries(value.projections.values.inbox ?? {}).map(([key, rows]) => [key, rows.length])),
    tail: value.records.slice(-8).map(({ event }) => ({ seq: event.seq, type: event.type,
      reason: event.data.reason, name: event.data.name, callId: event.data.callId,
      isError: event.data.message?.isError, error: event.data.error })) });
  console.log(JSON.stringify({ mode, hostPid: live.state.hostPid, pid: seed.pid,
    root: summary(root), middle: summary(middle), grand: summary(grand) }));
} finally { await live.device.close(); }
setTimeout(() => process.exit(0), 200);
