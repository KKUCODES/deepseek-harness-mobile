import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// 真实时钟等待，不修改提醒记录或系统时间；该进程结束仅表示到达恢复时刻。
const seed = JSON.parse(await readFile('artifacts/schedule-missed-seed.json', 'utf8'));
const resumeAt = Date.parse(seed.firstRepeatAt) + 300000 + 8000;
assert.ok(Number.isFinite(resumeAt));
const started = new Date().toISOString();
while (Date.now() < resumeAt) {
  console.log(JSON.stringify({ waiting: true, secondsRemaining: Math.ceil((resumeAt - Date.now()) / 1000) }));
  await new Promise(resolve => setTimeout(resolve, Math.min(45000, resumeAt - Date.now())));
}
const report = { started, observedAt: new Date().toISOString(), firstRepeatAt: seed.firstRepeatAt,
  secondRepeatAt: new Date(Date.parse(seed.firstRepeatAt) + 300000).toISOString(), resumeAt: new Date(resumeAt).toISOString() };
await writeFile('artifacts/schedule-missed-clock.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
