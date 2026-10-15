import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '..');
const toolLayout = process.argv.includes('--tool-layout');
const fileLayout = process.argv.includes('--file-layout');
const fileListLayout = process.argv.includes('--file-list-layout');
const builtinPanels = process.argv.includes('--builtin-panels');
const runningStatus = process.argv.includes('--running-status');
const forkActions = process.argv.includes('--fork-actions');
const web = join(root, 'artifacts/official-alpha2-mobile-dist');
const apk = join(root, 'artifacts/official-alpha2-android-build/outputs/apk/debug/app-debug.apk');
const bytes = await readFile(apk), archive = unzipSync(bytes);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : join(directory, entry.name)))).flat();
}
let count = 0;
for (const file of await files(web)) {
  const path = relative(web, file).replaceAll('\\', '/'); if (path === 'bundle-analysis.json') continue;
  assert.equal(hash(archive[`assets/web/${path}`] ?? new Uint8Array()), hash(await readFile(file)), path); count++;
}
const sourceHashes = {};
for (const file of await files(join(root, 'src'))) sourceHashes[relative(root, file).replaceAll('\\', '/')] = hash(await readFile(file));
const destination = join(root, forkActions ? 'artifacts/releases/DSHM-2026-10-15-fork-actions.apk' : runningStatus ? 'artifacts/releases/DSHM-2026-10-15-running-status.apk' : builtinPanels ? 'artifacts/releases/DSHM-2026-10-15-builtin-panels.apk' : fileListLayout ? 'artifacts/releases/DSHM-2026-10-15-remote-file-list-layout.apk' : fileLayout ? 'artifacts/releases/DSHM-2026-10-15-remote-file-layout.apk' : toolLayout ? 'artifacts/releases/DSHM-2026-10-14-remote-tool-layout.apk' : 'artifacts/releases/DSHM-2026-10-14-remote-motion.apk');
await mkdir(join(root, 'artifacts/releases'), { recursive: true }); await copyFile(apk, destination);
const report = { at: new Date().toISOString(), passed: true, webFiles: count, apkSha256: hash(bytes), bytes: bytes.length, sourceHashes,
  packageName: 'dev.dshmobile.validation.officialtest', kind: 'local-debug-candidate', publicReleaseUpdated: false };
await writeFile(join(root, forkActions ? 'artifacts/remote-fork-actions-apk.json' : runningStatus ? 'artifacts/remote-running-status-apk.json' : builtinPanels ? 'artifacts/builtin-panel-layout-apk.json' : fileListLayout ? 'artifacts/remote-file-list-layout-apk.json' : fileLayout ? 'artifacts/remote-file-layout-apk.json' : toolLayout ? 'artifacts/remote-tool-layout-apk.json' : 'artifacts/remote-motion-apk.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, webFiles: count, apkSha256: report.apkSha256, bytes: bytes.length, destination }));
