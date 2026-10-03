import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 真实App入口；仅修改本脚本新建的提供方，不调用模型、读取Key或改变授权。
// 未确认的创建不重发；保留seed供显式cleanup核对，避免误删其他路由。
const phase = process.argv[2] ?? 'probe';
assert.ok(['probe', 'run', 'cleanup'].includes(phase));
if (phase !== 'probe') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = 'artifacts/provider-management-live-seed.json';
const report = { at: new Date().toISOString(), phase, stage: 'connect', checks: [], errors: [], resources: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
let seed, page, directory, picker, nativeOpen = false;
const button = (root, name) => root.getByRole('button', { name, exact: true });
const expand = async details => { if (!await details.evaluate(node => node.open)) await details.locator('summary').click(); };
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
async function nativeCancel(route) {
  await device.shell('uiautomator dump /data/local/tmp/dshm-provider-key.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-provider-key.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
  assert.ok(nodes.some(node => node.text?.includes(route)), 'Native title must identify our test provider');
  assert.ok(nodes.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  const cancel = nodes.filter(node => node.text === '取消' && node.class === 'android.widget.Button');
  assert.equal(cancel.length, 1);
  const points = cancel[0].bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`);
  nativeOpen = false;
}
async function cleanup() {
  assert.match(seed?.provider ?? '', /^dshm-management-check-[a-f0-9]{8}$/);
  await button(directory, '刷新提供方').click();
  await picker.waitFor();
  const option = picker.locator(`option[value="${seed.provider}"]`);
  await option.waitFor({ state: 'attached' }); // 原生select的option不单独可见；仍等真实目录包含本轮路由。
  await picker.selectOption(seed.provider);
  const removal = directory.getByRole('region', { name: '移除提供方', exact: true });
  await button(removal, '移除提供方').click();
  await removal.getByText(`(${seed.provider})`, { exact: true }).waitFor();
  await button(removal, '确认移除').click();
  await option.waitFor({ state: 'detached' });
  seed.cleaned = true; await persist(); report.cleaned = true;
}
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, 'Open the existing DSHM Remote session before this test');
  page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const reconnect = button(page, '重新连接');
  if (await reconnect.isVisible()) { await reconnect.click(); report.reconnectedAfterPermissionChange = true; }
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.evaluate(node => node.textContent);
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const denied = dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true });
  await dialog.waitFor();
  report.management = !await denied.isVisible();
  if (report.management) {
    directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
    await button(directory, '其他模型提供方').click();
    picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
    await button(directory, '新增模型提供方').waitFor();
  }
  if (phase !== 'probe') {
    assert.equal(report.management, true, 'Desktop management grant is required; no mutation attempted');
    const previous = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (phase === 'cleanup') { seed = previous; report.stage = 'cleanup'; await cleanup(); }
    else {
      assert.ok(!previous || previous.cleaned, 'A previous test provider needs explicit cleanup first');
      seed = { provider: `dshm-management-check-${randomUUID().slice(0, 8)}`, created: false, cleaned: false, at: report.at };
      report.provider = seed.provider; await persist();
      const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
      report.stage = 'create';
      await button(creation, '新增模型提供方').click();
      await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
      await creation.getByRole('textbox', { name: '提供方标识', exact: true }).fill(seed.provider);
      await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
      await creation.getByRole('textbox', { name: '服务地址', exact: true }).fill('https://dshm-management-check.invalid/v1');
      await creation.getByRole('textbox', { name: '模型 ID（每行一个）', exact: true }).fill('test-model');
      await creation.getByRole('textbox', { name: '显示名称（可选）', exact: true }).fill('DSHM 专用管理验收');
      await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
      await button(creation, '核对提供方').click();
      await creation.getByRole('group', { name: '确认新增提供方', exact: true }).waitFor();
      seed.attempted = true; await persist();
      await button(creation, '确认新增').click();
      await creation.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      seed.created = true; await persist();
      await button(creation, '查看提供方设置').click();
      const form = directory.locator('.remote-provider-form');
      await form.getByLabel('提供方名称', { exact: true }).waitFor();
      assert.equal(await picker.inputValue(), seed.provider);
      report.checks.push('Custom provider created through the real Android settings page');
      report.stage = 'basic-settings';
      await form.getByLabel('请求超时（毫秒）', { exact: true }).fill('45678');
      const commonCompat = form.locator('form .remote-model-compat');
      await commonCompat.locator('summary').click();
      await commonCompat.getByRole('combobox', { name: '支持保存请求 提供方', exact: true }).selectOption('false');
      await button(form.locator('form'), '保存到电脑').click();
      await form.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      await button(form, '重新读取设置').click();
      await button(form, '重新读取设置').waitFor();
      await form.getByLabel('请求超时（毫秒）', { exact: true }).waitFor();
      assert.equal(await form.getByLabel('请求超时（毫秒）', { exact: true }).inputValue(), '45678');
      assert.equal(await commonCompat.getByRole('combobox', { name: '支持保存请求 提供方', exact: true }).inputValue(), 'false');
      report.checks.push('Provider scalar saved and reread from the computer');
      report.stage = 'model-settings';
      const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
      await button(models, '编辑模型清单').click();
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).fill('DSHM 验收模型');
      await models.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true }).fill('128K');
      await models.locator('.remote-model-capabilities:not(.remote-model-compat) summary').click();
      await models.getByRole('combobox', { name: '输入类型 1', exact: true }).selectOption('image,text');
      await models.getByRole('combobox', { name: '思考能力 1', exact: true }).selectOption('disabled');
      const modelCompat = models.locator('.remote-model-compat');
      await modelCompat.locator('summary').click();
      await modelCompat.getByRole('combobox', { name: '支持保存请求 1', exact: true }).selectOption('true');
      report.stage = 'model-save';
      await button(models, '保存模型清单').click();
      await models.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      report.stage = 'model-reread';
      await button(models, '重新读取模型清单').click();
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
      assert.equal(await models.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), 'DSHM 验收模型');
      await expand(models.locator('.remote-model-capabilities:not(.remote-model-compat)'));
      await expand(modelCompat);
      assert.equal(await models.getByRole('combobox', { name: '输入类型 1', exact: true }).inputValue(), 'image,text');
      assert.equal(await models.getByRole('combobox', { name: '思考能力 1', exact: true }).inputValue(), 'disabled');
      assert.equal(await modelCompat.getByRole('combobox', { name: '支持保存请求 1', exact: true }).inputValue(), 'true');
      report.checks.push('Model name, capacity and input/reasoning capabilities saved and reread');
      report.stage = 'endpoint';
      const endpoint = form.getByRole('region', { name: '电脑模型服务地址', exact: true });
      await button(endpoint, '重新读取服务地址').click();
      await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill('https://dshm-management-second.invalid/v1');
      await button(endpoint, '核对新地址').click(); await button(endpoint, '取消更改地址').click();
      await endpoint.getByText('https://dshm-management-check.invalid', { exact: true }).waitFor();
      await button(endpoint, '核对新地址').click(); await button(endpoint, '确认更改服务地址').click();
      await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).waitFor();
      await button(endpoint, '重新读取服务地址').click();
      await endpoint.getByText('https://dshm-management-second.invalid', { exact: true }).waitFor();
      report.checks.push('Dedicated test endpoint cancel, save and reread; no model request');
      report.stage = 'reenter';
      await picker.selectOption(''); await picker.selectOption(seed.provider);
      await form.getByLabel('请求超时（毫秒）', { exact: true }).waitFor();
      assert.equal(await form.getByLabel('请求超时（毫秒）', { exact: true }).inputValue(), '45678');
      await endpoint.getByText('https://dshm-management-second.invalid', { exact: true }).waitFor();
      await button(models, '编辑模型清单').click();
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
      assert.equal(await models.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), 'DSHM 验收模型');
      const capacity = await models.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true }).inputValue();
      assert.ok(['128000', '128K', '128k'].includes(capacity));
      await expand(models.locator('.remote-model-capabilities:not(.remote-model-compat)'));
      await expand(modelCompat); await expand(commonCompat);
      assert.equal(await models.getByRole('combobox', { name: '输入类型 1', exact: true }).inputValue(), 'image,text');
      assert.equal(await models.getByRole('combobox', { name: '思考能力 1', exact: true }).inputValue(), 'disabled');
      assert.equal(await commonCompat.getByRole('combobox', { name: '支持保存请求 提供方', exact: true }).inputValue(), 'false');
      assert.equal(await modelCompat.getByRole('combobox', { name: '支持保存请求 1', exact: true }).inputValue(), 'true');
      report.checks.push('Reentering the provider rereads saved scalar, endpoint, model and capabilities');
      report.stage = 'compat-inheritance';
      await expand(modelCompat);
      await button(modelCompat, '恢复本模型兼容设置').click();
      await button(models, '保存模型清单').click();
      await models.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      await button(models, '重新读取模型清单').click();
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
      await expand(modelCompat);
      assert.equal(await modelCompat.getByRole('combobox', { name: '支持保存请求 1', exact: true }).inputValue(), '');
      // 模型保存改变配置revision；先重读提供方，不能拿此前快照提交覆盖。
      await button(form, '重新读取设置').click();
      await form.getByLabel('请求超时（毫秒）', { exact: true }).waitFor();
      if (!await commonCompat.evaluate(node => node.open)) await commonCompat.locator('summary').click();
      await button(commonCompat, '恢复提供方兼容设置').click();
      await button(form.locator('form'), '保存到电脑').click();
      await form.locator(':scope > [role="status"]').filter({ hasText: '已保存' }).waitFor();
      await button(form, '重新读取设置').click();
      await form.getByLabel('请求超时（毫秒）', { exact: true }).waitFor();
      assert.equal(await commonCompat.getByRole('combobox', { name: '支持保存请求 提供方', exact: true }).inputValue(), '');
      report.checks.push('Provider and per-model compatibility values reread independently; restoring inheritance clears each override');
      report.stage = 'key-setup';
      await button(form, '重新读取设置').click();
      const setup = form.getByRole('region', { name: '启用提供方 API Key', exact: true });
      await button(setup, '启用 API Key').click(); await button(setup, '取消').click();
      await button(setup, '启用 API Key').click(); await button(setup, '确认启用 API Key').click();
      const key = form.getByRole('region', { name: '电脑提供方 Key', exact: true });
      await key.getByText('尚未配置', { exact: true }).waitFor();
      await button(key, '管理电脑 Key').click(); nativeOpen = true;
      await nativeCancel(seed.provider);
      await key.getByText('尚未配置', { exact: true }).waitFor();
      report.checks.push('Independent Key configuration enabled; native password dialog cancelled without saving a Key');
      await page.screenshot({ path: 'artifacts/provider-management-live-android.png' });
      report.stage = 'cleanup'; await cleanup();
    }
  }
  await button(page, '关闭窗口').click();
  assert.equal(await editor.evaluate(node => node.textContent), draft);
  report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  report.ok = phase === 'probe' ? report.management : report.cleaned === true;
} catch (error) {
  report.failure = error.name;
  report.failureDetail = error.message;
  if (page && seed?.created) {
    const modelView = page.getByRole('region', { name: '编辑模型清单', exact: true });
    if (await modelView.count() === 1) report.modelView = await modelView.innerText();
  }
  if (seed?.attempted && !seed.cleaned) report.cleanupRequired = seed.provider;
  throw new Error(`Provider management ${phase} failed at ${report.stage}: ${error.name}`);
} finally {
  if (nativeOpen) await device.shell('input keyevent 4').catch(() => {});
  await device.shell('rm -f /data/local/tmp/dshm-provider-key.xml').catch(() => {});
  await writeFile(`artifacts/provider-management-${phase}-android.json`, JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
