import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const action = process.argv[2];
assert.ok(['prepare', 'navigate', 'watch', 'finish'].includes(action));
// 每轮证据单独保存，避免覆盖此前不同深度限制下的真实结果。
const prefix = process.env.DSHM_CHILD_TEST_PREFIX ?? 'remote-child-recovery';
assert.match(prefix, /^[a-z0-9-]+$/);
const artifact = suffix => `artifacts/${prefix}-${suffix}`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), action, errors: [] };
const save = () => writeFile(artifact(`${action}.json`), JSON.stringify(report, null, 2));
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const heading = workspace.locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const openChild = async label => {
    await menu('子会话');
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: new RegExp(label) }).click();
  };
  if (action === 'prepare') {
    report.original = await heading.innerText();
    assert.equal(report.original, 'DSHM Remote 联调提示');
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 嵌套恢复验证 ${Date.now()}`;
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    report.marker = `DSHM_NESTED_${Date.now()}`;
    // 只允许模型创建受控子会话，不允许读取目录或修改文件。
    await editor.fill(`这是 DSHM 嵌套会话验证。仅调用一次 subagent，run_in_background=true，label=DSHM 恢复子会话。给它的任务为：仅调用一次 subagent，run_in_background=false，label=DSHM 恢复孙会话，任务是“不要调用工具，只回复 ${report.marker}”；等待结果，然后只回复 CHILD_NESTED_DONE。你创建后台子会话后只回复 ROOT_NESTED_DONE。所有参与者都不得读写文件或执行命令，不调用其他工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true;
  } else {
    const seed = JSON.parse(await readFile(artifact('prepare.json'), 'utf8'));
    if (action === 'navigate') {
      if (await heading.innerText() === seed.chat) {
        await history.getByText('ROOT_NESTED_DONE', { exact: true }).waitFor({ timeout: 120000 });
        await editor.fill('恢复测试：根会话草稿');
        await openChild('DSHM 恢复子会话');
      }
      await history.getByText('CHILD_NESTED_DONE', { exact: true }).waitFor({ timeout: 120000 });
      report.childTitle = await heading.innerText();
      await editor.fill('恢复测试：子会话草稿');
      await menu('子会话');
      const panel = page.getByRole('dialog', { name: '子会话', exact: true });
      await panel.getByRole('button', { name: '刷新子会话', exact: true }).waitFor();
      if (await panel.getByText('当前聊天没有子会话。', { exact: true }).count()) {
        await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
        const failure = history.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'subagent · 失败' }) });
        if (await failure.getAttribute('open') === null) await failure.locator('summary').click();
        assert.match(await failure.innerText(), /subagent depth 2 exceeds maxDepth 1/);
        report.nestedUnavailable = 'Host rejected depth 2: maxDepth 1';
      } else {
        await panel.getByRole('button', { name: /DSHM 恢复孙会话/ }).click();
        await history.getByText(seed.marker, { exact: true }).waitFor();
        assert.equal(await editor.count(), 0);
        report.grandchildTitle = await heading.innerText(); report.grandchildReadOnly = true;
        await page.getByRole('button', { name: '返回父会话', exact: true }).click();
        assert.equal(await heading.innerText(), report.childTitle);
        assert.equal(await editor.inputValue(), '恢复测试：子会话草稿');
      }
      await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await heading.innerText(), seed.chat);
      assert.equal(await editor.inputValue(), '恢复测试：根会话草稿');
      report.parentDraftsPreserved = true;
      await openChild('DSHM 恢复子会话');
      if (report.grandchildTitle) await openChild('DSHM 恢复孙会话');
      await history.getByText(report.grandchildTitle ? seed.marker : 'CHILD_NESTED_DONE', { exact: true }).waitFor();
      await page.screenshot({ path: artifact('nested.png') });
    } else if (action === 'watch') {
      const navigation = JSON.parse(await readFile(artifact('navigate.json'), 'utf8'));
      const targetTitle = navigation.grandchildTitle ?? navigation.childTitle;
      const targetMarker = navigation.grandchildTitle ? seed.marker : 'CHILD_NESTED_DONE';
      report.scope = navigation.grandchildTitle ? 'nested' : 'direct-child';
      assert.equal(await heading.innerText(), targetTitle);
      await history.getByText(targetMarker, { exact: true }).waitFor();
      report.ready = true; report.samples = []; await save(); console.log('READY: nested child selected; restart confirmed local DSH Host');
      const deadline = Date.now() + 180000;
      let interrupted = false;
      while (Date.now() < deadline) {
        const online = await page.getByText('电脑连接中断，正在重新连接。', { exact: true }).count() === 0 && await workspace.isVisible();
        const title = await heading.innerText().catch(() => '');
        const sample = { online, title };
        if (JSON.stringify(report.samples.at(-1)?.state) !== JSON.stringify(sample)) report.samples.push({ at: Date.now(), state: sample });
        if (!online) interrupted = true;
        if (interrupted && online && title === targetTitle && await history.getByText(targetMarker, { exact: true }).count()) { report.recovered = true; break; }
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      assert.ok(interrupted, '必须观察到真实中断'); assert.ok(report.recovered, '嵌套子会话应自动恢复');
      if (navigation.grandchildTitle) {
        assert.equal(await editor.count(), 0);
        await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      }
      assert.equal(await heading.innerText(), navigation.childTitle);
      assert.equal(await editor.inputValue(), '恢复测试：子会话草稿');
      report.childInputEnabled = await editor.isEnabled();
      await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await heading.innerText(), seed.chat);
      assert.equal(await editor.inputValue(), '恢复测试：根会话草稿');
      report.ancestryAndDraftsPreserved = true;
      await openChild('DSHM 恢复子会话');
      await editor.waitFor();
      report.childInputAfterParentOpen = await editor.isEnabled();
      assert.ok(report.childInputAfterParentOpen, '打开父会话后应允许子会话续聊');
      report.replyMarker = `DSHM_CHILD_RECOVERED_${Date.now()}`;
      await editor.fill(`不要调用任何工具，只回复 ${report.replyMarker}`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await history.getByText(report.replyMarker, { exact: true }).waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
      await editor.fill('恢复测试：子会话草稿');
      await page.screenshot({ path: artifact('after-restart.png') });
    } else {
      // 仅归档本脚本创建的根会话；原用户草稿保持不变。
      if (await page.getByRole('button', { name: '返回父会话', exact: true }).count()) await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await heading.innerText(), seed.chat);
      await editor.fill(''); await menu('归档聊天');
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      report.restored = await heading.innerText(); assert.equal(report.restored, seed.original);
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await save(); console.log(JSON.stringify(report)); await device.close(); }
