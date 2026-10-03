import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalSettings } from '../src/local-settings.mjs';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('真实序列化、重建 provider、unset 恢复默认值且保留 revision', async () => {
  const disk = storage();
  const theme = new LocalSettings(disk).bind({ namespace: 'ui-theme' });
  await Promise.all([theme.set('preference', 'dark'), theme.set('fontSize', 16)]);
  const reopened = new LocalSettings(disk).bind({ namespace: 'ui-theme' });
  assert.deepEqual(reopened.getSnapshot().value, { preference: 'dark', fontSize: 16 });
  assert.equal(reopened.getSnapshot().revision, 2);
  await reopened.unset('fontSize');
  assert.equal(reopened.getSnapshot().value.fontSize, 14);
  assert.equal(Object.hasOwn(reopened.getSnapshot().user, 'fontSize'), false);
});

test('冲突、非法整组变更、存储失败都不发布成功或部分提交', async () => {
  const disk = storage();
  const theme = new LocalSettings(disk).bind({ namespace: 'ui-theme' });
  let signals = 0;
  theme.subscribe(() => signals++);
  await theme.set('fontSize', 15);
  await assert.rejects(theme.mutate([{ op: 'set', path: ['fontSize'], value: 16 }], 0), /conflict/);
  await assert.rejects(theme.mutate([
    { op: 'set', path: ['preference'], value: 'dark' },
    { op: 'set', path: ['fontSize'], value: 999 },
  ]), /invalid_setting/);
  disk.setItem = () => { throw new Error('quota'); };
  await assert.rejects(theme.set('fontSize', 16), /quota/);
  assert.equal(signals, 1);
  assert.deepEqual(theme.getSnapshot().value, { preference: 'system', fontSize: 15 });
});

test('不接受未知服务、原型属性或被修改的外部快照', async () => {
  const provider = new LocalSettings(storage());
  assert.throws(() => provider.bind({ namespace: 'workspace' }), /unsupported/);
  assert.throws(() => provider.bind({ namespace: '__proto__' }), /unsupported/);
  assert.throws(() => provider.bind({ namespace: 'constructor' }), /unsupported/);
  const theme = provider.bind({ namespace: 'ui-theme' });
  await assert.rejects(theme.set('__proto__', {}), /unsupported/);
  assert.throws(() => { theme.getSnapshot().value.fontSize = 99; }, TypeError);
  assert.equal(provider.facade().session, undefined);
});
