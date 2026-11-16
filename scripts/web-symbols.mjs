import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { zipSync } from 'fflate';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');

function sourceName(source) {
  const clean = slash(decodeURI(source));
  const node = clean.lastIndexOf('/node_modules/');
  if (node >= 0) return `dependencies/${clean.slice(node + 14)}`;
  const packages = clean.lastIndexOf('/packages/');
  if (packages >= 0) return `upstream/${clean.slice(packages + 1)}`;
  const project = clean.lastIndexOf('/src/');
  if (project >= 0) return clean.slice(project + 1);
  const docs = clean.lastIndexOf('/docs/');
  if (docs >= 0) return clean.slice(docs + 1);
  return clean.split('/').at(-1);
}

export async function archiveWebSymbols({ dist, outputs, files }) {
  const archive = {}, assets = {};
  for (const absolute of [...new Set(files)].sort()) {
    const file = slash(relative(dist, absolute));
    const bytes = await readFile(absolute);
    const hash = sha(bytes);
    if (file === 'startup.js') { assets[file] = { hash, source: 'src/startup.js' }; continue; }
    const mapPath = `${absolute}.map`;
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    map.sources = map.sources.map(sourceName);
    delete map.sourcesContent;
    delete map.sourceRoot;
    const mapName = `maps/${file}.map`;
    archive[mapName] = Buffer.from(JSON.stringify(map));
    assets[file] = { hash, map: mapName, mapHash: sha(archive[mapName]) };
    await unlink(mapPath);
  }
  // esbuild also emits CSS maps. Only JS coordinates are part of the diagnostic contract.
  for (const path of outputs.filter(path => path.endsWith('.css.map'))) await unlink(path);
  const build = sha(JSON.stringify(assets));
  const manifest = { format: 'dshm-web-symbols-v1', build, commit: process.env.GITHUB_SHA ?? null, assets };
  archive['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2));
  const output = resolve(dist, '../web-symbols', `DSHM-Web-Symbols-${build}.zip`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, zipSync(archive, { level: 6 }));
  await writeFile(resolve(dist, '../web-symbols/current.json'), JSON.stringify({ build, file: output.split(/[\\/]/).at(-1) }) + '\n');
  return build;
}
