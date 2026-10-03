import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
const report = { at: new Date().toISOString(), removed: [] };
try {
  const digest = createHash('sha256').update(await readFile('artifacts/dshm-shared-upload-20260924.txt')).digest('hex');
  const all = (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0');
  for (const number of [3, 4]) {
    const path = `/sdcard/Download/dshm-shared-upload-20260924.txt (${number})`;
    if (!all.includes(path)) continue;
    const modified = Number((await device.shell(`stat -c %Y '${path}'`)).toString().trim()) * 1000;
    // 第二个副本在关闭遗留分享窗口后才收到结果；以最后一轮回归开始作为上界。
    assert.ok(modified >= Date.parse('2026-09-27T07:27:50Z') && modified < Date.parse('2026-09-27T07:32:31.616Z'), `Unexpected fixture timestamp: ${new Date(modified).toISOString()}`);
    assert.equal((await device.shell(`sha256sum '${path}'`)).toString().split(/\s/)[0], digest);
    await device.shell(`rm '${path}'`);
    report.removed.push({ path, modified, sha256: digest });
  }
  report.pendingSaveMarkers = (await device.shell('run-as dev.dshmobile.validation find no_backup/remote-save-writes -maxdepth 1 -type f')).toString().trim();
  assert.equal(report.pendingSaveMarkers, '');
  report.staging = (await device.shell('run-as dev.dshmobile.validation find cache/remote-downloads -maxdepth 1 -type f')).toString().trim();
  assert.equal(report.staging, '');
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/save-death-copy-cleanup.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
