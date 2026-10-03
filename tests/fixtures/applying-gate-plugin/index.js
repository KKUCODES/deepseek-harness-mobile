import { readFileSync, writeFileSync } from 'node:fs';

// 仅供本机专项验收；控制文件固定在测试项目，既不开放接口也不替换原安装/取消行为。
const base = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/plugin-applying-gate';
function read(suffix) { try { return JSON.parse(readFileSync(`${base}.${suffix}.json`, 'utf8')); } catch { return null; } }
export function apply(ctx) {
  const consumed = new Set();
  let disposed = false;
  ctx.on('dispose', () => { disposed = true; });
  ctx.on('plugin-manager/install-state', progress => {
    if (progress.phase !== 'applying') return;
    const arm = read('arm');
    if (!arm || typeof arm.token !== 'string' || !/^[a-f0-9-]{36}$/.test(arm.token) ||
        !Number.isFinite(arm.expiresAt) || arm.expiresAt <= Date.now() || arm.expiresAt > Date.now() + 90000 || consumed.has(arm.token)) return;
    consumed.add(arm.token);
    const status = state => writeFileSync(`${base}.status.json`, JSON.stringify({ token: arm.token, requestId: progress.requestId, state }), { mode: 0o600 });
    const hmr = ctx.get('hmr');
    if (!hmr) { status('hmr-unavailable'); return; }
    // 注册在真实 applying 事件前沿，原 manager 随后排在这笔真实 HMR 事务后面。
    void hmr.runExclusive(async () => {
      status('holding');
      const end = Math.min(arm.expiresAt, Date.now() + 45000);
      while (!disposed && Date.now() < end && read('release')?.token !== arm.token) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      status('released');
    }).catch(() => status('gate-failed'));
  });
}
