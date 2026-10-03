import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只改现有模型显示名称；保留原继承状态，异常写入不重放，可单独恢复。
const phase = process.argv[2] ?? 'probe';
assert.ok(['probe', 'run', 'restore', 'blocked'].includes(phase));
if (['run', 'restore'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = 'artifacts/official-models-live-seed.json';
const report = { at: new Date().toISOString(), phase, stage: 'connect', checks: [], errors: [], resources: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(15000);
let page, main, dialog, models, seed;
const button = (root, name) => root.getByRole('button', { name, exact: true });
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
async function openSettings() {
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  models = dialog.getByRole('region', { name: '编辑 DeepSeek 模型清单', exact: true });
  await button(models, '编辑 DeepSeek 模型清单').click();
  await models.getByRole('textbox', { name: '模型 ID 1', exact: true }).waitFor();
}
async function snapshot() {
  return {
    overridden: await button(models, '恢复默认模型清单').isEnabled(),
    rows: await models.locator('.remote-provider-model-row').evaluateAll(nodes => nodes.map(node => ({
      inputs: [...node.querySelectorAll('input')].map(input => ({ label: input.getAttribute('aria-label'), value: input.value })),
      selects: [...node.querySelectorAll('select')].map(select => ({ label: select.getAttribute('aria-label'), value: select.value })),
    }))),
  };
}
async function save() {
  await button(models, '保存模型清单').click();
  await models.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
}
async function restore() {
  report.stage = 'restore';
  const current = await snapshot();
  if (JSON.stringify(current) !== JSON.stringify(seed.original)) {
    const expected = structuredClone(seed.original);
    expected.overridden = true;
    expected.rows[0].inputs.find(input => input.label === '模型名称 1').value = seed.marker;
    assert.deepEqual(current, expected, 'Do not overwrite unrelated or concurrent model changes');
    const name = models.getByRole('textbox', { name: '模型名称 1', exact: true });
    assert.equal(await name.inputValue(), seed.marker, 'Do not overwrite an unrelated model change');
    assert.equal(await models.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(), seed.id);
    if (seed.original.overridden) await name.fill(seed.name);
    else await button(models, '恢复默认模型清单').click();
    await save();
  }
  assert.deepEqual(await snapshot(), seed.original, 'Restore all visible fields and inheritance');
  seed.restored = true; await persist(); report.restored = true;
}
async function pickerName(expected, absent) {
  await button(dialog, '关闭窗口').click();
  await main.getByRole('textbox', { name: '消息', exact: true }).focus();
  await main.getByRole('button', { name: /^选择模型，当前 / }).click();
  const picker = page.getByRole('dialog', { name: '选择模型', exact: true });
  await picker.waitFor();
  if (expected) await picker.getByRole('button', { name: expected, exact: true }).waitFor();
  if (absent) assert.equal(await picker.getByRole('button', { name: absent, exact: true }).count(), 0);
  await button(picker, '关闭窗口').click();
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
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.textContent();
  if (phase === 'blocked') {
    await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
    dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    report.checks.push('Management withdrawn; settings denied and chat retained');
    await button(dialog, '关闭窗口').click();
  } else {
  await openSettings(); report.stage = 'read';
  const original = await snapshot(); report.rowCount = original.rows.length; report.overridden = original.overridden;
  if (phase !== 'probe') {
    const previous = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (phase === 'restore') { seed = previous; assert.ok(seed); await restore(); }
    else {
      assert.ok(!previous || previous.restored, 'Previous run needs explicit restore');
      seed = { original, id: await models.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(),
        name: await models.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(),
        marker: `DSHM 模型同步验收 ${randomUUID().slice(0, 8)}`, restored: false, at: report.at };
      await persist(); report.stage = 'save';
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).fill(seed.marker);
      await save(); report.checks.push('Saved an existing official model display name through Android');
      await button(models, '重新读取模型清单').click();
      await models.getByRole('textbox', { name: '模型名称 1', exact: true }).waitFor();
      assert.equal(await models.getByRole('textbox', { name: '模型名称 1', exact: true }).inputValue(), seed.marker);
      report.checks.push('Reread the changed name from the computer');
      report.stage = 'picker'; await pickerName(seed.marker);
      report.checks.push('Chat model picker received the updated computer catalog');
      await openSettings(); await restore();
    }
    await pickerName(seed.name || seed.id, seed.marker);
    report.checks.push('Original name, all visible fields, inheritance and picker restored');
  } else await button(dialog, '关闭窗口').click();
  }
  assert.equal(await editor.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.stage = 'complete';
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/official-models-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
