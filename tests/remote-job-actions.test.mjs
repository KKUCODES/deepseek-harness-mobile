import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteJobActions } from '../src/remote-job-actions.mjs';

test('停止绑定同一会话任务，未知结果与并发不重放，状态以电脑事件为准', async () => {
  const job = { id: 'pwsh-1', startedAt: 1, status: 'running' }, requests = [];
  let settle, generation = 1;
  const state = { selected: 'one', session: { openState: 'open' }, connectionState: 'connected', list: { jobsBySession: { one: [job] } } };
  const model = { getSnapshot: () => state, publish() {}, transport: { capabilities: { jobControlGeneration: 'host-generation' } },
    connection: { generation: { getSnapshot: () => ({ id: generation }) } },
    client: { request(operation) { requests.push(operation); return { promise: new Promise(resolve => { settle = resolve }) }; } } };
  const actions = new RemoteJobActions(model);
  await assert.rejects(actions.stop('another', job), /状态已变化/);
  await assert.rejects(actions.stop('one', { ...job, startedAt: 2 }), /状态已变化/);
  const stop = actions.stop('one', job);
  await assert.rejects(actions.stop('one', job), /正在请求停止/);
  settle({ status: 'requested' }); await stop;
  assert.equal(job.status, 'running'); assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { method: 'remote.jobStop', sessionId: 'one', jobId: 'pwsh-1', startedAt: 1, generation: 'host-generation' });
  model.client.request = () => { requests.push('uncertain'); return { promise: Promise.reject(new Error('connection_closed_outcome_unknown')) }; };
  await assert.rejects(actions.stop('one', job), /结果尚未确认/);
  await assert.rejects(actions.stop('one', job), /结果尚未确认/);
  assert.equal(requests.length, 2);
  generation++;
  model.client.request = () => ({ promise: Promise.resolve({ status: 'already-finished' }) });
  assert.equal(await actions.stop('one', job), 'already-finished');
});
