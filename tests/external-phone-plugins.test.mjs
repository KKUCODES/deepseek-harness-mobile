import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlugin } from '../packages/plugin-sdk/build.mjs';
import { externalPhonePlugins } from '../src/external-phone-plugins.mjs';
import { PHONE_PLUGIN_CATALOG } from '../src/phone-plugin-catalog.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';

test('public SDK packages a standalone home without embedding React; versions load with one host runtime', async () => {
  const root = resolve('artifacts/tests/external-plugins/sdk'); await mkdir(root, { recursive: true });
  await writeFile(resolve(root, 'package.json'), JSON.stringify({ name: '@example/independent', version: '1.0.0', description: 'independent', dshm: { interfaceApi: 1, surface: 'dshm.remote.home', entry: 'index.jsx' } }));
  await writeFile(resolve(root, 'index.jsx'), `import React,{useState} from 'react';export const name='@example/independent';export const inject=['slots'];export const mobileInterface={apiVersion:1,surface:'dshm.remote.home'};export function apply(ctx){ctx.slots.register({name:mobileInterface.surface},({home})=>{const [value]=useState(home.view.title);return <p>{value}</p>})};export const runtime=React;`);
  const hashes = [];
  for (const version of ['1.0.0', '1.1.0']) {
    const output = resolve(root, `${version}.dshm-plugin`); await buildPlugin({ root, output, version });
    const pkg = JSON.parse(await readFile(output));
    assert.equal(createHash('sha256').update(pkg.code).digest('hex'), pkg.sha256);
    assert.ok(pkg.code.length < 3000, 'second React runtime is not bundled');
    const script = resolve(root, `${version}.mjs`); await writeFile(script, pkg.code);
    const plugin = (await import(pathToFileURL(script))).default({ apiVersion: 1, React });
    assert.equal(plugin.runtime, React); assert.equal(plugin.version, version);
    assert.equal(plugin.name, pkg.id); hashes.push(pkg.sha256);
  }
  assert.notEqual(...hashes);
  assert.equal(PHONE_PLUGIN_CATALOG.some(entry => entry.id === '@dshm/remote-home-design'), false, 'APK has no built-in home implementation');
});

test('external entries cannot escape the local content route or claim unsupported slots', () => {
  const valid = { id: '@example/home', name: 'home', version: '1.0.0', apiVersion: 1, surface: 'dshm.remote.home', sha256: 'a'.repeat(64), available: true };
  assert.equal(externalPhonePlugins([valid])[0].external, true);
  for (const entry of [{ ...valid, sha256: '../foo' }, { ...valid, id: 'https://bad.invalid' }, { ...valid, apiVersion: 2 }, { ...valid, surface: 'chat.input' }]) assert.throws(() => externalPhonePlugins([entry]));
});
