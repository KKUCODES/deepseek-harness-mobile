import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** 编译只读上游测试样例；ZIP 依赖属于手机测试项目，不向上游检出安装依赖。 */
export async function loadOfficeFixture() {
  const source = resolve('../deepseek-harness/apps/web/tests/office-fixture.ts');
  const output = resolve('artifacts/office-fixture.mjs');
  await build({ entryPoints: [source], outfile: output, bundle: true, platform: 'node', format: 'esm',
    alias: { fflate: createRequire(import.meta.url).resolve('fflate') },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(source).href) } });
  return import(pathToFileURL(output).href);
}
