import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkPreinstalledPlugins } from '../scripts/check-preinstalled-plugins.mjs';
import { validatePluginPackage } from '../packages/plugin-sdk/package.mjs';

const root = resolve('artifacts/tests/preinstalled-plugins');
await mkdir(root, { recursive: true });
const source = await readFile('preinstalled-plugins/remote-home-design.dshm-plugin');

test('empty/missing preinstalled directory is valid; real home is a portable validated package', async () => {
  const empty = await mkdtemp(resolve(root, 'empty-'));
  assert.deepEqual(await checkPreinstalledPlugins(empty), []);
  assert.deepEqual(await checkPreinstalledPlugins(resolve(empty,'absent')), []);
  assert.equal(validatePluginPackage(source).id, '@dshm/remote-home-design');
  assert.equal((await checkPreinstalledPlugins('preinstalled-plugins')).length, 1);
});

test('duplicate IDs, incompatible APIs and corrupted packages fail before APK packaging', async () => {
  const directory = await mkdtemp(resolve(root,'invalid-'));
  await writeFile(resolve(directory,'one.dshm-plugin'),source);
  await writeFile(resolve(directory,'two.dshm-plugin'),source);
  await assert.rejects(checkPreinstalledPlugins(directory),/Duplicate/);
  for (const extra of [{apiVersion:99},{schema:'1'},{sha256:'0'.repeat(64)},{version:'latest'},{id:'../../escape'},{path:'file:///tmp/x'}]) {
    assert.throws(()=>validatePluginPackage(Buffer.from(JSON.stringify({...JSON.parse(source),...extra}))));
  }
});
