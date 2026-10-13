import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runtime = resolve(root, 'artifacts/latest-mobile-runtime');
const upstream = resolve(root, 'artifacts/latest-mobile-source');
const packages = ['modules', 'locale', 'store', 'ui-dockkit', 'ui-primitives', 'ui-renderer', 'ui-slots', 'ui-theme'];
const dependencies = { '@deepseek-ai/cordis': '4.0.5-alpha.1', '@deepseek-ai/cordis-plugin-loader': '1.0.6-alpha.1' };
for (const suffix of packages) {
  const metadata = JSON.parse(await readFile(resolve(upstream, 'packages/client', suffix, 'package.json'), 'utf8'));
  if (metadata.version !== '0.2.1-alpha.1') throw Error(`Unverified mobile package: ${suffix}`);
  dependencies[metadata.name] = metadata.version;
}
const documents = JSON.parse(await readFile(resolve(upstream, 'packages/client/ui-sidebar-documentpreview/package.json'), 'utf8'));
dependencies.yaml = documents.devDependencies.yaml;
await mkdir(runtime, { recursive: true });
await writeFile(resolve(runtime, 'package.json'), JSON.stringify({ name: 'dshm-latest-mobile-candidate', private: true, type: 'module', dependencies }, null, 2) + '\n');
console.log('Prepared isolated mobile dependencies; install with npm --prefix artifacts/latest-mobile-runtime install --ignore-scripts.');
