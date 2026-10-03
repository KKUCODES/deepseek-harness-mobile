import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2];
assert.ok(['start', 'observe', 'cleanup'].includes(phase));
const reportName = process.env.DSHM_REPORT_PREFIX || 'original-tool-approval';
assert.match(reportName, /^[a-z0-9-]+$/);
const prefix = `artifacts/${reportName}`;
const seedPath = `${prefix}-seed.json`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let page;
const draftOf = input => input.evaluate(node => node.textContent === '' ? '' : node.innerText);
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  const permission = async () => {
    await menu('会话权限');
    const dialog = page.getByRole('dialog', { name: '会话权限', exact: true });
    const value = await dialog.getByText(/^当前权限：/).innerText();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    return value;
  };
  if (phase === 'start') {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    report.permission = await permission();
    assert.equal(report.permission, '当前权限：仅可查看');
    const stamp = Date.now();
    const outcome = process.env.DSHM_APPROVAL_OUTCOME || 'allow';
    assert.ok(['allow', 'reject'].includes(outcome));
    const seed = { path: resolve('../DSH-TEST', `dshm-original-approval-${stamp}.txt`), before: `BEFORE_${stamp}`, after: `AFTER_${stamp}`,
      draft: await draftOf(editor), permission: report.permission, sent: false, outcome };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(seed.path, seed.before, { flag: 'wx' });
    await editor.fill(`这是DSHM原审批真实验收。仅使用write工具把 ${seed.path.replaceAll('\\', '/')} 内容替换为 ${seed.after}。允许读取此文件；不要执行命令、修改其他文件或权限。若工具要求审批，正常请求单次批准并等待；若被拒绝则停止，不重试。完成只回复 DSHM_ORIGINAL_APPROVAL_DONE。`);
    // 先记录尝试，任何中断后的observe都不重新发送。
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await editor.waitFor();
    if (seed.draft) await editor.fill(seed.draft);
    report.sent = true;
  } else {
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(dirname(resolve(seed.path)), resolve('../DSH-TEST'));
    assert.match(basename(seed.path), /^dshm-original-approval-\d+\.txt$/);
    assert.equal(seed.sent, true);
    if (phase === 'observe') {
      const pending = page.locator('[data-approval-key]');
      const until = Date.now() + 50000;
      report.approvals = seed.approvals ?? [];
      while (Date.now() < until) {
        if (await pending.count()) {
          assert.equal(await pending.count(), 1);
          assert.equal(report.approvals.length, 0, '本轮只批准一次，不能自动批准重试或其他工具');
          const text = await pending.innerText();
          const write = page.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="write"]') }).filter({ hasText: basename(seed.path) }).last();
          assert.equal(await write.count(), 1, '只批准同页本次文件的write请求');
          assert.match(text, /write|写入/i);
          assert.match(text, /workspace-write|写入|write/i);
          report.approvals.push({ text, callId: await write.getAttribute('data-chat-call-id') });
          await page.screenshot({ path: `${prefix}-pending.png` });
          seed.approvals = report.approvals;
          await writeFile(seedPath, JSON.stringify(seed, null, 2));
          await pending.getByRole('button', { name: seed.outcome === 'reject' ? '拒绝' : '允许一次', exact: true }).click();
          seed.answered = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
          await pending.waitFor({ state: 'detached' });
        }
        if (seed.outcome === 'reject' && seed.answered && !await main.getByRole('button', { name: '停止生成', exact: true }).count()) {
          assert.equal(await readFile(seed.path, 'utf8'), seed.before);
          report.rejectedWithoutWrite = true; break;
        }
        if ((await readFile(seed.path, 'utf8')).trim() === seed.after && !await main.getByRole('button', { name: '停止生成', exact: true }).count()) {
          report.written = true; break;
        }
        const messages = await main.getByRole('region', { name: '聊天内容', exact: true }).innerText();
        const current = messages.slice(messages.lastIndexOf(basename(seed.path)));
        if (/insufficient balance|余额不足/i.test(current) && !await main.getByRole('button', { name: '停止生成', exact: true }).count()) {
          report.modelUnavailable = 'Insufficient Balance'; break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (report.written || report.rejectedWithoutWrite) {
        assert.ok(report.approvals.length, '必须实际发生审批，不能将直接写入算作审批通过');
        assert.equal(await draftOf(editor), seed.draft);
        report.permissionAfter = await permission(); assert.equal(report.permissionAfter, seed.permission);
        if (report.written) {
          assert.notEqual(seed.outcome, 'reject');
          const write = page.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="write"]') }).filter({ hasText: basename(seed.path) }).last();
          const file = write.getByRole('button', { name: seed.path.replaceAll('\\', '/'), exact: true });
          await file.click();
          const panel = page.getByRole('region', { name: '插件面板', exact: true });
          await panel.locator('[data-textpreview-plain]').getByText(seed.after, { exact: true }).waitFor();
          report.previewMatchesDisk = true;
          await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
        }
        await page.screenshot({ path: `${prefix}-result.png` });
        seed.verified = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      } else {
        report.lastContent = (await main.getByRole('region', { name: '聊天内容', exact: true }).innerText()).slice(-1600);
        process.exitCode = 1;
      }
    } else {
      assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-approval-key]').count(), 0);
      assert.equal(await draftOf(editor), seed.draft);
      assert.equal(await permission(), seed.permission);
      const content = await readFile(seed.path, 'utf8');
      assert.ok([seed.before, seed.after].includes(content.trim()));
      await unlink(seed.path); report.fileRemoved = true;
      seed.cleaned = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: `${prefix}-${phase}-failure.png` }).catch(() => {});
} finally {
  await writeFile(`${prefix}-${phase}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
