import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 只查看已有专用测试会话，不发送消息、改变模型或恢复归档。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], resources: [], children: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const heading = workspace.locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  if (await editor.count()) {
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    await page.getByRole('button', { name: '返回', exact: true }).click();
  }
  await menu('查看已归档聊天');
  const seed = JSON.parse(await readFile('artifacts/remote-subagents-prepare-android.json', 'utf8'));
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  assert.equal(await heading.innerText(), seed.chat);
  const parentDraft = await editor.inputValue();
  for (const [label, kind] of [['DSHM 子任务验证', 'one-shot'], ['DSHM 可继续子任务验证', 'continuable']]) {
    await menu('子会话');
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: new RegExp(label) }).click();
    await menu('当前模型');
    const sheet = page.getByRole('dialog', { name: '当前模型', exact: true });
    await sheet.getByText('当前电脑端不支持在子会话中更换模型或思考强度。', { exact: true }).waitFor();
    const options = sheet.locator('button.option');
    assert.ok(await options.count()); assert.equal(await sheet.locator('button.option:enabled').count(), 0);
    const selected = await sheet.locator('[aria-pressed="true"]').allTextContents();
    assert.ok(selected.length);
    await page.screenshot({ path: `artifacts/remote-child-models-${kind}.png` });
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    if (kind === 'continuable') {
      const draft = await editor.inputValue(); await editor.focus();
      const button = page.getByRole('button', { name: /^查看模型，当前 / });
      report.toolbarLabel = await button.getAttribute('aria-label');
      await button.click(); await sheet.waitFor();
      assert.equal(await sheet.locator('button.option:enabled').count(), 0);
      await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal(await editor.inputValue(), draft);
    } else assert.equal(await editor.count(), 0);
    report.children.push({ label, kind, selected, allChoicesReadOnly: true });
    await page.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal(await heading.innerText(), seed.chat); assert.equal(await editor.inputValue(), parentDraft);
  }
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await menu('查看最近聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  const originalDraft = await editor.inputValue(); await editor.focus();
  await page.getByRole('button', { name: /^选择模型，当前 / }).click();
  const rootModels = page.getByRole('dialog', { name: '选择模型', exact: true });
  assert.ok(await rootModels.locator('button.option:enabled').count());
  report.rootSelection = await rootModels.locator('[aria-pressed="true"]').allTextContents();
  await rootModels.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await editor.inputValue(), originalDraft);
  report.rootCanChoose = true; report.draftsPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/remote-child-models-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
