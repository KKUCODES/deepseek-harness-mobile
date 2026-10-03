import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const inject = ['sessions'];
const directory = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
// 只操作独立临时Session；受控结算用于拥塞验收，不代表模型实际执行。
export function apply(ctx) {
  let seen, busy = false, stopped = false, session, turn = 0;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const command = await readFile(directory + 'notice-overflow-control.json', 'utf8').then(JSON.parse).catch(() => null);
      if (!/^[a-f0-9-]{36}$/.test(command?.id ?? '') || command.id === seen || !['burst', 'fresh'].includes(command.action)) return;
      seen = command.id;
      if (stopped) return;
      session ??= ctx.sessions.create('session-' + randomUUID());
      const count = command.action === 'burst' ? 257 : 1;
      // 不在循环中await，使生产通知队列真实超限；事件仍经过原Session.append。
      for (let index = 0; index < count; index++) {
        session.append('turn/start', { turn: ++turn });
        session.append('turn/end', { turn, reason: { kind: 'completed' } });
      }
      await writeFile(directory + 'notice-overflow-host.json', JSON.stringify({ id: seen, action: command.action, count, sessionId: session.id, turn }));
    } catch {
      await writeFile(directory + 'notice-overflow-host.json', JSON.stringify({ id: seen, failed: true }));
    } finally { busy = false; }
  };
  const timer = setInterval(tick, 100);
  ctx.effect(() => () => { stopped = true; clearInterval(timer); }, 'notice-overflow verification');
}
