import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const inheritance = process.argv.includes('--inheritance');
const phase = process.argv[2], base = inheritance ? 'artifacts/custom-agent-inheritance' : 'artifacts/custom-agent-runtime';
const modeName = inheritance ? 'DSHM 子任务继承验证' : 'DSHM 自定义工具验证';
const toolName = inheritance ? 'dshm_inheritance_probe' : 'dshm_runtime_probe';
assert.ok(['prepare', 'start', 'retry', 'observe', 'cleanup', 'restored'].includes(phase));
const seedPath = `${base}-seed.json`;
if (phase === 'prepare') {
  const marker = randomUUID();
  await writeFile(seedPath, JSON.stringify({ marker, title: `DSHM 自定义工具 ${marker.slice(-8)}`, attempted: false }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ prepared: true }));
} else {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
  const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === (process.env.DSHM_ANDROID_SERIAL ?? 'emulator-5554'));
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), phase, errors: [] };
  try {
    const page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
    const main = page.getByTestId('remote-workspace'), heading = main.locator('.remote-heading strong');
    if (await page.getByRole('button', { name: '重新连接', exact: true }).isVisible()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await main.waitFor({ timeout: 60000 });
    const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
    if (await welcome.isVisible()) await welcome.getByRole('button', { name: '继续', exact: true }).click();
    if (await heading.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText(['start', 'restored'].includes(phase) ? 'DSHM Remote 联调提示' : seed.title, { exact: true }) }).click();
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    const menu = async name => {
      const item = main.getByRole('button', { name, exact: true });
      if (!await item.isVisible()) await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await item.click();
    };
    if (phase === 'start') {
      assert.equal(seed.attempted, false); await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      seed.originalDraft = await input.textContent(); await persist();
      await menu('新建聊天');
      const workspace = page.getByRole('dialog', { name: '选择工作区', exact: true });
      await workspace.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await workspace.waitFor({ state: 'hidden' });
      await menu('重命名聊天');
      const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
      await rename.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await rename.getByRole('button', { name: '保存名称', exact: true }).click();
      await heading.getByText(seed.title, { exact: true }).waitFor(); seed.created = true; await persist();
      await menu('会话权限');
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
      await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await menu('Agent 模式');
      const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
      const mode = modes.getByRole('button', { name: modeName, exact: true });
      await mode.click(); await mode.and(modes.locator('[aria-pressed="true"]')).waitFor();
      await modes.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await input.fill(`这是自定义模式实际执行验证。请只调用一次 ${toolName}，marker 参数为 ${seed.marker}，将工具返回的完整校验值原样回复。不要调用其他工具。`);
      seed.attempted = true; await persist();
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await persist(); report.sent = true;
    } else if (phase === 'retry') {
      assert.equal(seed.sent, true); assert.equal(seed.retryAttempted, undefined);
      await heading.getByText(seed.title, { exact: true }).waitFor();
      await input.fill(`测试工具的验收检查现已修正。请再次只调用一次 ${toolName}，marker 为 ${seed.marker}，将新的完整校验值原样回复，不调用其他工具。`);
      await page.waitForFunction(() => {
        const send = document.querySelector('[data-testid="remote-workspace"] button[aria-label="发送消息"]');
        return send && !send.disabled;
      }, undefined, { timeout: 45000 });
      seed.retryAttempted = true; await persist();
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.retried = true; await persist(); report.sent = true;
    } else if (phase === 'observe') {
      assert.equal(seed.sent, true); assert.equal(await heading.innerText(), seed.title);
      const until = Date.now() + 45000;
      let host;
      do {
        host = await readFile(`${base}-host.json`, 'utf8').then(JSON.parse);
        if (host.calls.length && await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: host.calls[0].receipt }).count()
          && await main.getByRole('button', { name: '停止生成', exact: true }).count() === 0) break;
        await new Promise(r => setTimeout(r, 300));
      } while (Date.now() < until);
      report.hostCalls = host.calls.length;
      if (!host.calls.length || await main.getByRole('button', { name: '停止生成', exact: true }).count()) report.pending = true;
      else {
        assert.equal(host.calls.length, 1);
        await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: host.calls[0].receipt }).waitFor();
        const collapsed = main.locator('button[data-turn-process][aria-expanded="false"]');
        // 展开后会退出此集合，逐个取first避免动态nth跳过下一轮。
        while (await collapsed.count()) await collapsed.first().click();
        const tool = main.locator(`[data-tool="${toolName}"]`).last(); await tool.waitFor();
        assert.equal(await tool.getAttribute('data-state'), 'ok');
        await menu('Agent 模式');
        const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
        assert.equal(await modes.getByRole('button', { name: '标准模式', exact: true }).isDisabled(), true);
        await modes.getByRole('button', { name: '关闭窗口', exact: true }).click();
        seed.verified = true; seed.sessionId = host.calls[0].sessionId; await persist();
        report.receiptMatched = true; report.modeLockedAfterStart = true;
        if (inheritance) {
          assert.equal(host.childOutputMatched, true); assert.equal(host.childHeaderPreset, 'dshm-custom-agent-inheritance');
          assert.equal(host.calls[0].parentId, host.parentId); assert.equal(host.calls[0].sessionId, host.childId);
          assert.equal(host.calls[0].headerPreset, host.childHeaderPreset);
          seed.sessionId = host.parentId; await persist(); report.childInheritance = true;
        }
        await page.screenshot({ path: `${base}-android.png` });
      }
    } else if (phase === 'cleanup') {
      assert.equal(seed.verified, true); assert.equal(await heading.innerText(), seed.title);
      await menu('归档聊天'); seed.archived = true; await persist();
      await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      assert.equal(await input.textContent(), seed.originalDraft); report.draftPreserved = true;
      seed.cleaned = true; await persist();
    } else {
      assert.equal(seed.cleaned, true); await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      assert.equal(await input.textContent(), seed.originalDraft);
      await menu('Agent 模式');
      const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
      await modes.getByRole('button', { name: '标准模式', exact: true }).waitFor();
      await modes.getByRole('button', { name: modeName, exact: true }).waitFor({ state: 'hidden' });
      await modes.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await menu('会话权限');
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      report.readOnlyPreserved = true;
      report.optionRemoved = true; report.draftPreserved = true;
    }
    assert.deepEqual(report.errors, []);
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await writeFile(`${base}-${phase}-android.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); await device.close();
  }
}
