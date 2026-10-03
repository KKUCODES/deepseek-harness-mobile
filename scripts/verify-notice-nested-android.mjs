import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['depth-on', 'depth-off', 'prepare', 'observe', 'inspect', 'verify-return', 'cleanup', 'restored'].includes(phase));
const prefix = 'artifacts/notice-nested';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => writeFile(`${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
let device;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 180000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const root = await (await androidAppWebView(device)).page();
  const page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await page.getByRole('button', { name: '重新连接', exact: true }).count()) {
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    report.reconnectedAfterPermissionChange = true;
  }
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const onboarding = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await onboarding.count()) await onboarding.getByRole('button', { name: '继续', exact: true }).click();
  const title = async () => (await main.locator('.remote-heading').innerText()).split('\n')[0];
  const waitTitle = async expected => {
    const until = Date.now() + 10000;
    while (await title() !== expected && Date.now() < until) await delay(100);
    assert.equal(await title(), expected);
  };
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.outcome:'));
  report.pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
  if (phase.startsWith('depth-')) {
    await menu('电脑插件');
    const dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
    await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
    await manager.getByRole('button', { name: '查看 Subagent', exact: true }).click();
    const depth = manager.getByRole('textbox', { name: '最大递归深度', exact: true });
    await depth.waitFor();
    await page.waitForFunction(() => document.getElementById('plugin-config-subagent-depth')?.disabled === false);
    const values = () => manager.locator('input[type="text"]').evaluateAll(nodes => nodes.map(node => ({
      id: node.id, value: node.value, overridden: [...node.parentElement.querySelectorAll('button')].some(button => button.textContent === '恢复默认'),
    })));
    report.before = await values();
    const current = report.before.find(field => field.id === 'plugin-config-subagent-depth');
    assert.ok(current);
    if (phase === 'depth-on') {
      assert.equal(current.value, '1');
      await save(); // 在修改前持久保存继承状态，以便失败后精确恢复。
      await depth.fill('2');
    } else {
      const original = JSON.parse(await readFile(`${prefix}-depth-on-android.json`, 'utf8')).before.find(field => field.id === current.id);
      assert.equal(current.value, '2');
      if (original.overridden) await depth.fill(original.value);
      else await depth.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
      report.expected = original;
    }
    await manager.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === '保存' && node.disabled));
    await manager.getByRole('button', { name: '重新读取设置', exact: true }).click();
    await page.waitForFunction(expected => {
      const node = document.getElementById('plugin-config-subagent-depth');
      return node?.value === expected && !node.disabled;
    }, phase === 'depth-on' ? '2' : report.expected.value);
    report.after = await values();
    if (phase === 'depth-off') assert.deepEqual(report.after.find(field => field.id === current.id), report.expected);
    assert.deepEqual(report.after.filter(field => field.id !== current.id), report.before.filter(field => field.id !== current.id));
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.savedAndReread = true;
  } else if (phase === 'prepare') {
    if (await title() === 'Remote') await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    assert.equal(await title(), 'DSHM Remote 联调提示');
    await history.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    assert.equal((await editor.innerText()).trim(), ''); assert.deepEqual(await keys(), []);
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    const stamp = Date.now();
    Object.assign(report, { title: `DSHM 嵌套通知验证 ${stamp}`, childLabel: `DSHM 中层 ${stamp}`,
      grandLabel: `DSHM 最深层 ${stamp}`, marker: `DSHM_NESTED_NOTICE_${stamp}`, draft: `DSHM_NESTED_DRAFT_${stamp}` });
    await save();
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    const models = page.getByRole('dialog', { name: '选择模型', exact: true });
    await models.getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    await models.waitFor({ state: 'detached' });
    await editor.fill(`这是 DSHM 嵌套会话通知测试，已允许两层子代理。你只调用一次 subagent，run_in_background=true，label=${report.childLabel}。任务内容为：你是中层子代理，只调用一次 subagent，run_in_background=true，label=${report.grandLabel}，任务内容是“不要调用任何工具，不读写文件，不执行命令，写约100字介绍白云，最后一行单独回复 ${report.marker}”。中层创建完后只回复 MIDDLE_DONE。根会话创建中层后只回复 ROOT_DONE。不要创建其他子代理，不调用其他工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true; await save();
    await editor.fill(report.draft); await delay(300);
    assert.equal((await editor.innerText()).trim(), report.draft);
    await device.shell('input keyevent KEYCODE_HOME');
    const sessionIds = rows => [...new Set(rows.map(key => JSON.parse(key.slice(key.indexOf('outcome:') + 8, key.lastIndexOf('|')))[0]))];
    const until = Date.now() + 130000;
    while (sessionIds(await keys()).length < 3 && Date.now() < until) await delay(350);
    report.notifications = await keys(); report.sessionIds = sessionIds(report.notifications);
    assert.equal(report.sessionIds.length, 3, 'Root, child and grandchild must produce actual notifications');
    assert.equal((await editor.innerText()).trim(), report.draft);
    report.parentDraftPreserved = true;
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8')); assert.equal(seed.sent, true);
    report.title = await title(); report.notifications = await keys();
    if (phase === 'restored') {
      if (await title() === 'Remote') await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await waitTitle('DSHM Remote 联调提示');
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal((await editor.innerText()).trim(), '');
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.deepEqual(await keys(), []); report.restored = true;
    } else if (phase === 'observe') {
      report.grandchildSelected = report.title === seed.grandLabel;
    } else if (phase === 'inspect' || phase === 'verify-return') {
      const middle = JSON.parse(await readFile(`${prefix}-observe-middle.json`, 'utf8'));
      // 模型可自行简写description；用已观察的父标题、真实回复及逐层返回验证关系。
      if (phase === 'inspect') {
      assert.notEqual(report.title, seed.title); assert.notEqual(report.title, middle.title);
      await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: false }).first().waitFor();
      report.grandchildReplyVerified = true;
      await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      } else {
        const previous = JSON.parse(await readFile(`${prefix}-inspect-android.json`, 'utf8'));
        assert.equal(previous.grandchildReplyVerified, true);
        assert.deepEqual(previous.notifications, []);
        report.grandchildReplyFromPriorInspect = true;
      }
      // 原标题插件异步挂载前会短暂显示首条消息摘要，等待显示名称稳定再核对。
      await waitTitle(middle.title); report.middleParentVerified = true;
      await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      await waitTitle(seed.title);
      assert.equal((await editor.innerText()).trim(), seed.draft); report.rootDraftPreserved = true;
      report.notificationsAfterReturn = await keys(); assert.deepEqual(report.notificationsAfterReturn, []);
      await device.screenshot({ path: `${prefix}-inspect-android.png` });
    } else {
      assert.equal(await title(), seed.title);
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
      assert.equal((await editor.innerText()).trim(), seed.draft);
      await editor.fill(''); await delay(300);
      await menu('归档聊天');
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await title(), 'DSHM Remote 联调提示');
      assert.equal((await editor.innerText()).trim(), '');
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.deepEqual(await keys(), []); report.restored = true;
    }
  }
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
