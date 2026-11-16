import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { transform } from 'esbuild';
import { diagnosticLocation, diagnostics, safeFailureCode, webException } from '../src/app-diagnostics.mjs';
import { archiveWebSymbols } from '../scripts/web-symbols.mjs';
import { symbolicateWebLog } from '../scripts/symbolicate-web-log.mjs';

test('stack records retain the complete safe cause chain and strip messages, arbitrary function names and foreign locations', () => {
  const secret = 'private_fixture_text';
  const root = new AggregateError([new TypeError(secret)], secret, { cause: new RangeError(secret) });
  root.stack = `AggregateError: ${secret}\n    at ${secret} (https://appassets.androidplatform.net/assets/web/mobile-main.js:3:19)\n    at https://other.invalid/secret.js:77:4`;
  root.cause.stack = 'RangeError\n    at https://remote.dshm.invalid/assets/web/chunks/chunk-JXSWO6VW.js:20:33';
  root.errors[0].stack = 'TypeError\n' + Array(24).fill('    at remote-main.js:15:20').join('\n');
  const result = webException(root);
  assert.deepEqual(result.causes.map(item => item.relation), ['root', 'cause', 'suppressed']);
  assert.deepEqual(result.causes[0].frames, ['mobile-main.js:3:19']);
  assert.equal(result.causes[2].frames.length, 24);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(result.omitted, 1);
  assert.equal(diagnosticLocation('https://remote.dshm.invalid/assets/web/mobile-main.js?secret', 4, 5), undefined);
  assert.equal(safeFailureCode('MISSING_CREDENTIAL'), 'missing_credential');
  assert.equal(safeFailureCode(secret), 'unknown_error');
});

test('span links all stages with one opaque ID and emits elapsed time', () => {
  const captured = [];
  globalThis.__dshmDiagnostics = { record: (...args) => captured.push(args) };
  try {
    const finish = diagnostics.span('ordinary', 'ordinary_send');
    finish.stage('ordinary_response');
    finish('failed', { code: 'http_401' });
  } finally { delete globalThis.__dshmDiagnostics; }
  assert.deepEqual(captured.map(([, event]) => event), ['ordinary_send_start', 'ordinary_response', 'ordinary_send_failed']);
  assert.equal(new Set(captured.map(([, , data]) => data.trace)).size, 1);
  assert.match(captured[0][2].trace, /^[a-f0-9-]{36}$/);
  assert.equal(captured[2][2].level, 'ERROR');
});

test('external maps restore matching minified frames and are kept out of runtime assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dshm-symbols-'));
  try {
    const dist = join(root, 'web');
    await mkdir(dist);
    const file = join(dist, 'mobile-main.js');
    const source = 'export function example() {\n  throw new Error("fixture");\n}\n';
    const result = await transform(source, { sourcefile: '../src/example.js', sourcemap: 'external', minify: true });
    await writeFile(file, result.code);
    await writeFile(`${file}.map`, result.map);
    const build = await archiveWebSymbols({ dist, files: [file], outputs: [] });
    await assert.rejects(readFile(`${file}.map`), { code: 'ENOENT' });
    const archive = await readFile(join(root, 'web-symbols', `DSHM-Web-Symbols-${build}.zip`));
    const frame = `mobile-main.js:1:${result.code.indexOf('throw') + 1}`;
    const decoded = symbolicateWebLog({ build, location: frame }, archive);
    assert.equal(decoded.resolvedLocation.source, 'src/example.js');
    assert.equal(decoded.resolvedLocation.line, 2);
    assert.throws(() => symbolicateWebLog({ build: 'other', location: frame }, archive), /different builds/);
  } finally { await rm(root, { recursive: true }); }
});
