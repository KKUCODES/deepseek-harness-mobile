import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

// 收权会关闭旧连接；单独恢复入口不再授权或触碰提供方配置。
if (process.argv.includes('--restore')) {
  const report = { at: new Date().toISOString(), errors: [] };
  let device;
  try {
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
    assert.ok(device);
    const context = (await (await androidAppWebView(device)).page()).context();
    const page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
    const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
    if (await reconnect.isVisible()) await reconnect.click();
    const main = page.getByTestId('remote-workspace'); await main.waitFor();
    if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
      await main.locator('.connection-dot.online').waitFor();
      await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    }
    report.title = await main.locator('.remote-heading strong').innerText();
    assert.equal(report.title, 'DSHM Remote 联调提示');
    const replies = main.getByRole('article', { name: '模型回复', exact: true });
    await replies.nth(15).waitFor(); report.replies = await replies.count(); assert.equal(report.replies, 16);
    report.draftEmpty = !(await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim();
    assert.equal(report.draftEmpty, true);
    report.alerts = await page.getByRole('alert').allTextContents(); assert.deepEqual(report.alerts, []);
    report.model = await main.locator('[aria-label^="选择模型，当前 "]').getAttribute('aria-label');
    assert.equal(report.model, '选择模型，当前 DeepSeek-V4-Pro');
    const api = await localDesktopManagement();
    const identity = (await api()).devices.filter(item => item.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
    assert.equal(identity.length, 1); assert.equal(identity[0].status, 'active'); assert.equal(identity[0].management, false);
    report.chatAuthorizationRetained = true; report.managementWithdrawn = true;
    assert.deepEqual(report.errors, []);
  } catch (error) { report.failure = error.message; process.exitCode = 1; }
  finally {
    await writeFile('artifacts/compat-templates-restored-android.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    if (device) await device.close();
  }
} else {

// 正式手机设置路径，只操作本次独立路由；不配置Key、不发现模型、不发送模型请求。
const cleanupOnly = process.argv.includes('--cleanup');
const seedPath = 'artifacts/compat-templates-seed.json';
const prior = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
assert.ok(cleanupOnly ? prior && !prior.cleaned : !prior || prior.cleaned || !prior.attempted, 'Resolve the existing test route before a new run');
const seed = cleanupOnly ? prior : { provider: `dshm-compat-check-${randomUUID().slice(0, 8)}`, attempted: false, cleaned: false };
assert.match(seed.provider, /^dshm-compat-check-[a-f0-9]{8}$/);
const report = { at: new Date().toISOString(), provider: seed.provider, stage: 'connect', checks: [], errors: [] };
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const button = (root, name) => root.getByRole('button', { name, exact: true });
const expand = async root => { if (!await root.evaluate(node => node.open)) await root.locator('summary').click(); };
async function until(read, expected) {
  let value;
  for (let i = 0; i < 100; i++) {
    value = await read();
    if (JSON.stringify(value) === JSON.stringify(expected)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.deepEqual(value, expected);
}
const providerTemplate = { enabled: { $var: 'thinking.enabled', omitWhenOff: true }, count: 2, blank: null, label: '手机模板', flag: false };
const modelTemplate = { effort: { $var: 'thinking.effort' }, budget: { $var: 'thinking.budget' }, count: 3, flag: true };
let device, api, identity, page, dialog, directory, picker, draft;
async function cleanRoute() {
  if (!seed.attempted || seed.cleaned) return;
  assert.ok(picker, 'Cleanup needs the real provider directory');
  await button(directory, '刷新提供方').click();
  await picker.waitFor();
  const option = picker.locator(`option[value="${seed.provider}"]`);
  await option.waitFor({ state: 'attached' });
  await picker.selectOption(seed.provider);
  const removal = directory.getByRole('region', { name: '移除提供方', exact: true });
  await button(removal, '移除提供方').click();
  await removal.getByText(`(${seed.provider})`, { exact: true }).waitFor();
  await button(removal, '确认移除').click();
  await option.waitFor({ state: 'detached' });
  seed.cleaned = true; await persist(); report.cleaned = true;
}
try {
  api = await localDesktopManagement();
  const matches = (await api()).devices.filter(item => item.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
  assert.equal(matches.length, 1); identity = matches[0];
  assert.equal(identity.name, 'DSHM Android'); assert.equal(identity.status, 'active');
  assert.equal(identity.management, false);
  await api({ action: 'management', deviceId: identity.id, enabled: true });
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
  assert.ok(device); device.setDefaultTimeout(20000);
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  draft = await editor.innerHTML();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
  if (!cleanupOnly) {
    report.stage = 'create'; await persist();
    const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
    await button(creation, '新增模型提供方').click();
    await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
    await creation.getByRole('textbox', { name: '提供方标识', exact: true }).fill(seed.provider);
    await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
    await creation.getByRole('textbox', { name: '服务地址', exact: true }).fill('https://dshm-compat-check.invalid/v1');
    await creation.getByRole('textbox', { name: '模型 ID 1', exact: true }).fill('compat-check-model');
    await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
    await button(creation, '核对提供方').click();
    seed.attempted = true; await persist();
    await button(creation, '确认新增').click();
    await button(creation, '查看提供方设置').click();
    const form = directory.locator('.remote-provider-form');
    const common = form.locator('form .remote-model-compat');
    const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
    const own = models.locator('.remote-model-compat');
    const openModels = async () => {
      const toggle = button(models, '编辑模型清单');
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      await own.waitFor(); await expand(own);
    };
    const template = (root, suffix) => root.getByRole('textbox', { name: `聊天模板参数 ${suffix}`, exact: true });
    const args = (root, suffix) => root.getByRole('textbox', { name: `Baseten 模板参数 ${suffix}`, exact: true });
    const select = (root, label, suffix) => root.getByRole('combobox', { name: `${label} ${suffix}`, exact: true });
    report.stage = 'provider-save';
    await common.waitFor(); await expand(common);
    await select(common, '思考参数格式', '提供方').selectOption('chat-template');
    await select(common, '输出容量参数名', '提供方').selectOption('max_tokens');
    await common.getByLabel('调度优先级 提供方', { exact: true }).fill('-2');
    await template(common, '提供方').fill(JSON.stringify(providerTemplate));
    await args(common, '提供方').fill(JSON.stringify({ provider: true }));
    await button(form.locator('form'), '保存到电脑').click();
    await form.locator(':scope > [role="status"]').filter({ hasText: '已保存到电脑。' }).waitFor();
    await button(form, '重新读取设置').click();
    await until(async () => JSON.parse(await template(common, '提供方').inputValue()), providerTemplate);
    assert.equal(await common.getByLabel('调度优先级 提供方', { exact: true }).inputValue(), '-2');
    report.checks.push('provider-template-saved-and-reread');
    report.stage = 'model-save';
    await openModels();
    await select(own, '思考参数格式', '1').selectOption('baseten');
    await select(own, '输出容量参数名', '1').selectOption('max_completion_tokens');
    await own.getByLabel('调度优先级 1', { exact: true }).fill('3');
    await template(own, '1').fill(JSON.stringify(modelTemplate));
    await args(own, '1').fill(JSON.stringify({ model: true, empty: null }));
    await button(models, '保存模型清单').click();
    await until(() => button(models, '重新读取模型清单').isEnabled(), true);
    report.modelSaveNotices = await models.getByRole('status').allTextContents();
    await button(models, '重新读取模型清单').click();
    await until(() => button(models, '重新读取模型清单').isEnabled(), true);
    await own.waitFor(); await expand(own);
    await until(async () => JSON.parse(await template(own, '1').inputValue()), modelTemplate);
    report.checks.push('model-template-saved-and-reread');
    report.stage = 'reenter';
    // 提供方卡片按路由保留草稿：取消选择会隐藏表单，不能要求它卸载。
    await picker.selectOption(''); await form.waitFor({ state: 'hidden' });
    await picker.selectOption(seed.provider);
    await common.waitFor(); await expand(common);
    await until(async () => JSON.parse(await template(common, '提供方').inputValue()), providerTemplate);
    await openModels();
    await until(async () => JSON.parse(await template(own, '1').inputValue()), modelTemplate);
    assert.deepEqual(JSON.parse(await args(common, '提供方').inputValue()), { provider: true });
    assert.deepEqual(JSON.parse(await args(own, '1').inputValue()), { model: true, empty: null });
    assert.equal(await select(own, '思考参数格式', '1').inputValue(), 'baseten');
    assert.equal(await select(common, '思考参数格式', '提供方').inputValue(), 'chat-template');
    await page.screenshot({ path: 'artifacts/compat-templates-reentered.png' });
    report.checks.push('provider-and-model-values-persist-independently-after-reentry');
    report.stage = 'restore-model-inheritance';
    await button(own, '恢复本模型兼容设置').click(); await button(models, '保存模型清单').click();
    await until(() => button(models, '重新读取模型清单').isEnabled(), true);
    await button(models, '重新读取模型清单').click();
    await until(() => button(models, '重新读取模型清单').isEnabled(), true);
    await own.waitFor(); await expand(own);
    await until(async () => JSON.parse(await template(own, '1').inputValue() || '{}'), {});
    assert.equal(await select(own, '思考参数格式', '1').inputValue(), '');
    await button(form, '重新读取设置').click();
    await until(async () => JSON.parse(await template(common, '提供方').inputValue()), providerTemplate);
    report.checks.push('restoring-model-inheritance-keeps-provider-template');
    report.stage = 'restore-provider-inheritance';
    await button(common, '恢复提供方兼容设置').click(); await button(form.locator('form'), '保存到电脑').click();
    await form.locator(':scope > [role="status"]').filter({ hasText: '已保存到电脑。' }).waitFor();
    await button(form, '重新读取设置').click();
    await until(async () => (await template(common, '提供方').inputValue()), '');
    assert.equal(await args(common, '提供方').inputValue(), '');
    assert.equal(await select(common, '思考参数格式', '提供方').inputValue(), '');
    assert.equal(await common.getByLabel('调度优先级 提供方', { exact: true }).inputValue(), '');
    report.checks.push('restoring-provider-inheritance-clears-template-overrides');
  }
  report.stage = 'cleanup'; await cleanRoute();
  await button(dialog, '关闭窗口').click();
  assert.equal(await editor.innerHTML(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (seed.attempted && !seed.cleaned) {
    await cleanRoute().catch(error => { report.cleanupFailure = error.message; process.exitCode = 1; });
  }
  if (dialog && await dialog.isVisible().catch(() => false)) await button(dialog, '关闭窗口').click().catch(() => {});
  if (api && identity) {
    await api({ action: 'management', deviceId: identity.id, enabled: false });
    const restored = (await api()).devices.find(item => item.id === identity.id);
    assert.equal(restored?.management, false); assert.equal(restored?.status, 'active');
    report.managementWithdrawn = true;
  }
  await writeFile(`artifacts/compat-templates-${cleanupOnly ? 'cleanup' : 'run'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
}
