import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 核查已保存的真实设备证据；不以本脚本通过代替重新操作设备。
const report = JSON.parse(await readFile(new URL('../artifacts/plugin-restart-run-android.json', import.meta.url), 'utf8'));
assert.equal(report.firstInstallCanEnable, true);
assert.equal(report.noImmediateEnableOnUpgrade, true);
assert.match(report.restartMessage, /下次启动后加载/);
assert.equal(report.beforeUpgrade.version, '0.0.1');
assert.deepEqual(report.beforeRestart, report.beforeUpgrade);
assert.equal(report.afterRestart.version, '0.0.2');
assert.notEqual(report.afterRestart.pid, report.beforeRestart.pid);
assert.match(report.detailAfterRestart, /v0\.0\.2/);
assert.match(report.detailAfterRestart, /1 运行中/);
assert.equal(report.uninstalled, true);
assert.equal(report.managementDenied, true);
assert.equal(report.authorization.management, false);
assert.equal(report.authorization.status, 'active');
assert.ok(report.restoredTitle.includes('DSHM Remote 联调提示'));
assert.equal(report.restoredDraft, report.draft);
assert.deepEqual(report.errors, []);
assert.ok(report.completedAt);
console.log(JSON.stringify({ ok: true, scope: 'saved-android-host-restart-evidence', from: report.beforeRestart.version, to: report.afterRestart.version }));
