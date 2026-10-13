import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteScheduleCatalog, scheduleRuleText } from '../src/remote-schedules.mjs';
import { translate } from '../src/ui/translations.mjs';

function fixture(version = '0.2.1-alpha.2') {
  const listeners = new Set(), events = new Map(), reads = [];
  let generation = { id: 1 };
  const state = { connectionState: 'connected' };
  const model = { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    transport: { capabilities: { dshVersion: version, endpoints: { calls: ['schedule/list'] } } },
    connection: { generation: { getSnapshot: () => generation } },
    remote: { $on: (name, callback) => { events.set(name, callback); return () => events.delete(name); },
      schedule: { list: request => new Promise(resolve => reads.push({ request, resolve })) } } };
  return { model, state, reads, events, listeners, emit: () => { for (const listener of listeners) listener(); },
    nextGeneration: () => { generation = { id: generation.id + 1 }; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('定时面板刷新绑定原会话与连接代次，重连及关闭阻止迟到结果覆盖新状态', async () => {
  const f = fixture(), catalog = new RemoteScheduleCatalog(f.model, 'parent');
  catalog.start();
  assert.deepEqual(f.reads[0].request, { sessionId: 'parent' });
  f.reads[0].resolve({ ok: true, value: [{ id: 'original' }] }); await flush();
  assert.equal(catalog.getSnapshot().status, 'ready');
  f.emit(); assert.equal(f.reads.length, 1);
  f.events.get('schedule/changed')();
  f.state.connectionState = 'disconnected'; f.emit();
  f.reads[1].resolve({ ok: true, value: [{ id: 'late' }] }); await flush();
  assert.deepEqual(catalog.getSnapshot().records, [{ id: 'original' }]);
  f.nextGeneration(); f.state.connectionState = 'connected'; f.emit();
  f.reads[2].resolve({ ok: true, value: [{ id: 'new-generation' }] }); await flush();
  assert.deepEqual(catalog.getSnapshot().records, [{ id: 'new-generation' }]);
  f.events.get('schedule/changed')(); catalog.dispose();
  f.reads[3].resolve({ ok: true, value: [] }); await flush();
  assert.deepEqual(catalog.getSnapshot().records, [{ id: 'new-generation' }]);
  assert.equal(f.listeners.size, 0); assert.equal(f.events.size, 0);
});

test('旧版继续使用投影；新读取失败不伪装为空列表，显式重试成功可清空列表', async () => {
  const old = fixture('0.2.1-alpha.1'), legacy = new RemoteScheduleCatalog(old.model, 'parent');
  legacy.start(); assert.equal(old.reads.length, 0); assert.equal(old.events.size, 0); legacy.dispose();
  const f = fixture(), catalog = new RemoteScheduleCatalog(f.model, 'parent');
  catalog.start(); f.reads[0].resolve({ ok: false, error: { message: 'service_unavailable' } }); await flush();
  assert.equal(catalog.getSnapshot().status, 'error');
  const retry = catalog.refresh(); f.reads[1].resolve({ ok: true, value: [] }); await retry;
  assert.equal(catalog.getSnapshot().status, 'ready'); assert.deepEqual(catalog.getSnapshot().records, []);
  catalog.dispose(); catalog.start(); assert.equal(f.reads.length, 3); catalog.dispose();
});

test('新版每日、每周与自定义周期不显示成单次提醒，旧单次和固定间隔仍兼容', () => {
  const t = (text, fields) => translate('zh', text, fields), en = (text, fields) => translate('en', text, fields);
  assert.equal(scheduleRuleText({ kind: 'after' }, t, 'zh-CN'), '单次提醒');
  assert.equal(scheduleRuleText({ kind: 'every', everySeconds: 120 }, t, 'zh-CN'), '每 2分钟');
  assert.equal(scheduleRuleText({ kind: 'daily', time: '08:30:00.000', timeZone: 'Asia/Hong_Kong' }, t, 'zh-CN'), '每天 08:30:00（Asia/Hong_Kong）');
  const weekly = scheduleRuleText({ kind: 'weekly', weekdays: [1, 5], time: '08:30:00.000', timeZone: 'UTC' }, en, 'en');
  assert.match(weekly, /Mon.*Fri.*08:30:00.*UTC/);
  assert.match(scheduleRuleText({ kind: 'cron', expression: '0 8 * * *', timeZone: 'UTC' }, t, 'zh-CN'), /自定义周期.*0 8 \* \* \*/);
});
