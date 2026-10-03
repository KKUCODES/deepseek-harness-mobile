import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export const inject = ['dynamicCordisRunner', 'agents', 'sessionController'];

/** 固定测试包只登记到专用联调会话；真实运行、停止和移除由手机原面板操作。 */
export async function apply(ctx) {
  const sessionId = 'session-d4ec40ee-a27c-41fc-a860-b3974434e637';
  const hostCode = 'return { apply() { let calls = 0, failures = 0; harness.handle("echo", value => ({ echoed: value, calls: ++calls, failures })); harness.handle("fail", () => { failures++; throw new Error("DSHM_EXPECTED_HOST_HANDLER_FAILURE"); }); } }';
  const receipt = ctx.dynamicCordisRunner.define({ sessionId, plugin: { kind: 'new', idPrefix: 'dshm' },
    name: 'DSHM 动态插件联调', purpose: '专用测试包：验证手机原清单、运行、Host 回声调用与移除，不调用模型。',
    code: { host: hostCode,
      client: await readFile(new URL('./client-source.js', import.meta.url), 'utf8') },
  });
  const runId = randomUUID();
  await writeFile('Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/cordis-live-host.json', JSON.stringify({ sessionId, runId, ...receipt }));
  const control = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/cordis-approval-control.json';
  const output = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/cordis-approval-host.json';
  let seen, busy = false, closed = false;
  let owner, finish, maintenance, beforeIds, beforeTurns, audit, timeout;
  const turnCount = agent => agent.session.snapshotEvents().filter(event => event.type === 'turn/start').length;
  const releaseHold = async () => {
    if (!owner || !finish) return;
    const held = owner;
    let removed = 0;
    for (const message of [...held.inbox.nextStep, ...held.inbox.nextTurn]) {
      if (!beforeIds.has(message.id) && message.source?.kind === 'plugin' && message.source.plugin === 'cordis-host-runner'
        && message.content.some(part => part.type === 'text' && part.text.includes(receipt.pluginId))) {
        if (held.inbox.remove(message.id)) removed++;
      }
    }
    // 只取消本次维护任务的唤醒闩锁；原有或同时到达的其他待办保持原样。
    held.cancel({ kind: 'disposed' }, { keepInbox: true });
    const release = finish; finish = undefined; release(); await maintenance;
    audit = { removedTestMessages: removed, newTurns: turnCount(held) - beforeTurns,
      existingMessagesPreserved: [...beforeIds].every(id => [...held.inbox.nextStep, ...held.inbox.nextTurn].some(message => message.id === id)) };
  };
  const packages = new Map([[1, receipt.packageId]]);
  const tick = async () => {
    if (busy || closed) return;
    busy = true;
    try {
      const request = JSON.parse(await readFile(control, 'utf8'));
      if (request.runId !== runId) return;
      if (request.id === seen) return;
      if (!/^cordis-approval-\d+-\d+$/.test(request.id)) throw Error('Unexpected verification request');
      seen = request.id;
      // 冷历史不保证已有 Agent；沿原控制器恢复，保留会话预设和模型选择，不发送消息。
      const resolved = await ctx.sessionController.resolveAgent(sessionId);
      if (resolved.error) throw resolved.error;
      const agent = resolved.agent;
      let result;
      if (request.action === 'request' || request.action === 'hold') {
        if (!maintenance) {
          owner = agent;
          beforeIds = new Set([...agent.inbox.nextStep, ...agent.inbox.nextTurn].map(message => message.id));
          beforeTurns = turnCount(agent);
          maintenance = agent.runMaintenance(() => new Promise(resolve => { finish = resolve; }));
          timeout = setTimeout(() => {
            void ctx.dynamicCordisRunner.undefine(agent, receipt.pluginId).then(releaseHold);
          }, 180000);
        }
        if (!finish) throw Error('Verification maintenance is not active');
      }
      if (request.action === 'request') {
        if (![1, 2, 3, 4, 5].includes(request.version)) throw Error('Unexpected fixture version');
        let packageId = packages.get(request.version);
        if (!packageId) {
          const next = ctx.dynamicCordisRunner.define({ sessionId,
            plugin: { kind: 'existing', pluginId: receipt.pluginId }, name: `DSHM 动态插件联调 v${request.version}`,
            purpose: '固定版本测试：不调用模型，不写用户文件。',
            code: { host: hostCode,
              client: request.version === 4 ? 'throw new Error("DSHM_EXPECTED_CLIENT_FAILURE_V4");'
                : (await readFile(new URL('./client-source.js', import.meta.url), 'utf8')).replace('DSHM_CORDIS_ECHO', `DSHM_CORDIS_ECHO_V${request.version}`) },
          });
          packageId = next.packageId; packages.set(request.version, packageId);
        }
        result = await ctx.dynamicCordisRunner.run(agent, receipt.pluginId, packageId, request.version === 1 ? 'run' : 'update');
      } else if (request.action === 'prepare-restart') {
        // 重启前清除本次回执，保留仍在运行的动态包，真实检验新进程的状态收敛。
        clearTimeout(timeout); await releaseHold();
      } else if (request.action === 'cleanup') {
        await ctx.dynamicCordisRunner.undefine(agent, receipt.pluginId);
        clearTimeout(timeout); await releaseHold();
      }
      else if (request.action !== 'inspect' && request.action !== 'hold') throw Error('Unexpected verification action');
      const inventory = ctx.dynamicCordisRunner.inventory().filter(row => row.pluginId === receipt.pluginId);
      await writeFile(output, JSON.stringify({ id: request.id, result, inventory, audit }));
    } catch (error) {
      if (error.code !== 'ENOENT') await writeFile(output, JSON.stringify({ id: seen, error: error.message }));
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 150);
  // 验证脚本意外退出也有本地上限；不把原模型路由替换成测试实现。
  ctx.effect(() => async () => {
    closed = true; clearInterval(timer); clearTimeout(timeout);
    if (owner) await ctx.dynamicCordisRunner.undefine(owner, receipt.pluginId);
    await releaseHold();
  });
}
