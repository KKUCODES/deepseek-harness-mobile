import { writeFile } from 'node:fs/promises';
// 与首版使用同一路径，只有新进程真正加载新版时才写出 0.0.2。
export async function apply() {
  await writeFile('Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/plugin-restart-host.json', JSON.stringify({ version: '0.0.2', pid: process.pid, at: new Date().toISOString() }));
}
