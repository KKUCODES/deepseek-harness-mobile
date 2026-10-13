import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** 历史PID可能被Windows复用；只读身份，不因编号相同结束新进程。 */
export async function assertOfficialProcessStopped(receipt, receiptPath) {
  assert.equal(receipt.stage, 'exited'); assert.equal(receipt.entry, 'pnpm dsh web');
  assert.ok(Number.isSafeInteger(receipt.pid) && receipt.pid > 0);
  try { process.kill(receipt.pid, 0); }
  catch (error) { assert.equal(error.code, 'ESRCH'); return { pid: receipt.pid, absent: true }; }
  const script = resolve(import.meta.dirname, 'windows-process-identity.vbs');
  const output = (await execute('C:/Windows/System32/cscript.exe', ['//NoLogo', script, String(receipt.pid)],
    { windowsHide: true })).stdout.trim();
  if (output === 'absent') return { pid: receipt.pid, absent: true };
  const [pid, name, time, ...extra] = output.split('\t');
  assert.equal(extra.length, 0); assert.equal(Number(pid), receipt.pid); assert.match(name, /^[^\s\\/]+\.exe$/i);
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{6})([+-])(\d{3})$/.exec(time);
  assert.ok(match, 'Cannot establish process creation time');
  const parts = match.slice(1, 7).map(Number), offset = Number(match[9]) * (match[8] === '+' ? 1 : -1);
  const createdAt = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], Number(match[7].slice(0, 3))) - offset * 60000;
  const recordedExitAt = (await stat(receiptPath)).mtimeMs;
  // 只有创建于原退出回执之后的新进程，才能确认为编号复用；其他情况仍拒绝通过。
  assert.ok(createdAt > recordedExitAt, 'The old official process may still be running');
  return { pid: receipt.pid, reused: true, name, createdAt: new Date(createdAt).toISOString(),
    recordedExitAt: new Date(recordedExitAt).toISOString() };
}
