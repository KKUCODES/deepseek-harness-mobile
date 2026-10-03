import test from 'node:test';
import assert from 'node:assert/strict';
import { supportDiagnostics } from '../src/support-diagnostics.mjs';

test('diagnostics excludes identity, source addresses, content, errors and plugin names', () => {
  const secret = 'SENSITIVE_MARKER';
  const result = supportDiagnostics({ mode: 'remote', stage: 'connected',
    info: { appVersion: '0.1.0-ordinary', appVersionCode: 2, androidApi: 31, webViewVersion: '110.0.5481.154.1', token: secret },
    binding: { paired: true, origin: secret, fingerprint: secret, hostId: secret, token: secret },
    capabilities: { transport: 2, dshVersion: '0.1.6-alpha.2', management: false, endpoints: secret },
    plugins: { state: 'ready', error: secret, entries: [{ state: 'active', id: secret, reason: secret, missing: [secret] }, { state: secret }] },
    conversation: secret, drafts: secret, error: secret });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(result.remote.plugins, { state: 'ready', counts: { active: 1, mobile: 0, waiting: 0, failed: 0, unknown: 1 } });
  assert.equal(result.remote.management, false);
  assert.equal(result.app.version, '0.1.0-ordinary');
  assert.equal(result.app.webView, '110.0.5481.154.1');
});

test('ordinary diagnostics never includes supplied Remote information', () => {
  const result = supportDiagnostics({ mode: 'ordinary', binding: { paired: true }, capabilities: { management: true }, plugins: { entries: [{ state: 'active' }] } });
  assert.equal('remote' in result, false);
  assert.equal(result.app.version, null);
});

test('missing and invalid values are unknown rather than false or raw strings', () => {
  const result = supportDiagnostics({ mode: 'remote', stage: 'secret-error', info: { appVersion: 'https://secret', androidApi: NaN },
    capabilities: { transport: 'secret', dshVersion: '/private/path', management: 'secret' }, plugins: { state: 'secret', entries: {} } });
  assert.equal(result.remote.stage, 'unknown');
  assert.equal(result.remote.management, null);
  assert.equal(result.remote.transport, null);
  assert.equal(result.remote.dshVersion, null);
  assert.equal(result.app.androidApi, null);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
