import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['prepare', 'watch', 'finish', 'history'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const heading = workspace.locator('.remote-heading');
  if (phase === 'prepare') {
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 工作流联调 ${Date.now()}`;
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await button('保存名称').click(); await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    report.marker = `DSHM_WORKFLOW_OK_${Date.now()}`;
    const prompt = `这是 DSHM 工作流界面的联调测试。我明确要求使用一次 workflow 工具。meta.name 使用 dshm-mobile-check，description 为手机工作流验证。脚本只调用 phase("验证阶段")，然后 await agent("不要调用工具、不要读写文件，只用中文写一篇约800字的说明，解释如何核对手机与电脑的聊天同步，最后单独写 WORKFLOW_MEMBER_DONE。", {label:"DSHM工作流成员", phase:"验证阶段"})，最后 return 该返回值。不要访问文件、执行命令、网络或调用其他工具。workflow 完成后只回复 ${report.marker}。`;
    await editor.fill(prompt); assert.equal(await editor.inputValue(), prompt);
    await button('发送消息').click(); report.sent = true;
    await editor.fill('工作流验收父草稿');
  } else {
    const seed = JSON.parse(await readFile('artifacts/remote-workflow-prepare-android.json', 'utf8'));
    report.chat = seed.chat; report.marker = seed.marker;
    if (phase === 'history') {
      if (await editor.count()) {
        assert.equal(await heading.innerText(), 'DSHM Remote 联调提示'); await button('返回').click();
      }
      await menu('查看已归档聊天');
      await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    }
    assert.equal(await heading.innerText(), seed.chat);
    const card = page.locator('[data-workflow-run]');
    if (phase === 'watch') {
      await card.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => {
        const card = document.querySelector('[data-workflow-run]');
        return card?.querySelector('button[data-member-status="running"]') || ['completed', 'failed', 'cancelled', 'interrupted'].includes(card?.dataset.runStatus);
      }, undefined, { timeout: 60000 });
      report.initialStatus = await card.getAttribute('data-run-status');
      const child = card.getByRole('button', { name: '打开 DSHM工作流成员', exact: true });
      if (await child.isVisible()) {
        await child.click(); await button('返回父会话').waitFor();
        assert.equal(await editor.count(), 0);
        report.childReadOnly = true;
        await page.screenshot({ path: 'artifacts/remote-workflow-child-android.png' });
        await button('返回父会话').click(); assert.equal(await heading.innerText(), seed.chat);
        assert.equal(await editor.inputValue(), '工作流验收父草稿'); report.parentDraftRetained = true;
      }
      report.status = await card.getAttribute('data-run-status');
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'artifacts/remote-workflow-running-android.png' });
    } else {
      await page.getByRole('article', { name: '模型回复' }).getByText(seed.marker, { exact: true }).waitFor({ timeout: 60000 });
      assert.equal(await card.getAttribute('data-run-status'), 'completed');
      await card.getByText('dshm-mobile-check', { exact: true }).click();
      await card.getByText('验证阶段', { exact: true }).click();
      await card.locator('[data-member-status="completed"]').waitFor();
      report.memberComplete = true;
      assert.equal(await card.getByRole('button', { name: '打开 DSHM工作流成员', exact: true }).count(), 0);
      if (phase === 'finish') assert.equal(await editor.inputValue(), '工作流验收父草稿');
      await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/remote-workflow-completed-android.png' });
      report.finished = true;
      if (phase === 'history') {
        await menu('电脑插件');
        const row = page.locator('[data-plugin-id="@deepseek-ai/dsh-client-ui-workflow-run"]');
        await row.getByText('由手机提供', { exact: true }).waitFor();
        const toggle = row.getByRole('switch'), reset = row.getByRole('button', { name: '恢复插件默认', exact: true });
        const initial = await toggle.getAttribute('aria-checked'), overridden = await reset.count() > 0;
        await toggle.click(); await button('关闭窗口').click();
        const frame = page.locator('[data-plugin-frame="@deepseek-ai/dsh-client-ui-workflow-run"]');
        assert.equal(await frame.getAttribute('data-auto-fit'), String(initial !== 'true'));
        await menu('电脑插件'); await toggle.click();
        if (!overridden) await reset.click();
        await button('关闭窗口').click(); assert.equal(await frame.getAttribute('data-auto-fit'), initial);
        report.reopenedHistory = true; report.scalingPreferenceRestored = true;
        await button('返回').click(); await menu('查看最近聊天');
      } else await menu('归档聊天');
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      assert.equal(await heading.innerText(), 'DSHM Remote 联调提示'); report.archived = true;
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/remote-workflow-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
