import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

// 超时报告不证明完整通过；清理只接受原证据记录的唯一导出名和原件摘要。
const [evidenceName, homeName] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert.match(evidenceName, /^file-formats-[a-f0-9-]{36}$/);
assert.match(homeName, /^[a-f0-9-]{36}$/);
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
assert.ok(process.env.DSHM_ADB_PATH);
const mobile = resolve(import.meta.dirname, '..'), runtime = resolve(mobile, '../plugin/artifacts/latest-runtime-check');
const evidence = resolve(mobile, 'artifacts/latest-mobile-runtime', evidenceName);
const home = resolve(runtime, 'relay-homes', homeName);
assert.equal(await realpath(home), resolve(await realpath(resolve(runtime, 'relay-homes')), homeName));
const adb = (...args) => execFileSync(process.env.DSHM_ADB_PATH, ['-s', process.env.DSHM_ANDROID_SERIAL, ...args],
  { cwd: mobile, windowsHide: true, encoding: 'utf8' }).trim();
const completed = (await readdir(evidence)).filter(name => /^latest-file-transfer-format-(docx|doc|xlsx|xls|pptx|ppt)-complete\.json$/.test(name));
assert.ok(completed.length > 0);
const records = await Promise.all(completed.map(async name => JSON.parse(await readFile(resolve(evidence, name), 'utf8'))));
const first = records[0].sources[0].save.savedName;
const uuid = first.match(/^dshm-latest-export-([a-f0-9-]{36})-(?:workspace|attachment)-(?:docx|doc|xlsx|xls|pptx|ppt)\.(?:docx|doc|xlsx|xls|pptx|ppt)$/)?.[1];
assert.ok(uuid);
for (const record of records) {
  const bytes = await readFile(resolve(home, 'test-project/latest-native-office.' + record.extension));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  for (const source of record.sources) {
    assert.ok(source.save.savedName.startsWith('dshm-latest-export-' + uuid + '-'));
    assert.equal(source.save.sha256, sha256); assert.equal(source.save.bytes, bytes.length);
    assert.equal(source.share.received.sha256, sha256); assert.equal(source.share.received.bytes, bytes.length);
  }
}
const candidates = adb('shell', 'find /sdcard/Download -maxdepth 1 -type f -print').split(/\r?\n/)
  .filter(path => path.startsWith('/sdcard/Download/dshm-latest-export-' + uuid + '-'));
const copies = [];
for (const target of candidates) {
  const match = target.match(/^\/sdcard\/Download\/dshm-latest-export-[a-f0-9-]{36}-(workspace|attachment)-(docx|doc|xlsx|xls|pptx|ppt)\.([a-z]+)$/);
  assert.ok(match); assert.equal(match[2], match[3]);
  const bytes = await readFile(resolve(home, 'test-project/latest-native-office.' + match[2]));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(Number(adb('shell', 'stat', '-c', '%s', target)), bytes.length);
  assert.equal(adb('shell', 'sha256sum', target).split(/\s+/)[0], sha256);
  copies.push({ target, bytes: bytes.length, sha256 });
}
assert.ok(copies.length >= records.length * 2);
for (const copy of copies) {
  adb('shell', 'rm', copy.target);
  assert.equal(adb('shell', `if [ -e '${copy.target}' ]; then printf PRESENT; else printf ABSENT; fi`), 'ABSENT');
}
const proof = { at: new Date().toISOString(), passed: true, cleanupOnly: true, fullAcceptancePassed: false,
  evidence: relative(mobile, evidence), home: homeName, completedFormats: records.map(item => item.extension), copies };
await writeFile(resolve(evidence, 'owned-saved-copy-cleanup.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: true, cleanupOnly: true, copiesRemoved: copies.length, completedFormats: proof.completedFormats }));
