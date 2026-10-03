import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

/** 实际插件、原包管理、电脑资源及 MuMu Worker；不注入 Worker 替身或协议响应。 */
export async function verifyPluginWorker({ page, manager, dialog, report }) {
  const name = 'worker-lifecycle-verification', id = `@dsh-mobile/${name}`;
  const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
  const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml');
  const originals = Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name =>
    [name, parse(await readFile(join(profile, name), 'utf8'))])));
  assert.equal(originals['package.json'].dependencies?.[id], undefined);
  const workers = () => page.workers().filter(worker => worker.url().includes(`/${id}/`));
  const waitGone = async () => {
    const until = Date.now() + 10000;
    while (workers().length && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    if (workers().length) {
      const session = await page.context().newCDPSession(page);
      const { targetInfos } = await session.send('Target.getTargets');
      report.remainingTargets = targetInfos.filter(target => target.type === 'worker').map(({ url, type }) => ({ url, type }));
      await session.detach();
      report.remainingWorkerProbe = await Promise.race([
        workers()[0].evaluate(() => ({ tick })).catch(error => ({ error: error.message })),
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 2000)),
      ]);
    }
    assert.equal(workers().length, 0, '真实 Worker 调试目标必须退出');
  };
  const openManager = async () => {
    if (!await manager.count()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    }
    if (await manager.getByRole('button', { name: '返回插件列表', exact: true }).count()) await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  };
  const leaveManager = async () => {
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const openChat = async () => {
    if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) {
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    }
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  };
  const setEnabled = async enabled => {
    await openManager();
    await manager.getByRole('button', { name: `查看 ${name}`, exact: true }).click();
    const toggle = manager.getByRole('switch', { name: `启用 ${name}`, exact: true });
    assert.equal(await toggle.getAttribute('aria-checked'), String(!enabled));
    await toggle.click();
    await page.waitForFunction(({ name, enabled }) => {
      const node = document.querySelector(`[aria-label="启用 ${name}"]`);
      return node?.getAttribute('aria-checked') === String(enabled) && !node.disabled;
    }, { name, enabled });
  };
  const runWorker = async () => {
    await openChat();
    const card = page.getByTestId('live-worker-card').first();
    await card.getByRole('button', { name: '启动测试线程', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="live-worker-card"]')?.dataset.tick) >= 2);
    assert.equal(workers().length, 1);
    await card.getByRole('button', { name: '读取插件资源', exact: true }).click();
    await card.getByTestId('worker-resource-result').filter({ hasText: '"ownMarker":true' }).waitFor();
    const result = JSON.parse(await card.getByTestId('worker-resource-result').innerText());
    assert.equal(result.status, 200); assert.ok(result.bytes > 100); assert.equal(result.noBridge, true);
    (report.workerReads ??= []).push(result);
    return workers()[0].url();
  };
  let draft;
  try {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog');
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(resolve(`artifacts/dsh-mobile-${name}-0.0.1.tgz`).replaceAll('\\', '/'));
    await install.getByRole('button', { name: '安装', exact: true }).click();
    await install.getByRole('button', { name: '立即启用', exact: true }).click({ timeout: 60000 });
    await install.waitFor({ state: 'detached' });
    await leaveManager(); await openChat();
    draft = await page.getByRole('textbox', { name: '消息', exact: true }).inputValue();
    await runWorker();
    await page.screenshot({ path: 'artifacts/plugin-worker-running-android.png' });
    await setEnabled(false); await waitGone();
    assert.equal(await page.getByTestId('live-worker-card').count(), 0); report.disabledWorkerDisposed = true;
    await setEnabled(true); await leaveManager();
    const workerUrl = await runWorker();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑连接', exact: true }).click();
    await page.getByRole('button', { name: '断开连接', exact: true }).click();
    await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
    await waitGone(); assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    report.disconnectedWorkerDisposed = true;
    report.disconnectedResource = await page.evaluate(async url => {
      try { const response = await fetch(url, { cache: 'no-store' }); return { status: response.status, bytes: (await response.arrayBuffer()).byteLength }; }
      catch { return { networkFailure: true }; }
    }, workerUrl);
    assert.deepEqual(report.disconnectedResource, { status: 502, bytes: 0 });
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor();
    await runWorker(); report.reconnectedWorkerStarted = true;
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), draft);
  } catch (error) {
    report.primaryFailure = error.message;
    throw error;
  } finally {
    if (await page.getByRole('button', { name: '重新连接', exact: true }).count()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
    const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
    if (manifest.dependencies?.[id]) {
      // 页面重建也释放测试线程；只在失败遗留安装弹窗时使用，正常卸载保持线程正在运行。
      if (await page.locator('[data-install-phase]').count()) await page.reload();
      await page.getByTestId('remote-workspace').waitFor(); await openManager();
      await manager.getByRole('button', { name: `查看 ${name}`, exact: true }).click();
      await manager.getByRole('button', { name: `卸载 ${name}`, exact: true }).click();
      const confirm = page.getByRole('dialog', { name: `卸载「${name}」？`, exact: true });
      await confirm.getByRole('button', { name: '卸载', exact: true }).click();
      await confirm.waitFor({ state: 'detached' });
      // 确认框先关闭，实际卸载异步完成后才回列表；不能把卡片撤下当作磁盘写入结束。
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
      assert.equal(await manager.getByRole('button', { name: `查看 ${name}`, exact: true }).count(), 0);
      await manager.locator(`[data-plugin-package="${id}"]`).waitFor({ state: 'detached' });
      try {
        await waitGone(); assert.equal(await page.getByTestId('live-worker-card').count(), 0);
        report.uninstalledWorkerDisposed = true;
      } catch (error) {
        report.cleanupFailure = error.message;
      }
    }
    for (const [name, original] of Object.entries(originals)) assert.deepEqual(parse(await readFile(join(profile, name), 'utf8')), original, `${name}应恢复`);
    report.profileRestored = true;
    if (report.cleanupFailure && !report.primaryFailure) throw new Error(report.cleanupFailure);
  }
}
