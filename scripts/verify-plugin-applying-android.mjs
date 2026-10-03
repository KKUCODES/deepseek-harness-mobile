import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';

/** 真实原管理器进入 applying 后，从重建页面的电脑回执发起取消；测试插件只延长 HMR 排队。 */
export async function verifyApplyingCancellation({ page, manager, dialog, report }) {
  const profile = process.env.DSHM_PROFILE_DIR; assert.ok(profile);
  const { parse } = createRequire(new URL('../../plugin/package.json', import.meta.url))('yaml');
  const names = ['applying-gate-verification', 'applying-target-verification'];
  const packageName = name => `@dsh-mobile/${name}`;
  const spec = name => resolve(`artifacts/dsh-mobile-${name}-0.0.1.tgz`).replaceAll('\\', '/');
  const base = resolve('artifacts/plugin-applying-gate');
  const token = randomUUID();
  const originals = Object.fromEntries(await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].map(async name =>
    [name, parse(await readFile(join(profile, name), 'utf8'))])));
  for (const name of names) assert.equal(originals['package.json'].dependencies?.[packageName(name)], undefined);
  const openManager = async () => {
    await page.getByTestId('remote-workspace').waitFor();
    if (!await manager.count()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    }
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
  };
  const startInstall = async name => {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const install = page.getByRole('dialog');
    await install.getByRole('textbox', { name: '包名或地址', exact: true }).fill(spec(name));
    await install.getByRole('button', { name: '安装', exact: true }).click();
    return install;
  };
  const readGate = async () => { try { return JSON.parse(await readFile(`${base}.status.json`, 'utf8')); } catch { return null; } };
  try {
    const install = await startInstall(names[0]);
    await install.getByRole('button', { name: '立即启用', exact: true }).click({ timeout: 60000 });
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await manager.getByRole('button', { name: `查看 ${names[0]}`, exact: true }).click();
    await page.waitForFunction(name => {
      const toggle = document.querySelector(`[aria-label="启用 ${name}"]`);
      return toggle?.getAttribute('aria-checked') === 'true' && !toggle.disabled;
    }, names[0]);
    await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    report.helperEnabled = true;
    await writeFile(`${base}.arm.json`, JSON.stringify({ token, expiresAt: Date.now() + 85000 }));
    const target = await startInstall(names[1]);
    const by = Date.now() + 25000;
    let gate;
    while (Date.now() < by) {
      gate = await readGate();
      if (gate?.token === token) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(gate?.token, token); assert.equal(gate.state, 'holding');
    await target.locator('[data-install-phase="applying"]').waitFor();
    report.actualApplyingObserved = true;
    report.requestId = gate.requestId;
    await page.screenshot({ path: 'artifacts/plugin-manager-install-applying-running-android.png' });
    // 原弹窗在 applying 禁止关闭。页面重建是已经支持的恢复入口，不强点遮罩后的按钮。
    await page.reload();
    await openManager();
    await manager.getByText('最近插件操作', { exact: true }).click();
    const pending = manager.locator('[data-operation-state="pending"]').filter({ hasText: spec(names[1]) });
    await pending.waitFor(); assert.equal(await pending.count(), 1);
    await pending.getByRole('button', { name: '取消此次安装', exact: true }).click();
    const notice = manager.getByText('插件正在应用，已无法取消，请等待结果。', { exact: true });
    await notice.waitFor();
    await manager.getByRole('button', { name: '刷新操作记录', exact: true }).click();
    await new Promise(resolve => setTimeout(resolve, 2500));
    assert.equal(await notice.isVisible(), true);
    assert.equal(await pending.count(), 1);
    assert.equal((await readGate()).state, 'holding');
    report.tooLateRemainsVisibleAfterRefresh = true;
    await page.screenshot({ path: 'artifacts/plugin-manager-install-applying-too-late-android.png' });
    await writeFile(`${base}.release.json`, JSON.stringify({ token }));
    const completed = manager.locator('[data-operation-state="complete"]').filter({ hasText: spec(names[1]) });
    await completed.getByText('已完成', { exact: true }).waitFor();
    await notice.waitFor({ state: 'detached' });
    assert.equal(await completed.count(), 1);
    report.finalAppliedReceipt = true;
    await manager.getByRole('button', { name: '刷新', exact: true }).click();
    await manager.getByRole('button', { name: `查看 ${names[1]}`, exact: true }).click();
    const disabledTarget = manager.getByRole('switch', { name: `启用 ${names[1]}`, exact: true });
    assert.equal(await disabledTarget.getAttribute('aria-checked'), 'false');
    report.targetInstalledWithoutEnabling = true;
    await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
    await page.screenshot({ path: 'artifacts/plugin-manager-install-applying-complete-android.png' });
  } finally {
    await writeFile(`${base}.release.json`, JSON.stringify({ token }));
    // 无论验收断言是否通过，先释放队列，再按正常管理入口卸载本次创建的两个包。
    await page.reload(); await openManager();
    for (const name of [...names].reverse()) {
      const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
      if (!manifest.dependencies?.[packageName(name)]) continue;
      await manager.getByRole('button', { name: '刷新', exact: true }).click();
      await manager.getByRole('button', { name: `查看 ${name}`, exact: true }).click();
      await manager.getByRole('button', { name: `卸载 ${name}`, exact: true }).click();
      const confirm = page.getByRole('dialog', { name: `卸载「${name}」？`, exact: true });
      await confirm.getByRole('button', { name: '卸载', exact: true }).click();
      await confirm.waitFor({ state: 'detached' });
      await manager.locator(`[data-plugin-package="${packageName(name)}"]`).waitFor({ state: 'detached' });
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    }
    report.testPackagesRemoved = true;
    for (const [name, before] of Object.entries(originals)) assert.deepEqual(parse(await readFile(join(profile, name), 'utf8')), before, `${name}应恢复原内容`);
    report.profileRestored = true;
    for (const suffix of ['arm', 'release', 'status']) await unlink(`${base}.${suffix}.json`).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
