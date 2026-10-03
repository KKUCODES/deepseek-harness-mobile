import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
const saveCheck = process.argv.includes('--save');
const validationCheck = process.argv.includes('--validation');
const modelRowsCheck = process.argv.includes('--model-rows');
let panel, directory, picker;
const ids = ['a', 'b'].map(suffix => `dshm-switch-${randomUUID().slice(0, 8)}-${suffix}`);
report.testProviders = ids;
async function cleanup() {
  if (!picker) return;
  for (const id of ids) {
    if (!await picker.locator(`option[value="${id}"]`).count()) continue;
    await picker.selectOption(id);
    const form = directory.locator('.remote-provider-form:visible');
    await form.getByRole('button', { name: '移除提供方', exact: true }).click();
    await form.getByRole('button', { name: '确认移除', exact: true }).click();
    await picker.locator(`option[value="${id}"]`).waitFor({ state: 'detached' });
  }
  report.testProvidersRemoved = true;
}
try {
  const ordinary = await (await androidAppWebView(device)).page();
  const context = ordinary.context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opened;
  }
  page.on('pageerror', () => report.errors.push('page-error'));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.isVisible()) await reconnect.click();
  const main = page.getByTestId('remote-workspace');
  await main.waitFor({ timeout: 45000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await welcome.getByRole('button', { name: '继续', exact: true }).click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const chat = main.getByRole('textbox', { name: '消息', exact: true });
  await chat.waitFor(); const original = await chat.innerHTML();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '电脑设置', exact: true }).click();
  panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  directory = panel.getByRole('region', { name: '其他模型提供方', exact: true });
  await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
  picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
  for (const id of ids) {
    if (await picker.isVisible()) await picker.selectOption('');
    const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
    await creation.getByRole('button', { name: '新增模型提供方', exact: true }).click();
    await creation.getByRole('combobox', { name: /^提供方来源/ }).selectOption('custom');
    await creation.getByLabel('提供方标识', { exact: true }).fill(id);
    await creation.getByLabel('服务地址', { exact: true }).fill('http://127.0.0.1:1');
    if (await creation.getByLabel('模型 ID 1', { exact: true }).count()) {
      await creation.getByLabel('模型 ID 1', { exact: true }).fill('dshm-switch-no-request');
      await creation.getByLabel('模型名称 1', { exact: true }).fill('DSHM structured model');
      await creation.getByLabel('上下文容量（Token） 1', { exact: true }).fill('128K');
      await creation.getByLabel('输出容量（Token） 1', { exact: true }).fill('8K');
      await creation.locator('summary').filter({ hasText: /^输入类型$/ }).click();
      await creation.getByLabel('输入类型 1', { exact: true }).selectOption('image,text');
    } else {
      assert.equal(modelRowsCheck, false, 'New Host capability must enable structured creation');
      await creation.getByLabel('模型 ID（每行一个）', { exact: true }).fill('dshm-switch-no-request');
    }
    await creation.getByRole('checkbox').uncheck();
    await creation.getByRole('button', { name: '核对提供方', exact: true }).click();
    await creation.getByRole('button', { name: '确认新增', exact: true }).click();
    await creation.getByRole('button', { name: '查看提供方设置', exact: true }).click();
    await picker.locator(`option[value="${id}"]`).waitFor({ state: 'attached' });
    if (modelRowsCheck) {
      await picker.selectOption(id);
      const editor = directory.locator('.remote-provider-form:visible').getByRole('region', { name: '编辑模型清单', exact: true });
      await editor.getByRole('button', { name: '编辑模型清单', exact: true }).click();
      await editor.getByLabel('模型名称 1', { exact: true }).waitFor();
      assert.equal(await editor.getByLabel('模型名称 1', { exact: true }).inputValue(), 'DSHM structured model');
      assert.equal(await editor.getByLabel('上下文容量（Token） 1', { exact: true }).inputValue(), '128K');
      assert.equal(await editor.getByLabel('输出容量（Token） 1', { exact: true }).inputValue(), '8K');
      assert.equal(await editor.getByLabel('输入类型 1', { exact: true }).inputValue(), 'image,text');
      report.structuredModelReadBack = true;
    }
  }
  await picker.waitFor();
  await picker.selectOption('');
  const pendingCreation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
  await pendingCreation.getByRole('button', { name: '新增模型提供方', exact: true }).click();
  await pendingCreation.getByRole('combobox', { name: /^提供方来源/ }).selectOption('custom');
  await pendingCreation.getByLabel('提供方标识', { exact: true }).fill('dshm-unsaved-creation');
  await pendingCreation.getByLabel('服务地址', { exact: true }).fill('http://127.0.0.1:1');
  await picker.selectOption(ids[0]);
  await picker.selectOption('');
  assert.equal(await pendingCreation.getByLabel('提供方标识', { exact: true }).inputValue(), 'dshm-unsaved-creation');
  assert.equal(await pendingCreation.getByLabel('服务地址', { exact: true }).inputValue(), 'http://127.0.0.1:1');
  await pendingCreation.getByRole('button', { name: '取消', exact: true }).click();
  report.creationDraftPreserved = true;
  const name = directory.locator('.remote-provider-form:visible').getByLabel('提供方名称', { exact: true });
  await picker.selectOption(ids[0]); await name.fill('DSHM unsaved A');
  await picker.selectOption(ids[1]); await name.fill('DSHM unsaved B');
  await picker.selectOption(ids[0]); assert.equal(await name.inputValue(), 'DSHM unsaved A');
  await picker.selectOption(ids[1]); assert.equal(await name.inputValue(), 'DSHM unsaved B');
  assert.equal(await directory.locator('.remote-provider-form:visible').count(), 1);
  assert.equal(await directory.locator('[hidden][inert]').filter({ has: page.locator('.remote-provider-form') }).count(), 1);
  report.independentDrafts = true;
  if (validationCheck) {
    const form = directory.locator('.remote-provider-form:visible');
    const timeout = form.getByLabel('等待输出超时（毫秒）', { exact: true });
    await timeout.fill('');
    await form.getByRole('button', { name: '保存到电脑', exact: true }).click();
    await form.getByText('请输入有效的设置值。', { exact: true }).waitFor();
    assert.equal(await name.inputValue(), 'DSHM unsaved B');
    assert.equal(await timeout.inputValue(), '');
    await timeout.fill('1000');
    assert.equal(await form.getByRole('button', { name: '保存到电脑', exact: true }).isDisabled(), false);
    report.localValidationKeepsDraft = true; report.correctedDraftEnabled = true;
  }
  if (saveCheck) {
    const form = directory.locator('.remote-provider-form:visible');
    await form.getByRole('button', { name: '保存到电脑', exact: true }).click();
    await form.getByText('已保存到电脑。', { exact: true }).waitFor();
    await picker.locator(`option[value="${ids[1]}"]`).filter({ hasText: 'DSHM unsaved B' }).waitFor({ state: 'attached' });
    await picker.selectOption(ids[0]);
    assert.equal(await name.inputValue(), 'DSHM unsaved A', '保存B不得重置A的未提交草稿');
    report.saveKeepsOtherDraft = true;
  }
  // 关闭目录明确释放本轮编辑，不点击任何保存或Key入口。
  await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
  await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
  await picker.selectOption(ids[0]);
  assert.notEqual(await name.inputValue(), 'DSHM unsaved A');
  if (saveCheck) {
    await picker.selectOption(ids[1]);
    assert.equal(await name.inputValue(), 'DSHM unsaved B', '重新读取电脑设置确认B已保存');
    report.onlySelectedProviderSaved = true;
  }
  report.unsavedChangesDiscarded = true;
  await cleanup();
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await chat.innerHTML(), original); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; report.notices = directory ? await directory.getByRole('status').allTextContents().catch(() => []) : []; process.exitCode = 1; }
finally {
  if (!report.testProvidersRemoved) await cleanup().catch(error => { report.cleanupFailure = error.message; process.exitCode = 1; });
  if (panel && await panel.isVisible().catch(() => false)) await panel.getByRole('button', { name: '关闭窗口', exact: true }).click().catch(() => {});
  await writeFile(`artifacts/provider-switch${modelRowsCheck ? '-model-rows' : validationCheck ? '-validation' : saveCheck ? '-save' : ''}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
