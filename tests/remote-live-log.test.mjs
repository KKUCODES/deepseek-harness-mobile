import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRemoteLiveLog } from '../src/remote-live-log.mjs';

test('Remote 日志实时通知、限制保留条数，并排除原始内容', () => {
  const log = createRemoteLiveLog(2);
  const received = [];
  const unsubscribe = log.subscribe(() => received.push(log.getSnapshot().at(-1)));
  log.record('picker_returned', 2);
  log.record('picker_expired', 'private-file.png');
  log.record('connection_error', 'private token');
  log.record('unknown', 'private message');
  unsubscribe();
  log.record('connection_ready');

  assert.deepEqual(received.map(row => [row.level, row.detail]), [['INFO', 2], ['WARN', undefined], ['ERROR', 'unknown_error']]);
  assert.deepEqual(log.getSnapshot().map(row => row.id), [3, 4]);
  assert.match(log.getSnapshot()[0].label, /诊断/);
});
