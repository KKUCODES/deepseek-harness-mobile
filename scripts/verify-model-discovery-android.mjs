import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅新建尚未配置的内置路由；发现读取原内置目录，不调用模型或填写Key。
const phase = process.argv[2] ?? 'probe';
const merging = process.argv.includes('--merge');
const artifact = merging ? 'model-overrides-merge' : 'model-discovery';
assert.ok(['probe', 'run', 'cleanup', 'blocked'].includes(phase));
if (['run', 'cleanup'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = 'artifacts/model-discovery-live-seed.json';
const report = { at: new Date().toISOString(), phase, merging, stage: 'connect', checks: [], errors: [], resources: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(15000);
let page, main, dialog, directory, picker, seed;
const button = (root, name) => root.getByRole('button', { name, exact: true });
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
async function cleanup() {
  assert.match(seed?.name ?? '', /^DSHM 内置目录验收 [a-f0-9]{8}$/);
  await button(directory, '刷新提供方').click();
  await picker.locator(`option[value="${seed.provider}"]`).waitFor({ state: 'attached' });
  await picker.selectOption(seed.provider);
  const form = directory.locator('.remote-provider-form');
  await form.getByLabel('提供方名称', { exact: true }).waitFor();
  assert.equal(await form.getByLabel('提供方名称', { exact: true }).inputValue(), seed.name);
  const removal = directory.getByRole('region', { name: '移除提供方', exact: true });
  await button(removal, '移除提供方').click();
  await removal.getByText(`(${seed.provider})`, { exact: true }).waitFor();
  await button(removal, '确认移除').click();
  await picker.locator(`option[value="${seed.provider}"]`).waitFor({ state: 'detached' });
  seed.cleaned = true; await persist(); report.cleaned = true;
}
async function discover(region) {
  await button(region, '获取可用模型').click();
  const fieldset = region.getByRole('group', { name: '可用模型', exact: true });
  await fieldset.waitFor();
  assert.ok(await fieldset.getByRole('checkbox').count() > 0);
  return fieldset;
}
async function reread(region, name) {
  await button(region, name).click();
  await region.getByRole('status').getByText('正在处理…', { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await region.getByRole('alert').count(), 0);
}
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  const editor = main.getByRole('textbox', { name: '消息', exact: true }), draft = await editor.textContent();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  if (phase === 'blocked') {
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    report.checks.push('Management withdrawn; settings denied and chat retained');
  } else {
  directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
  await button(directory, '新增模型提供方').waitFor();
  const previous = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (phase === 'cleanup') { seed = previous; report.stage = 'cleanup'; await cleanup(); }
  else {
    assert.ok(!previous || previous.cleaned, 'Previous test route needs explicit cleanup');
    const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
    await button(creation, '新增模型提供方').click();
    await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('catalog');
    const available = creation.getByRole('combobox', { name: '选择内置提供方', exact: true });
    report.available = await available.locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    if (phase === 'run') {
      assert.ok(report.available.includes('openai'), 'Use only the observed unconfigured built-in OpenAI route');
      seed = { provider: 'openai', name: `DSHM 内置目录验收 ${randomUUID().slice(0, 8)}`, cleaned: false, at: report.at };
      await persist(); report.stage = 'create';
      await available.selectOption(seed.provider);
      await creation.getByRole('textbox', { name: '显示名称（可选）', exact: true }).fill(seed.name);
      await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
      await button(creation, '核对提供方').click();
      await button(creation, '确认新增').click();
      await creation.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      await button(creation, '查看提供方设置').click();
      const form = directory.locator('.remote-provider-form');
      await form.getByLabel('提供方名称', { exact: true }).waitFor();
      assert.equal(await picker.inputValue(), seed.provider);
      report.checks.push('Created only the previously unconfigured built-in route');
      const overrides = form.getByRole('region', { name: '编辑内置模型覆盖', exact: true });
      await button(overrides, '编辑内置模型覆盖').click();
      await overrides.getByText('没有单独设置的用户覆盖。', { exact: true }).waitFor();
      report.stage = 'discover';
      let candidates = await discover(overrides);
      report.candidates = await candidates.getByRole('checkbox').count();
      assert.ok(report.candidates > 1);
      await candidates.getByRole('checkbox').first().check();
      await button(candidates, '加入编辑草稿').click();
      const id = await overrides.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue();
      assert.ok(id); report.model = id;
      assert.equal(await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), '');
      assert.equal(await overrides.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true }).inputValue(), '');
      await reread(overrides, '重新读取模型覆盖');
      await overrides.getByText('没有单独设置的用户覆盖。', { exact: true }).waitFor();
      report.checks.push('Discovery adds only an ID to unsaved override drafts; reread discards it');
      candidates = await discover(overrides);
      await candidates.getByRole('checkbox').first().check(); await button(candidates, '加入编辑草稿').click();
      assert.equal(await overrides.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(), id);
      await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).fill(seed.name);
      report.stage = 'save-override';
      await button(overrides, '保存模型覆盖').click();
      await overrides.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
      await reread(overrides, '重新读取模型覆盖');
      await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
      assert.equal(await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), seed.name);
      candidates = await discover(overrides);
      assert.equal(await candidates.getByRole('checkbox').count(), report.candidates - 1);
      report.checks.push('One override saved and reread; remaining catalog candidates retained');
      if (merging) {
        report.stage = 'merge-existing-overrides';
        await candidates.getByRole('checkbox').first().check(); await button(candidates, '加入编辑草稿').click();
        const secondId = await overrides.getByRole('textbox', { name: '模型 ID 2', exact: true }).inputValue();
        assert.notEqual(secondId, id);
        await overrides.getByRole('textbox', { name: '模型名称 2', exact: true }).fill('DSHM 第二个覆盖');
        await overrides.getByRole('textbox', { name: '上下文容量（Token） 2', exact: true }).fill('128001');
        await button(overrides, '保存模型覆盖').click();
        await overrides.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
        await reread(overrides, '重新读取模型覆盖');
        await overrides.getByRole('textbox', { name: '模型 ID 2', exact: true }).waitFor();
        assert.equal(await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), seed.name);
        assert.equal(await overrides.getByRole('textbox', { name: '上下文容量（Token） 2', exact: true }).inputValue(), '128001');
        report.checks.push('Adding a second override preserves the existing row and exact non-K capacity');
        report.stage = 'stale-version';
        // 两个真实表单持有同一电脑版本；先保存标量，再尝试旧模型草稿。
        await button(form, '重新读取设置').click();
        const timeout = form.getByLabel('请求超时（毫秒）', { exact: true }); await timeout.waitFor();
        await reread(overrides, '重新读取模型覆盖');
        await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).fill('DSHM 过期草稿不可保存');
        await timeout.fill('45001'); await button(form.locator('form'), '保存到电脑').click();
        await form.locator(':scope > [role="status"]').getByText('已保存到电脑。', { exact: true }).waitFor();
        await button(overrides, '保存模型覆盖').click();
        await overrides.getByText('电脑设置已变化或页面已过期，请重新读取后再修改。', { exact: true }).waitFor();
        await reread(overrides, '重新读取模型覆盖');
        await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
        assert.equal(await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), seed.name);
        assert.equal(await overrides.getByRole('textbox', { name: '模型 ID 2', exact: true }).inputValue(), secondId);
        assert.equal(await overrides.getByRole('textbox', { name: '上下文容量（Token） 2', exact: true }).inputValue(), '128001');
        await button(form, '重新读取设置').click(); await timeout.waitFor();
        assert.equal(await timeout.inputValue(), '45001');
        report.checks.push('Host rejects stale model write after another settings form saves; newer scalar and both old rows preserved');
        report.stage = 'remove-one-override';
        await overrides.locator('.remote-provider-model-row').first().getByRole('button', { name: '移除用户覆盖', exact: true }).click();
        await button(overrides, '保存模型覆盖').click();
        await overrides.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
        await reread(overrides, '重新读取模型覆盖');
        await overrides.getByRole('textbox', { name: '模型 ID 1', exact: true }).waitFor();
        assert.equal(await overrides.locator('.remote-provider-model-row').count(), 1);
        assert.equal(await overrides.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(), secondId);
        assert.equal(await overrides.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), 'DSHM 第二个覆盖');
        assert.equal(await overrides.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true }).inputValue(), '128001');
        report.checks.push('Removing one user override preserves the second model and exact capacity');
      }
      report.stage = 'restore';
      await button(overrides, '恢复默认模型覆盖').click(); await button(overrides, '保存模型覆盖').click();
      await overrides.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
      await reread(overrides, '重新读取模型覆盖');
      await overrides.getByText('没有单独设置的用户覆盖。', { exact: true }).waitFor();
      assert.equal(await button(overrides, '恢复默认模型覆盖').isEnabled(), false);
      candidates = await discover(overrides);
      assert.equal(await candidates.getByRole('checkbox').count(), report.candidates);
      report.checks.push('Default overrides restored; complete candidate catalog available again');
      report.stage = 'model-list-discovery';
      const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
      await button(models, '编辑模型清单').click();
      await models.getByText('未单独列出模型，将使用提供方内置目录（若有）。', { exact: true }).waitFor();
      candidates = await discover(models);
      assert.equal(await candidates.getByRole('checkbox').count(), report.candidates);
      await candidates.getByRole('checkbox').first().check(); await button(candidates, '加入编辑草稿').click();
      const field = name => models.getByRole('textbox', { name: `${name} 1`, exact: true });
      const adopted = { id: await field('模型 ID').inputValue(), name: await field('模型名称').inputValue(),
        context: await field('上下文容量（Token）').inputValue(), output: await field('输出容量（Token）').inputValue() };
      assert.equal(adopted.id, id); assert.ok(adopted.name); assert.ok(adopted.context); assert.ok(adopted.output);
      report.stage = 'save-model-list';
      await button(models, '保存模型清单').click();
      await models.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
      await reread(models, '重新读取模型清单');
      await field('模型 ID').waitFor();
      assert.deepEqual({ id: await field('模型 ID').inputValue(), name: await field('模型名称').inputValue(),
        context: await field('上下文容量（Token）').inputValue(), output: await field('输出容量（Token）').inputValue() }, adopted);
      await reread(overrides, '重新读取模型覆盖');
      await overrides.getByText('当前使用自定义模型清单，请在模型清单中调整；恢复内置目录后可使用单个模型覆盖。', { exact: true }).waitFor();
      assert.equal(await button(overrides, '添加模型覆盖').isEnabled(), false);
      report.checks.push('Model-list discovery adopts name/capacities, saves and rereads; overrides blocked while list is active');
      report.stage = 'restore-model-list';
      await button(models, '恢复默认模型清单').click(); await button(models, '保存模型清单').click();
      await models.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
      await reread(models, '重新读取模型清单');
      await models.getByText('未单独列出模型，将使用提供方内置目录（若有）。', { exact: true }).waitFor();
      assert.equal(await button(models, '恢复默认模型清单').isEnabled(), false);
      await reread(overrides, '重新读取模型覆盖');
      assert.equal(await button(overrides, '添加模型覆盖').isEnabled(), true);
      report.checks.push('Restoring the default list re-enables individual overrides');
      report.stage = 'cleanup'; await cleanup();
    }
  }
  }
  await button(dialog, '关闭窗口').click();
  assert.equal(await editor.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.stage = 'complete';
} catch (error) { report.failure = error.message; if (seed && !seed.cleaned) report.cleanupRequired = seed.provider; process.exitCode = 1; }
finally { await writeFile(`artifacts/${artifact}-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
