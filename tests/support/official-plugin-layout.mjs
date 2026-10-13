import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const storageKey = 'dshm.remote.plugin-layout.v1';

/** 通过产品开关改变偏好；DOM与本地存储只读核对，不注入布局状态。 */
export async function verifyOfficialPluginLayout({ page, device, evidence, plugins, surface, title, mark }) {
  const report = { phases: [] }, id = plugins.packageName;
  const main = page.getByTestId('remote-workspace'), dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  const local = page.getByTestId('live-panel');
  const preferences = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey);
  const geometry = async (phase, enabled) => {
    const frame = local.locator('xpath=ancestor::*[@data-plugin-frame][1]');
    await frame.waitFor();
    assert.equal(await frame.getAttribute('data-auto-fit'), String(enabled));
    await page.waitForFunction(({ id, enabled }) => {
      const node = document.querySelector('[data-testid="live-panel"]');
      if (!node) return false;
      const width = node.getBoundingClientRect().width;
      return enabled ? width < 720 && width <= innerWidth : Math.abs(width - 720) < 1;
    }, { id, enabled });
    const measured = await local.evaluate(node => ({ original: node.offsetWidth,
      displayed: node.getBoundingClientRect().width, viewport: innerWidth,
      frameWidth: node.closest('[data-plugin-frame]').clientWidth,
      internalStyle: node.getAttribute('style') }));
    assert.equal(measured.original, 720);
    assert.equal(await page.locator('iframe').count(), 0);
    report.phases.push({ phase, enabled, ...measured });
    return measured;
  };
  const openPreferences = async () => {
    await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '电脑插件', exact: true }).click();
    const row = dialog.locator(`[data-plugin-id="${id}"]`);
    await row.waitFor();
    assert.equal(await row.getAttribute('data-plugin-state'), 'active');
    return row;
  };
  const openPanel = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '插件面板', exact: true }).click();
    const tab = surface.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true });
    if (await tab.count()) await tab.click();
    else {
      // 页面重建后标签布局不沿用旧内存；从插件的真实指南入口重新打开。
      await surface.locator('nav').getByRole('button', { name: '打开面板', exact: true }).click();
      const entry = surface.locator('[data-sidebar-right-guide-entry="dshm-verification-panel"]');
      await entry.getByText('DSHM 面板验收', { exact: true }).waitFor();
      await entry.click();
    }
    await local.waitFor();
  };
  const returnPanel = async () => { await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click(); await openPanel(); };
  try {
    report.before = await preferences(); assert.equal(report.before[id], undefined);
    const baseline = await geometry('author-default-off', false);
    let row = await openPreferences();
    let toggle = row.getByRole('switch', { name: id + ' 自适应', exact: true });
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    assert.equal(await row.getByRole('button', { name: '恢复插件默认', exact: true }).count(), 0);
    await toggle.click(); assert.equal((await preferences())[id], true);
    await returnPanel(); await geometry('user-overrides-author-on', true);
    await local.getByRole('button', { name: '面板计数 0', exact: true }).click();
    row = await openPreferences(); toggle = row.getByRole('switch', { name: id + ' 自适应', exact: true });
    await toggle.click(); assert.equal((await preferences())[id], false);
    await returnPanel(); await geometry('explicit-user-off', false);
    await local.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
    row = await openPreferences(); await row.getByRole('button', { name: '恢复插件默认', exact: true }).click();
    assert.equal((await preferences())[id], undefined);
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'false');
    assert.equal(await row.getByRole('button', { name: '恢复插件默认', exact: true }).count(), 0);
    await returnPanel(); await geometry('reset-to-author-off', false);
    row = await openPreferences(); await row.getByRole('switch').click();
    await returnPanel(); await geometry('persisted-user-on-before-reconnect', true);
    await plugins.layout.disconnect(); await page.getByTestId('remote-offline-status').waitFor();
    await plugins.layout.reconnect(); await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    await geometry('reconnected-user-on', true);
    assert.equal((await preferences())[id], true);
    // 重建真实手机页面和布局服务，验证持久化值，而非同一内存对象的保持。
    await page.reload({ waitUntil: 'domcontentloaded' });
    await main.waitFor({ timeout: 60000 });
    const session = main.locator('.remote-session-row').filter({ hasText: title });
    if (await session.count()) await session.click();
    await main.locator('[data-composer-input]').waitFor();
    assert.equal(await main.locator('[data-composer-input]').innerText(), 'OFFICIAL_PLUGIN_DRAFT');
    await openPanel(); await geometry('rebuilt-page-user-on', true);
    await local.getByRole('button', { name: '面板计数 0', exact: true }).waitFor();
    row = await openPreferences(); assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'true');
    await row.getByRole('button', { name: '恢复插件默认', exact: true }).click();
    await returnPanel(); await geometry('rebuilt-page-author-default-off', false);
    await writeFile(resolve(evidence, 'plugin-layout-default-off.png'), await device.screenshot());
    // 留给通用原插件交互验收开启状态，之后再清理用户覆盖。
    row = await openPreferences(); await row.getByRole('switch').click();
    await returnPanel(); await geometry('user-on-for-normal-local-interactions', true);
    await writeFile(resolve(evidence, 'plugin-layout-user-on.png'), await device.screenshot());
    assert.ok(report.phases.every(phase => phase.internalStyle === baseline.internalStyle));
    report.passed = true; report.authorDefaultVerified = true; report.userPriorityVerified = true;
    report.resetVerified = true; report.reconnectVerified = true; report.pageRebuildPersistenceVerified = true;
    report.internalStyleUnchanged = true; report.draftPreserved = true; report.iframeAbsent = true;
    await mark('official-plugin-author-layout-user-overrides-and-page-rebuild');
    return report;
  } finally { await writeFile(resolve(evidence, 'plugin-layout.json'), JSON.stringify(report, null, 2) + '\n'); }
}

export async function cleanOfficialPluginLayout({ page, plugins, dialog, report }) {
  const row = dialog.locator(`[data-plugin-id="${plugins.packageName}"]`);
  await row.getByRole('button', { name: '恢复插件默认', exact: true }).click();
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey);
  assert.deepEqual(stored, report.before);
  report.userPreferencesRestored = true;
}

export async function verifyOfficialPluginLayoutDisposed({ page, plugins, report, evidence }) {
  await page.waitForFunction(id => {
    const node = document.querySelector('[data-testid="remote-workspace"]');
    const key = node && Object.keys(node).find(key => key.startsWith('__reactFiber'));
    for (let fiber = key && node[key]; fiber; fiber = fiber.return) {
      const layout = fiber.memoizedProps?.model?.pluginSlots?.layout;
      if (layout) return layout.effective(id) === true && !layout.declarations.has(id) && layout.userValue(id) === undefined;
    }
    return false;
  }, plugins.packageName);
  report.authorDeclarationDisposed = true;
  await writeFile(resolve(evidence, 'plugin-layout.json'), JSON.stringify(report, null, 2) + '\n');
}
