import assert from 'node:assert/strict';
import { SourceMap } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';

export function symbolicateWebLog(entry, bytes) {
  const files = unzipSync(bytes);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(manifest.format, 'dshm-web-symbols-v1');
  assert.equal(hash(JSON.stringify(manifest.assets)), manifest.build, 'Invalid symbols manifest');
  assert.equal(entry.build, manifest.build, 'The diagnostic entry and symbols are from different builds');
  const maps = new Map();
  function find(frame) {
    const [, file, line, column] = /^([\w./-]+\.js):(\d+):(\d+)$/.exec(frame) ?? [];
    const asset = Object.hasOwn(manifest.assets, file) ? manifest.assets[file] : undefined;
    if (asset?.source) return { frame, source: asset.source, line: Number(line), column: Number(column) };
    if (!asset?.map) return { frame };
    if (!maps.has(file)) {
      const map = Buffer.from(files[asset.map]);
      assert.equal(hash(map), asset.mapHash, 'Invalid symbols data');
      maps.set(file, new SourceMap(JSON.parse(map.toString())));
    }
    const location = maps.get(file).findOrigin(Number(line), Number(column));
    return location.fileName ? { frame, source: location.fileName, line: location.lineNumber, column: location.columnNumber,
      ...(location.name ? { name: location.name } : {}) } : { frame };
  }
  return { ...entry, ...(entry.location ? { resolvedLocation: find(entry.location) } : {}),
    ...(entry.exception ? { exception: { ...entry.exception, causes: entry.exception.causes.map(cause => ({ ...cause, frames: cause.frames.map(find) })) } } : {}) };
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith('/symbolicate-web-log.mjs') && process.argv[1].endsWith('symbolicate-web-log.mjs')) {
  const [, , log, archive] = process.argv;
  assert.ok(log && archive, 'Usage: node scripts/symbolicate-web-log.mjs <copied-log.json> <symbols.zip>');
  const entry = JSON.parse(await readFile(log, 'utf8'));
  console.log(JSON.stringify(symbolicateWebLog(entry, await readFile(archive)), null, 2));
}
