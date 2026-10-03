import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'question', 'answer', 'approval', 'approve', 'pending', 'none'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase };
try {
  const page = await (await androidAppWebView(device)).page();
  let remote = page.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  if (phase !== 'inspect' && phase !== 'none') {
    const deadline = Date.now() + 15000;
    while (!remote && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
      remote = page.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    }
    assert.ok(remote);
    await remote.locator('.remote-heading').getByText('DSHM Remote 联调提示', { exact: true }).waitFor({ timeout: 45000 });
    if (phase === 'question' || phase === 'answer') {
      const question = remote.getByRole('region', { name: '等待回答', exact: true });
      await question.waitFor();
      assert.match(await question.innerText(), /是否确认应用级提醒？/);
      report.question = await question.innerText();
      if (phase === 'answer') {
        await question.getByRole('radio', { name: /^确认提醒/ }).check();
        await question.getByRole('button', { name: '提交回答', exact: true }).click();
        await question.waitFor({ state: 'detached' });
        await remote.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_NATIVE_QUESTION_20260925' }).waitFor({ timeout: 60000 });
        report.answerCompleted = true;
      }
    }
    if (phase === 'approval' || phase === 'approve') {
      const approval = remote.getByRole('region', { name: '等待审批', exact: true });
      await approval.waitFor();
      report.approval = await approval.innerText();
      if (phase === 'approve') {
        assert.match(report.approval, /通知审批测试文件/);
        assert.ok(await remote.getByText(/notification-approval-20260925\.txt/).count());
        await approval.getByRole('button', { name: '允许一次', exact: true }).click();
        await approval.waitFor({ state: 'detached' });
        // 卡片消失仅证明本次答复已处理；写入是否成功必须另外核对真实文件和电脑终态。
        report.approvalSubmitted = true;
      }
    }
    if (phase === 'pending') {
      await remote.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await remote.getByRole('button', { name: /^待处理/ }).click();
      report.pending = await remote.getByRole('dialog').innerText();
    }
  }
  report.pages = page.context().pages().map(page => page.url());
  report.notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
  if (phase === 'none') assert.equal(report.notifications.length, 0);
  await device.screenshot({ path: `artifacts/notifications-actions-${phase}.png` });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/notifications-actions-${phase}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
