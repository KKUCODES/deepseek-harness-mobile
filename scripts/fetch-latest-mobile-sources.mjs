import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, posix } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const commit = '5badb15009ae1756c3afe0ae0cef1faafc290ccc';
const source = resolve(root, 'artifacts/latest-mobile-source');
const tree = JSON.parse(await readFile(resolve(root, '../plugin/artifacts/latest-upstream-tree.json'), 'utf8'));
if (tree.sha !== commit || tree.truncated) throw Error('Unverified upstream tree');
const blobs = new Map(tree.tree.filter(item => item.type === 'blob').map(item => [item.path, item]));
const analysis = JSON.parse(await readFile(resolve(root, 'dist/bundle-analysis.json'), 'utf8'));
const pending = new Set(Object.keys(analysis.inputs).filter(path => path.includes('deepseek-harness/')).map(path => path.split('deepseek-harness/')[1]));
for (const path of blobs.keys()) {
  if (/^(packages|vendor)\/[^/]+(?:\/[^/]+)?\/package\.json$/.test(path)) pending.add(path);
  // 派生文件不会出现在旧 metafile 的原路径中；设置拆包也增加了新的客户端入口。
  if (path.startsWith('packages/client/') && /\.(ts|tsx|css)$/.test(path) && !path.includes('/tests/')) pending.add(path);
}
for (const path of ['package.json', 'tsconfig.json', 'tsconfig.base.json', 'apps/web/src/node-module-stub.ts',
  'packages/client/ui-chat/src/client/chat/running-whale@2x.png',
  'packages/client/ui-chat/src/client/conversation-nodes/register.ts',
  'packages/client/ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts',
  'packages/client/ui-chat/src/client/conversation-nodes/turn-navigation.ts']) pending.add(path);
const visited = new Set(), records = [], missing = new Set();
const hash = body => createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
function queueRelative(path, text) {
  for (const match of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)) {
    const target = posix.normalize(posix.join(posix.dirname(path), match[1].split('?')[0]));
    const candidates = [target, target + '.ts', target + '.tsx', target + '/index.ts'];
    const found = candidates.find(candidate => blobs.has(candidate));
    if (found) pending.add(found);
    else missing.add(target);
  }
}
while (pending.size) {
  const batch = [...pending].filter(path => !visited.has(path)); pending.clear();
  if (!batch.length) break;
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (;;) {
      const path = batch[next++]; if (!path) break;
      visited.add(path);
      const blob = blobs.get(path);
      if (!blob) { missing.add(path); continue; }
      const output = resolve(source, path);
      let body;
      try {
        body = await readFile(output);
        if (hash(body) !== blob.sha) body = undefined;
      } catch {}
      try {
        if (!body) {
          const response = await fetch(`https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/${commit}/${path}`, { signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw Error(`HTTP ${response.status}`);
          body = Buffer.from(await response.arrayBuffer());
          if (hash(body) !== blob.sha) throw Error('Git blob mismatch');
          await mkdir(dirname(output), { recursive: true }); await writeFile(output, body);
        }
        records.push({ path, bytes: body.length, sha: blob.sha });
        if (records.length % 100 === 0) console.log(JSON.stringify({ checked: records.length, failed: records.filter(row => row.error).length }));
        if (/\.(ts|tsx|js|mjs|css)$/.test(path)) queueRelative(path, body.toString());
      } catch (error) { records.push({ path, error: error.message }); }
    }
  }));
  console.log(JSON.stringify({ verified: records.filter(row => !row.error).length, failed: records.filter(row => row.error).length, pending: pending.size }));
}
await mkdir(source, { recursive: true });
await writeFile(resolve(source, 'source-report.json'), JSON.stringify({ commit, records, missing: [...missing].sort() }, null, 2));
if (records.some(row => row.error)) process.exitCode = 1;
