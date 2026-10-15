import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { builtinPanelMetrics } from './check-builtin-panel-layout.mjs';

/** 真实官方配置/发布插件/生产中转；只导航和读取，不发模型消息或修改电脑配置。 */
export async function checkBuiltinPanelsAndroid({ page, main, idle, createChat, output, screenshot }) {
  await createChat();
  const modelAction = (action, args) => main.evaluate((element, { action, args }) => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (!model?.pluginPanels) continue;
      if (action === 'inventory') return { types: model.ctx.sidebarRightTabs.entries().map(row => ({ id: row.id, kind: row.kind })), global: model.globalPanels.state.getSnapshot().panels, plugins: model.getSnapshot().plugins };
      if (action === 'plan') {
        const session = model.getSnapshot().selected;
        model.pluginPanels.openResource(`dsh-resource://plan-review/${session}/layout-audit`, { params: { planReview: { title: '日常项目检查', markdown: '# 日常项目检查\n\n' + '检查文件和待处理事项。\n\n'.repeat(100) } } });
      } else if (action === 'guide') model.pluginPanels.openTab('guide');
      else if (action === 'task') model.pluginPanels.openTab('scheduleTask');
      else if (action === 'global') model.globalPanels.controller.selectPanel(args);
      else if (action === 'document') model.pluginPanels.openResource(`dsh-resource://file/session/${model.getSnapshot().selected}/${args ?? 'notes.md'}`);
      return;
    }
    throw Error('Remote model missing');
  }, { action, args });
  const inventory = await modelAction('inventory');
  const cases = [], failures = [], unavailable = [], mainInput = main.getByRole('textbox', { name: '消息', exact: true });
  await mainInput.fill('内置面板检查：保留草稿');
  const capture = async (view, surface, { bounded = true, floor = 12.9 } = {}) => {
    await surface.waitFor(); await idle();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      await idle();
      const metrics = await builtinPanelMetrics(surface);
      await writeFile(join(output, `${view}-${dark ? 'dark' : 'light'}.png`), await screenshot());
      cases.push({ view, dark, ...metrics });
      await writeFile(join(output, 'builtin-cases.json'), JSON.stringify({ inventory, cases }, null, 2));
      assert.ok(metrics.text.length > 0, view);
      if (!metrics.text.every(item => Math.abs(item.scale - 1) < 0.001)) failures.push(`${view}: scaled ${JSON.stringify(metrics.text.filter(item => item.scale < 0.999).slice(0,5))}`);
      if (!metrics.text.every(item => item.font >= floor)) failures.push(`${view}: tiny ${JSON.stringify(metrics.text.filter(item => item.font < floor).slice(0,8))}`);
      assert.ok(metrics.pageWidth <= metrics.viewport, `${view}: overflow`);
      if (bounded) assert.ok(metrics.scrollers.some(item => item.height >= 200 && item.height < metrics.viewportHeight), `${view}: height ${JSON.stringify(metrics.scrollers)}`);
    }
  };
  for (const view of ['guide', 'plan', 'task', 'document']) {
    if (view === 'task' && !inventory.types.some(item => item.kind === 'scheduleTask')) { unavailable.push('scheduleTask: original plugin not active'); continue; }
    await modelAction(view);
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    if (view === 'plan') await panel.getByRole('heading', { name: '日常项目检查', exact: true }).waitFor();
    if (view === 'document') await panel.getByRole('heading', { name: '随身推进项目', exact: true }).waitFor();
    await capture(view, panel, { bounded: view === 'plan' || view === 'document' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
  }
  const documentStates = [];
  for (const file of ['example.ts', 'image.png', 'document.pdf', 'page.html', 'document.docx', 'missing.txt']) {
    await modelAction('document', file);
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    const active = panel.locator('.remote-document-tab:not([hidden])');
    if (file === 'example.ts') await active.locator('[data-code-preview]').waitFor();
    if (file === 'image.png') await active.locator('[data-image-preview] img').waitFor();
    if (file === 'document.pdf') await active.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    if (file === 'page.html') await active.frameLocator('iframe').getByRole('heading', { name: '随身查看网页文件', exact: true }).waitFor();
    if (file === 'document.docx') await active.locator('[data-pdf-preview] canvas').first().or(active.getByRole('alert')).waitFor({ timeout: 60000 });
    if (file === 'missing.txt') await active.locator('[data-textpreview-failed]').waitFor();
    await capture(file, panel, { bounded: false });
    const geometry = await active.locator('[data-textpreview-body]').evaluate(item => ({ width: item.clientWidth, height: item.clientHeight, viewport: innerWidth, overflow: getComputedStyle(item).overflowY }));
    assert.ok(geometry.height > 200 && geometry.width <= geometry.viewport, `${file}: ${JSON.stringify(geometry)}`);
    documentStates.push({ file, ...geometry, officeConverted: file === 'document.docx' ? await active.locator('[data-pdf-preview] canvas').count() > 0 : undefined });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
  }
  for (const id of ['schedules', 'plugins']) {
    if (!inventory.global.some(item => item.id === id)) { unavailable.push(`${id}: original plugin not active`); continue; }
    await modelAction('global', id);
    const panel = page.locator('.remote-global-panel');
    await capture(id, panel);
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await idle();
  }
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const picker = settings.getByRole('combobox', { name: '设置页面', exact: true });
  assert.ok(await picker.evaluate(item => Math.abs(item.getBoundingClientRect().height - 44) < 0.5));
  const options = await picker.locator('option').evaluateAll(items => items.map(item => ({ id: item.value, label: item.textContent })));
  for (const option of options) {
    await picker.selectOption(option.id); await idle();
    await capture(`settings-${option.id}`, settings, { bounded: false });
  }
  await settings.getByRole('button', { name: '关闭窗口', exact: true }).click(); await idle();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  await page.getByRole('button', { name: '管理电脑插件', exact: true }).click();
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  await manager.locator('[data-plugin-panel]').waitFor();
  await capture('manager-entry', manager);
  await manager.getByRole('button', { name: '返回', exact: true }).click(); await idle();
  await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '插件设置', exact: true }).click(); await idle();
  const pluginSettings = page.getByRole('dialog', { name: '插件设置', exact: true });
  await capture('plugin-settings', pluginSettings, { bounded: false });
  await pluginSettings.getByRole('button', { name: '关闭窗口', exact: true }).click(); await idle();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '定时任务', exact: true }).click();
  const schedules = page.getByRole('dialog', { name: '定时任务', exact: true });
  await capture('phone-schedules', schedules, { bounded: false });
  await schedules.getByRole('button', { name: '关闭窗口', exact: true }).click(); await idle();
  assert.equal(await mainInput.innerText(), '内置面板检查：保留草稿'); await mainInput.fill('');
  await writeFile(join(output, 'builtin-cases.json'), JSON.stringify({ inventory, cases, unavailable, failures, documentStates }, null, 2));
  assert.deepEqual(failures, []);
  return { inventory, cases, settings: options, unavailable, documentStates, draftPreserved: true, publishedOriginalComponents: true, temporaryPlanNavigationOnly: true };
}
