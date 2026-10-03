import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅登记未配置的内置目录；候选只加入草稿，不保存模型设置或调用模型。
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), checks: [], errors: [] };
const name = `DSHM 候选搜索验收 ${randomUUID().slice(0, 8)}`;
const button = (root, text) => root.getByRole('button', { name: text, exact: true });
let directory, picker, created = false;
async function cleanup() {
  if (!created) return;
  await picker.selectOption('openai');
  const form = directory.locator('.remote-provider-form:visible');
  assert.equal(await form.getByLabel('提供方名称', { exact: true }).inputValue(), name);
  await button(form, '移除提供方').click();
  await button(form, '确认移除').click();
  await picker.locator('option[value="openai"]').waitFor({ state: 'detached' });
  created = false; report.cleaned = true;
}
try {
  const ordinary = await (await androidAppWebView(device)).page();
  const context = ordinary.context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const opened = context.waitForEvent('page');
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
    page = await opened;
  }
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const chat = main.getByRole('textbox', { name: '消息', exact: true });
  await chat.waitFor(); const draft = await chat.innerHTML();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  const panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  directory = panel.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
  const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
  await button(creation, '新增模型提供方').click();
  await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('catalog');
  const available = creation.getByRole('combobox', { name: '选择内置提供方', exact: true });
  assert.equal(await available.locator('option[value="openai"]').count(), 1, '只能使用未配置的内置目录');
  await available.selectOption('openai');
  await creation.getByLabel('显示名称（可选）', { exact: true }).fill(name);
  await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
  await button(creation, '核对提供方').click(); await button(creation, '确认新增').click();
  await button(creation, '查看提供方设置').waitFor(); created = true;
  await button(creation, '查看提供方设置').click();
  const form = directory.locator('.remote-provider-form:visible');
  for (const [title, reread] of [['编辑内置模型覆盖', '重新读取模型覆盖'], ['编辑模型清单', '重新读取模型清单']]) {
    const region = form.getByRole('region', { name: title, exact: true });
    await button(region, title).click(); await button(region, '获取可用模型').click();
    const candidates = region.locator('.remote-model-candidates');
    await candidates.getByRole('checkbox').first().waitFor();
    const count = await candidates.getByRole('checkbox').count(); assert.ok(count > 1);
    const label = await candidates.locator('label').first().innerText();
    const id = label.split(' · ').at(-1).trim();
    const search = candidates.getByRole('searchbox');
    await search.fill(` ${id.toUpperCase()} `);
    const matches = await candidates.getByRole('checkbox').count(); assert.ok(matches > 0);
    await button(candidates, '选择当前结果').click();
    await search.fill('dshm-no-matching-model-' + randomUUID());
    await candidates.getByText('没有匹配的模型。', { exact: true }).waitFor();
    assert.ok(await button(candidates, '选择当前结果').isDisabled());
    await candidates.getByText(`已选择的模型：${matches}`, { exact: true }).waitFor();
    await search.fill(id); await button(candidates, '取消选择当前结果').click();
    await candidates.getByText('已选择的模型：0', { exact: true }).waitFor();
    await button(candidates, '选择当前结果').click();
    await search.fill('');
    assert.equal(await candidates.getByRole('checkbox', { checked: true }).count(), matches);
    await button(candidates, '加入编辑草稿').click();
    assert.equal(await region.locator('.remote-provider-model-row').count(), matches);
    await button(region, '获取可用模型').click();
    await candidates.getByRole('searchbox').waitFor();
    assert.equal(await candidates.getByRole('checkbox').count(), count - matches);
    await button(region, reread).click();
    await candidates.waitFor({ state: 'detached' });
    assert.equal(await region.locator('.remote-provider-model-row').count(), 0);
    report.checks.push({ title, count, matches, draftDiscarded: true });
  }
  await page.screenshot({ path: 'artifacts/model-candidate-search-android.png' });
  await cleanup(); await button(panel, '关闭窗口').click();
  assert.equal(await chat.innerHTML(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} finally {
  try { await cleanup(); } catch { report.cleanupFailed = true; }
  await writeFile('artifacts/model-candidate-search-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
