import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalSettings } from '../src/local-settings.mjs';
import { appearanceValue, mirrorPhoneAppearance, watchPhoneAppearance } from '../src/phone-appearance.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const value = { preference: 'dark', fontSize: 17, enabled: true, language: 'zh' };
test('外观只接纳固定字段和有效枚举，不接收CSS或其他配置', () => {
  assert.deepEqual(appearanceValue(value), value);
  for (const invalid of [null, { ...value, fontSize: '17' }, { ...value, fontSize: 18 }, { ...value, fontSize: 14.5 },
    { ...value, preference: 'custom' }, { ...value, enabled: 1 }, { ...value, tokens: {} }, { ...value, language: 'fr' }, { ...value, language: null }]) assert.throws(() => appearanceValue(invalid));
  assert.deepEqual(appearanceValue({ preference: 'dark', fontSize: 17, enabled: true }), value);
});

test('普通设置镜像串行保存，失败可重试，插件禁用保留用户偏好', async () => {
  const store = new Map(), settings = new LocalSettings({ getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) });
  const changed = new Set(); let enabled = true, fail = true;
  const plugins = { enabled: () => enabled, state: { subscribe: listener => { changed.add(listener); return () => changed.delete(listener); } } };
  const written = [], native = { available: true, call: async (op, data) => {
    assert.equal(op, 'appearance.write'); if (fail) throw new Error('storage_failed'); written.push(data);
  } };
  const mirror = mirrorPhoneAppearance(settings, plugins, native);
  await tick(); assert.equal(mirror.getSnapshot().error, true);
  fail = false; await mirror.retry(); assert.equal(mirror.getSnapshot().error, false);
  const scope = settings.bind({ namespace: 'ui-theme' });
  await scope.set('preference', 'dark'); await scope.set('fontSize', 17); await mirror.retry();
  assert.deepEqual(written.at(-1), value);
  enabled = false; changed.forEach(listener => listener()); await mirror.retry();
  assert.deepEqual(written.at(-1), { ...value, enabled: false });
  await settings.bind({ namespace: 'locale' }).set('preference', 'en'); await mirror.retry();
  assert.deepEqual(written.at(-1), { ...value, enabled: false, language: 'en' });
  mirror.dispose(); const count = written.length;
  await scope.set('preference', 'light'); await tick(); assert.equal(written.length, count);
});

test('Remote按手机偏好响应系统主题，拒绝迟到读取，卸载后不写DOM', async () => {
  const events = new EventTarget(), media = new EventTarget(); media.matches = false;
  const waiting = [], snapshots = [], languages = []; let disposed = 0;
  const cleanup = watchPhoneAppearance({ call: op => { assert.equal(op, 'appearance.read'); return new Promise(resolve => waiting.push(resolve)); } },
    { apply: snapshot => snapshots.push(snapshot), dispose: () => disposed++ }, { events, media, onLanguage: locale => languages.push(locale) });
  events.dispatchEvent(new Event('dshm-appearance-change'));
  waiting[1](value); await tick(); assert.equal(snapshots.at(-1).active.colorScheme, 'dark');
  waiting[0]({ ...value, preference: 'light' }); await tick(); assert.equal(snapshots.at(-1).active.colorScheme, 'dark');
  events.dispatchEvent(new Event('dshm-appearance-change'));
  waiting[2]({ ...value, preference: 'system' }); await tick(); assert.equal(snapshots.at(-1).active.colorScheme, 'light');
  media.matches = true; media.dispatchEvent(new Event('change')); assert.equal(snapshots.at(-1).active.colorScheme, 'dark');
  events.dispatchEvent(new Event('pageshow'));
  waiting[3]({ ...value, enabled: false, language: 'en' }); await tick(); assert.equal(disposed, 1);
  assert.equal(languages.at(-1), 'en', '停用主题不应关闭语言同步');
  events.dispatchEvent(new Event('dshm-appearance-change'));
  cleanup(); const count = snapshots.length;
  waiting[4](value); await tick(); assert.equal(snapshots.length, count);
  assert.equal(languages.at(-1), 'en');
  assert.equal(disposed, 2);
});
