import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalSettings } from '../src/local-settings.mjs';

test('新主题默认字段只投影到SDK，原手机设置与写入范围保持', async () => {
  const records = new Map();
  const settings = new LocalSettings({ getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value) });
  const defaults = { codeFontSize: 11, terminalFontSize: 13, textFontFamily: '', codeFontFamily: '', terminalFontFamily: '' };
  const form = settings.configForms({ themeDefaults: defaults }).get('ui-theme');
  const original = settings.bind({ namespace: 'ui-theme' });
  const first = form.getSnapshot();
  assert.equal(form.getSnapshot(), first);
  assert.deepEqual(first.value, { ...defaults, preference: 'system', fontSize: 14 });
  assert.deepEqual(original.getSnapshot().value, { preference: 'system', fontSize: 14 });
  await original.set('fontSize', 17);
  assert.notEqual(form.getSnapshot(), first);
  assert.equal(form.getSnapshot().value.fontSize, 17);
  assert.equal(form.getSnapshot().value.codeFontSize, 11);
  await assert.rejects(form.set('codeFontFamily', 'arbitrary'), /unsupported_settings_path/);
  assert.deepEqual(original.getSnapshot().value, { preference: 'system', fontSize: 17 });
});
