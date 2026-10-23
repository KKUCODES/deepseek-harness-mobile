import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageResources } from './web-update-package.mjs';
const root = resolve('artifacts/web-update-tests');
const output = resolve(root, 'fixtures/web-live'), broken = resolve(root, 'broken-source');
assert.ok(output.startsWith(root + '\\') || output.startsWith(root + '/'));
assert.ok(broken.startsWith(root + '\\') || broken.startsWith(root + '/'));
await rm(output, { recursive: true, force: true }); await rm(broken, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const source = resolve('artifacts/official-rc21-mobile-dist');
await cp(source, broken, { recursive: true });
await writeFile(resolve(broken, 'mobile-main.js'), 'throw new Error("resource-startup-failure-fixture");\n' + await readFile(resolve(broken, 'mobile-main.js'), 'utf8'));
for (const revision of [1, 2]) {
  const manifest = await packageResources({ source: revision === 1 ? source : broken, output: resolve(output, `r${revision}`),
    privatePath: resolve('artifacts/web-update-signing/private.pem'), trustPath: resolve('android/app/src/main/assets/web-update-trust.json'),
    revision, minApkCode: 2, maxApkCode: 2, applicationId: 'dev.dshmobile.validation.rc21test', notes: revision === 1 ? '页面热更新验收' : '启动失败回退验收' });
  console.log(JSON.stringify({ fixture: revision, files: manifest.files.length, bytes: manifest.archive.bytes }));
}
