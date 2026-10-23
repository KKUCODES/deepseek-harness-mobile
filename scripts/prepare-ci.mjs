import assert from 'node:assert/strict';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'artifacts/ci/official-source-rc21');
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8', windowsHide: true });
assert.equal(revision.status, 0, 'Fixed official source checkout is required');
assert.equal(revision.stdout.trim(), '687f282e8625c6b8d11ff58211a90524be2e4317');
assert.ok(process.env.npm_execpath, 'Run through npm run prepare:ci');
for (const variant of ['rc21']) {
  const runtime = resolve(root, 'artifacts/ci/sdk', variant);
  await mkdir(runtime, { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) {
    await copyFile(resolve(root, 'ci/sdk', variant, file), resolve(runtime, file));
  }
  // 使用锁定的官方已发布 SDK，不编译或改动官方源码。
  const installed = spawnSync(process.execPath, [process.env.npm_execpath, 'ci', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund'],
    { cwd: runtime, stdio: 'inherit', windowsHide: true });
  assert.equal(installed.status, 0, `CI SDK installation failed: ${variant}`);
}
