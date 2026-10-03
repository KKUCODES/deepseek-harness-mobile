import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remotePermission, remoteEndpoints, remoteRequestAllowed } from '../../backend/packages/protocol/dist/index.js';

// 使用当前只读上游的真实脱敏函数核验边界，所有字符串均为测试哨兵，不读取用户配置。
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/settings-redaction.cjs');
await build({ entryPoints: [resolve(root, '../deepseek-harness/packages/settings/settings/src/redact.ts')],
  outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
const { redactSecrets } = require(output);

test('上游只对可达 secret 字段脱敏，当前不能直接转发通用 settings.describe', () => {
  const secret = { type: 'string', meta: { role: 'secret' } };
  const value = { direct: 'TEST_DIRECT_ONLY', branch: { key: 'TEST_UNION_ONLY' }, headers: { Authorization: 'TEST_HEADER_ONLY' }, extra: 'TEST_UNKNOWN_ONLY' };
  const schema = { type: 'object', dict: { direct: secret, branch: { type: 'union', list: [{ type: 'object', dict: { key: secret } }] },
    headers: { type: 'dict', inner: { type: 'string' } } } };
  const redacted = redactSecrets(schema, value);
  assert.equal(redacted.value.direct, undefined);
  assert.equal(redacted.value.branch.key, 'TEST_UNION_ONLY');
  assert.equal(redacted.value.headers.Authorization, 'TEST_HEADER_ONLY');
  assert.equal(redacted.value.extra, 'TEST_UNKNOWN_ONLY');
  assert.deepEqual(redacted.secrets, [{ path: ['direct'], set: true }]);
  assert.equal(remotePermission('settings/describe', false), undefined);
  for (const endpoint of ['settings/replace', 'settings/mutate', 'credentials/describe', 'credentials/set', 'credentials/unset']) {
    assert.equal(remotePermission(endpoint, false), undefined);
  }
});

test('预设策略的限定写入不开放通用模型或凭据设置', () => {
  const endpoint = 'settings/update';
  assert.equal(remotePermission(endpoint, false), 'management');
  assert.equal(remotePermission(endpoint, true), undefined);
  assert.equal(remoteEndpoints(false).calls.includes(endpoint), false);
  assert.equal(remoteEndpoints(true).calls.includes(endpoint), true);
  const args = { ns: 'agent-presets', patch: { default: 'standard', modeSelectionEnabled: true }, expectedRevision: 0 };
  assert.equal(remoteRequestAllowed(endpoint, { args }), true);
  // 模型字段不能通过这个已开放的预设入口绕过固定管理服务。
  for (const ns of ['llm-deepseek', 'llm-pi-ai', 'credentials']) {
    assert.equal(remoteRequestAllowed(endpoint, { args: { ...args, ns } }), false);
  }
  for (const patch of [{ apiKeyEnv: 'TEST_REFERENCE' }, { headers: { Authorization: 'TEST_HEADER_ONLY' } },
    { default: 'standard', baseURL: 'http://example.invalid' }, { modeSelectionEnabled: 'true' }, {}]) {
    assert.equal(remoteRequestAllowed(endpoint, { args: { ...args, patch } }), false);
  }
  assert.equal(remoteRequestAllowed(endpoint, { args, management: true }), false);
  assert.equal(remoteRequestAllowed(endpoint, { args: { ...args, expectedRevision: -1 } }), false);
});
