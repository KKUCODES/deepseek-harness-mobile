import { writeFile } from 'node:fs/promises';
// 只记录真正执行的 Host 版本；不注册模型、工具或读取用户数据。
export async function apply() {
  await writeFile('Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/plugin-restart-host.json', JSON.stringify({ version: '0.0.1', pid: process.pid, at: new Date().toISOString() }));
}
