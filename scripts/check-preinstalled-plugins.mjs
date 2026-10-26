import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginPackage } from '../packages/plugin-sdk/package.mjs';

export async function checkPreinstalledPlugins(directory) {
  const files = await readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const entries = [], ids = new Set();
  for (const file of files.filter(file => file.name.endsWith('.dshm-plugin')).sort((a,b) => a.name.localeCompare(b.name))) {
    if (!file.isFile() || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\.dshm-plugin$/.test(file.name)) throw Error(`Invalid preinstalled filename: ${file.name}`);
    const pkg = validatePluginPackage(await readFile(resolve(directory, file.name)));
    if (ids.has(pkg.id)) throw Error(`Duplicate preinstalled plugin: ${pkg.id}`);
    ids.add(pkg.id); entries.push({ file: file.name, id: pkg.id, version: pkg.version, sha256: pkg.sha256 });
  }
  if (entries.length > 32) throw Error('Too many preinstalled plugins');
  return entries;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(process.argv[2] ?? 'preinstalled-plugins');
  const preinstalled = await checkPreinstalledPlugins(directory);
  if (process.argv[3]) {
    const output = resolve(process.argv[3]); await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(preinstalled));
  }
  console.log(JSON.stringify({ preinstalled }));
}
