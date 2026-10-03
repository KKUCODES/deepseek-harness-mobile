import { readFile, writeFile } from 'node:fs/promises';
const control = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/blocked-notice-control.json';
const report = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/blocked-notice-host.json';

// 仅拒绝显式标记的测试输入；不构造turn/end，不接触其他会话、凭据或模型请求。
export function apply(ctx) {
  ctx.on('agent/pre-step', async (payload, next) => {
    const config = await readFile(control, 'utf8').then(JSON.parse).catch(() => null);
    if (!/^DSHM_BLOCK_NOTICE_[a-f0-9]{8}$/.test(config?.marker ?? '')
      || !payload.messages.some(message => message.content?.some(part => part.type === 'text' && part.text === config.marker))) return next();
    await writeFile(report, JSON.stringify({ marker: config.marker, entered: true }));
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      payload.signal.throwIfAborted();
      const current = await readFile(control, 'utf8').then(JSON.parse).catch(() => null);
      if (current?.marker === config.marker && current.release === true) {
        await writeFile(report, JSON.stringify({ marker: config.marker, entered: true, rejected: true }));
        return { kind: 'reject' };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // 超时不放行测试输入，避免误发外部模型；报告不可当作通知验收通过。
    await writeFile(report, JSON.stringify({ marker: config.marker, entered: true, timedOut: true }));
    return { kind: 'reject' };
  });
}
