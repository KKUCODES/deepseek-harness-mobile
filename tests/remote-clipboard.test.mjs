import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const outfile = resolve(root, 'artifacts/tests/remote-clipboard.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/ordinary-clipboard.mjs'], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  alias: { '@upstream': resolve(root, '../deepseek-harness/packages/client') } });
const { registerRemoteClipboard, writeClipboard } = require(outfile);

test('Remote 复制只调用当前宿主，原生拒绝不冒充成功，旧宿主清理不移除新宿主', async () => {
  const writes = [];
  const first = registerRemoteClipboard(text => writes.push(['first', text]));
  assert.equal(await writeClipboard('原样\u001b[31m中文\n'), true);
  const second = registerRemoteClipboard(text => writes.push(['second', text]));
  first(); assert.equal(await writeClipboard('new'), true);
  assert.deepEqual(writes, [['first', '原样\u001b[31m中文\n'], ['second', 'new']]);
  const failed = registerRemoteClipboard(async () => { throw new Error('request_limit'); });
  assert.equal(await writeClipboard('refused'), false);
  second(); assert.equal(await writeClipboard('still refused'), false);
  failed();
});
