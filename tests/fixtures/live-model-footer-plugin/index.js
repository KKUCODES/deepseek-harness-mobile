import { readFile, writeFile } from 'node:fs/promises';
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
export function apply(ctx) {
  let last, busy = false, stopped = false;
  const timer = setInterval(async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const { sequence } = JSON.parse(await readFile(`${root}provider-card-refresh-command.json`, 'utf8'));
      if (typeof sequence !== 'string' || sequence === last) return;
      last = sequence;
      // 只发原目录失效事件，验证实际Host到手机的刷新；不修改设置或凭据。
      ctx.emit('llm/adapters-updated');
      await writeFile(`${root}provider-card-refresh-host.json`, JSON.stringify({ sequence, emitted: true }));
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError))
        await writeFile(`${root}provider-card-refresh-host.json`, JSON.stringify({ sequence: last, failed: true }));
    } finally { busy = false; }
  }, 150);
  ctx.effect(() => () => { stopped = true; clearInterval(timer); });
}
