import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteJobs } from '../src/remote-jobs.mjs';

test('新版原任务服务优先于旧快照，不修改原目录；空集合不回退到过期旧任务', () => {
  const old = [{ id: 'old' }], rows = [{ id: 'pwsh-1', startedAt: 3, status: 'running' }];
  const list = Object.freeze({ jobsBySession: Object.freeze({ one: old }) });
  const jobs = Object.freeze({ rows: Object.freeze({ one: rows }), observed: {} });
  assert.equal(remoteJobs({ list }, 'one'), old);
  assert.equal(remoteJobs({ list, jobs }, 'one'), rows);
  assert.equal(remoteJobs({ list: {}, jobs }, 'one'), rows);
  assert.deepEqual(remoteJobs({ list, jobs: { rows: {}, observed: {} } }, 'one'), []);
  assert.deepEqual(remoteJobs({ list: {} }, 'one'), []);
  assert.equal(list.jobsBySession.one, old);
});
