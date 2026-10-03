import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['run', 'resume', 'cleanup'].includes(phase));
const host = () => readFile('artifacts/parent-offline-host.json', 'utf8').then(JSON.parse);
const report = { at: new Date().toISOString(), phase, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const heading = workspace.locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const seed = await host(); assert.deepEqual(seed.errors, []); assert.ok(seed.title && seed.childId);
  if (phase === 'run' || phase === 'resume') {
    if (seed.phase === 'prepared') {
    assert.equal(seed.phase, 'prepared');
    if (phase === 'run') {
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    report.originalDraft = await editor.inputValue();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
    await menu('子会话');
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /DSHM 父离线停止子任务/ }).click();
    } else {
      const previous = JSON.parse(await readFile('artifacts/parent-offline-run-android.json', 'utf8'));
      report.originalDraft = previous.originalDraft;
      await page.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
    }
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 90000 });
    await editor.fill('不要调用任何工具，不读写文件，不执行命令。请连续输出3000行，每行严格为 DSHM_CHILD_STREAM 加一个递增编号，从1开始，不省略。我会在输出途中点击停止。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor();
    await page.getByRole('region', { name: '聊天内容', exact: true }).locator('article.reply > :not(details)').filter({ hasText: 'DSHM_CHILD_STREAM' }).last().waitFor({ timeout: 60000 });
    await editor.fill('父离线测试草稿');
    report.beforeDrop = (await host()).events.at(-1);
    assert.equal(report.beforeDrop.parentLive, true); assert.equal(report.beforeDrop.childStatus, 'running');
    // 固定文件只触发验收插件持有的父句柄释放，手机停止仍走正式 UI 和中继接口。
    await writeFile('artifacts/parent-offline-command.json', JSON.stringify({ action: 'drop-parent', nonce: `parent-offline-drop-${Date.now()}` }));
    } else {
      assert.equal(seed.phase, 'parent-disposed');
      assert.equal(process.env.DSHM_PARENT_RESUME_STOP, '1', '观察失败后只能显式续接现有子任务');
      const previous = JSON.parse(await readFile('artifacts/parent-offline-resume-android.json', 'utf8'));
      report.originalDraft = previous.originalDraft; report.beforeDrop = previous.beforeDrop;
    }
    const unavailable = page.locator('.remote-agent-mode').filter({ hasText: '父会话暂不可用，恢复后可以继续聊天。' });
    await unavailable.waitFor({ timeout: 30000 });
    report.afterDrop = (await host()).events.at(-1);
    assert.equal(report.afterDrop.parentLive, false); assert.equal(report.afterDrop.childStatus, 'running');
    // 草稿始终允许本地编辑；真正受父在线状态约束的是发消息，停止保持可用。
    assert.equal(await page.getByRole('button', { name: '加入队列', exact: true }).isEnabled(), false);
    assert.equal(await editor.inputValue(), '父离线测试草稿');
    const stop = page.getByRole('button', { name: '停止生成', exact: true });
    assert.equal(await stop.isEnabled(), true);
    await page.screenshot({ path: 'artifacts/parent-offline-running.png' });
    await stop.click();
    await stop.waitFor({ state: 'detached', timeout: 30000 });
    await unavailable.waitFor();
    const deadline = Date.now() + 10000;
    do {
      report.afterStop = (await host()).events.at(-1);
      if (report.afterStop.childStatus !== 'running') break;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    assert.equal(report.afterStop.parentLive, false); assert.notEqual(report.afterStop.childStatus, 'running');
    await page.screenshot({ path: 'artifacts/parent-offline-stopped.png' });
    report.stopConfirmedByHost = true;
  } else {
    const previous = JSON.parse(await readFile(process.env.DSHM_PARENT_REPORT ?? 'artifacts/parent-offline-run-android.json', 'utf8'));
    assert.ok(previous.stopConfirmedByHost, '先确认子任务已停止，再归档');
    await page.getByRole('button', { name: '返回父会话', exact: true }).click();
    await heading.filter({ hasText: seed.title }).waitFor();
    assert.equal(await heading.innerText(), seed.title);
    await editor.waitFor();
    assert.equal(await page.getByText('正在读取聊天记录…', { exact: true }).count(), 0);
    report.returnedToPersistedParent = true;
    await page.screenshot({ path: 'artifacts/parent-offline-returned.png' });
    await menu('归档聊天');
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await editor.inputValue(), previous.originalDraft);
    report.originalDraftPreserved = true;
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/parent-offline-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
