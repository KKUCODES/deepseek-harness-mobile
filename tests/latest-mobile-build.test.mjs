import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { selectSdkPackage } from '../scripts/latest-mobile-build.mjs';

const name = '@deepseek-ai/dsh-util-values';
function fixture(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'dshm-sdk-resolution-'));
  function candidate(path, version) {
    const directory = resolve(root, path);
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'package.json'), '{}');
    if (version) {
      const dependency = resolve(directory, 'node_modules', name);
      mkdirSync(dependency, { recursive: true });
      writeFileSync(resolve(dependency, 'package.json'), JSON.stringify({ name, version }));
    }
    return { root: directory, require: createRequire(resolve(directory, 'package.json')) };
  }
  try { run(candidate); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('缺失包不借用父目录旧 SDK，而从独立配套 SDK 读取', () => fixture(candidate => {
  candidate('ordinary', '0.1.6-alpha.2');
  const mobile = candidate('ordinary/artifacts/mobile');
  const plugin = candidate('plugin', '0.2.1-alpha.2');
  const selected = selectSdkPackage(name, [mobile, plugin], '0.2.1-alpha.2');
  assert.equal(selected.require, plugin.require);
  assert.equal(selected.metadata.version, '0.2.1-alpha.2');
}));

test('独立目录内的错误版本仍拒绝，不跳过它伪装构建成功', () => fixture(candidate => {
  const mobile = candidate('mobile', '0.1.6-alpha.2');
  const plugin = candidate('plugin', '0.2.1-alpha.2');
  assert.throws(() => selectSdkPackage(name, [mobile, plugin], '0.2.1-alpha.2'), /Mixed mobile SDK/);
}));

test('只有父目录的依赖时明确失败', () => fixture(candidate => {
  candidate('ordinary', '0.2.1-alpha.2');
  const mobile = candidate('ordinary/artifacts/mobile');
  assert.throws(() => selectSdkPackage(name, [mobile], '0.2.1-alpha.2'), /Package missing from isolated mobile SDK/);
}));
