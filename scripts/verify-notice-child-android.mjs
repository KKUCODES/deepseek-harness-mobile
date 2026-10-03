import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['prepare', 'retry', 'inspect', 'kill', 'recover', 'verify-return', 'cleanup'].includes(phase));
const cold = process.argv.includes('--cold');
const fixed = process.argv.includes('--fixed');
const prefix = cold ? `artifacts/notice-child-cold${fixed ? '-fixed' : ''}` : 'artifacts/notice-child';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device;
const save = () => writeFile(`${prefix}-${phase === 'retry' ? 'prepare' : phase}-android.json`, JSON.stringify(report, null, 2));
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 150000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const root = await (await androidAppWebView(device)).page();
  const page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const heading = main.locator('.remote-heading');
  // 原DSH标题插槽可在主标题后附加子代理数量，不能把整行当作会话名称。
  const title = async () => (await heading.innerText()).split('\n')[0];
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.outcome:'));
  if (phase === 'prepare' || phase === 'retry') {
    if (phase === 'retry') {
      const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8'));
      assert.equal(await title(), seed.title);
      assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
      Object.assign(report, { title: seed.title, childLabel: seed.childLabel, marker: seed.marker, originalReplies: seed.originalReplies });
      await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
      report.model = 'DeepSeek-V41-Flash';
    } else {
    if (await title() === 'Remote') {
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    }
    assert.equal(await title(), 'DSHM Remote 联调提示');
    assert.equal((await editor.innerText()).trim(), ''); assert.equal((await keys()).length, 0);
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    report.title = `DSHM 子会话通知验证 ${Date.now()}`;
    report.childLabel = `DSHM 通知子会话 ${Date.now()}`;
    report.marker = `DSHM_NOTICE_CHILD_${Date.now()}`;
    await save();
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    // 明确选择真实模型，避免继承此前已移除的故障测试提供方。
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
    }
    await editor.fill(`这是 DSHM 子会话通知测试。只调用一次 subagent，run_in_background=true，label=${report.childLabel}。任务内容：“不要调用工具，不读写文件，不执行命令，只回复 ${report.marker}”。你创建它后只回复 PARENT_NOTICE_DONE。不要调用其他工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true; await save();
    await editor.fill('DSHM_NOTICE_PARENT_DRAFT');
    await device.shell('input keyevent KEYCODE_HOME');
    const until = Date.now() + 120000;
    const sessionIds = rows => new Set(rows.map(key => JSON.parse(key.slice(key.indexOf('outcome:') + 8, key.lastIndexOf('|')))[0]));
    while (sessionIds(await keys()).size < 2 && Date.now() < until) await delay(300);
    report.notifications = await keys();
    // 子任务结果可再次唤醒父任务；按不同会话核对，不能假定父会话只结算一次。
    assert.equal(sessionIds(report.notifications).size, 2, 'Parent and child must both produce actual system notifications');
    report.parentDraftPreserved = (await editor.innerText()).trim() === 'DSHM_NOTICE_PARENT_DRAFT';
    assert.ok(report.parentDraftPreserved);
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8'));
    assert.ok(seed.sent);
    report.title = await title();
    report.notifications = await keys();
    if (phase === 'recover') {
      await main.getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('button.remote-session-row').filter({ hasText: seed.title }).click();
      await editor.waitFor();
      assert.equal(await title(), seed.title);
      assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
      report.parentRecovered = true;
    } else if (phase === 'kill') {
      assert.ok(cold);
      assert.equal(report.title, seed.title);
      assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
      assert.equal(report.notifications.length, 1);
      assert.ok(seed.notifications.includes(report.notifications[0]));
      report.oldPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
      assert.match(report.oldPid, /^\d+$/);
      await device.shell('input keyevent KEYCODE_HOME');
      // 当前检查进程退出后另运行process脚本；close()返回不能证明调试器已释放。
      report.readyForProcessStop = true;
    } else if (phase === 'verify-return') {
      const prior = JSON.parse(await readFile(`${prefix}-inspect-android.json`, 'utf8'));
      assert.equal(prior.childSelected, true);
      assert.deepEqual(prior.notifications, []);
      assert.match(prior.failure ?? '', /1 个子代理/);
      assert.equal(report.title, seed.title);
      assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
      report.parentDraftPreserved = true;
    } else if (phase === 'inspect') {
      // 系统通知由实际通知栏点击；这里仅检查生产页面，不注入导航或通知目标。
      report.childSelected = report.title === seed.childLabel;
      report.parentSelected = report.title === seed.title;
      report.alerts = await page.getByRole('alert').allTextContents();
      if (cold) {
        const killed = await readFile(`${prefix}-process-android.json`, 'utf8').then(JSON.parse).catch(() => null);
        if (killed?.processEndedAndNotificationRetained) {
          report.newPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
          assert.match(report.newPid, /^\d+$/); assert.notEqual(report.newPid, killed.oldPid);
          report.newProcess = true;
          await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: true }).first().waitFor();
          assert.equal(await main.getByRole('button', { name: '返回父会话', exact: true }).count(), 1);
          report.childSelected = true;
          assert.deepEqual(report.alerts, []);
        }
      }
      if (report.childSelected) {
        await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: true }).first().waitFor();
        report.childContentVerified = true;
        assert.equal(await main.getByRole('button', { name: '返回父会话', exact: true }).count(), 1);
        await main.getByRole('button', { name: '返回父会话', exact: true }).click();
        assert.equal(await title(), seed.title);
        assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
        report.childContentAndParentDraft = true;
      }
      await device.screenshot({ path: `${prefix}-inspect-android.png` });
    } else {
      if (report.title !== 'DSHM Remote 联调提示') {
      if (await main.getByRole('button', { name: '返回父会话', exact: true }).count()) await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await title(), seed.title);
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
      assert.equal((await editor.innerText()).trim(), 'DSHM_NOTICE_PARENT_DRAFT');
      await editor.fill('');
      await menu('归档聊天');
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      }
      assert.equal(await title(), 'DSHM Remote 联调提示');
      assert.equal((await editor.innerText()).trim(), '');
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      report.restored = true;
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
