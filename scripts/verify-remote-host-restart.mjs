import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 外部重启已确认的本地 Host；默认只读，--send 仅在专用会话发一次唯一标记。
const device = (await _android.devices({ omitDriverInstall: true }))
  .find(item => item.serial() === (process.env.DSHM_ANDROID_SERIAL ?? '127.0.0.1:16384'));
assert.ok(device, 'Android device must be running');
device.setDefaultTimeout(15000);
const send = process.argv.includes('--send');
if (send) assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Sending requires explicit live-test opt-in');
const report = { startedAt: new Date().toISOString(), samples: [], errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, 'Remote must be open in the app');
  page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace');
  report.title = (await workspace.locator('.remote-heading').innerText()).split('\n')[0];
  assert.match(report.title, /^DSHM /, 'Only a dedicated test conversation may be used');
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.inputValue();
  const probeDraft = draft || 'DSHM 重启恢复：保留未发送草稿';
  await input.fill(probeDraft);
  const plugins = async () => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    const list = page.getByTestId('remote-plugin-list');
    await list.waitFor();
    const entries = await list.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState })));
    const styles = await page.locator('style[data-plugin]').count();
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    return { entries, styles };
  };
  const beforePlugins = await plugins();
  assert.ok(beforePlugins.entries.some(entry => entry.id === '@deepseek-ai/dsh-client-modules' && entry.state === 'active'));
  const sheet = page.getByRole('dialog', { name: '会话权限', exact: true });
  if (!await sheet.isVisible()) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
  }
  const option = sheet.getByRole('button', { name: '仅可查看', exact: true });
  await option.waitFor();
  assert.equal(await option.isEnabled(), true, 'Session must be idle and open before Host restart');
  await writeFile('artifacts/remote-host-restart-ready.json', JSON.stringify({ ready: true, at: Date.now() }));
  console.log('READY: restart the local DSH Host now');
  const deadline = Date.now() + 120_000;
  let interrupted = false, previous, enabledSince;
  while (Date.now() < deadline) {
    const visible = await workspace.isVisible();
    if (interrupted && visible && !await sheet.isVisible()) {
      assert.equal((await workspace.locator('.remote-heading').innerText()).split('\n')[0], report.title);
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '会话权限', exact: true }).click();
    }
    const sample = {
      workspace: visible,
      enabled: await option.isVisible() && await option.isEnabled(),
      status: visible ? await workspace.locator('.remote-heading').innerText().catch(() => '') : '',
      hint: await sheet.locator('p').allTextContents(),
    };
    const key = JSON.stringify(sample);
    if (key !== previous) { report.samples.push({ at: new Date().toISOString(), ...sample }); console.log(key); previous = key; }
    if (!sample.enabled) { interrupted = true; enabledSince = undefined; }
    if (interrupted && sample.enabled) enabledSince ??= Date.now();
    if (enabledSince && Date.now() - enabledSince >= 2000) {
      report.recovered = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(interrupted, true, 'Host interruption must be observed');
  assert.equal(report.recovered, true, 'Selected session must recover without manual reconnect');
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await input.inputValue(), probeDraft);
  report.draftPreserved = true;
  if (send) {
    const marker = `DSHM_HOST_RESTART_OK_${Date.now()}`;
    const history = page.getByRole('region', { name: '聊天内容', exact: true });
    const prompt = `这是电脑重启后的 Remote 同步验证。只回复 ${marker}，不调用工具。`;
    assert.equal(await history.getByText(prompt, { exact: true }).count(), 0);
    report.sentMarker = marker;
    await input.fill(prompt);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).getByText(marker, { exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await history.getByText(prompt, { exact: true }).count(), 1);
    report.reply = marker;
  }
  await input.fill(draft);
  assert.deepEqual(await plugins(), beforePlugins, '重启后插件目录和样式保持可用');
  report.pluginsPreserved = true;
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: 'artifacts/remote-host-restart-android.png' });
  report.finishedAt = new Date().toISOString();
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await writeFile('artifacts/remote-host-restart-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
}
