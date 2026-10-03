import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, stat, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { installReadingProbe, waitReading, removeReadingProbe } from './remote-reading-probe.mjs';
import { verifySidebarOutputStreams } from './verify-sidebar-output-streams.mjs';
import { verifySidebarOutputRevocation } from './verify-sidebar-output-revocation.mjs';

const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
const switchSession = process.argv.includes('--switch');
const streams = process.argv.includes('--streams');
const revocation = process.argv.includes('--revoke');
assert.ok(!revocation || !streams && !switchSession, 'Revocation uses an isolated device');
const packageName = `dev.dshmobile.validation${revocation ? '.pairingtest' : ''}`;
assert.ok(!streams || !switchSession, 'Choose either notification switching or stream recovery');
const artifact = process.env.DSHM_OUTPUT_ARTIFACT ?? (switchSession ? 'sidebar-output-switch' : 'sidebar-output');
assert.match(artifact, /^[a-z0-9-]+$/);
const bundle = 'F:/Program Files/deepseek-harness/packages/api/remotes/lib/client.js';
const hash = async () => createHash('sha256').update(await readFile(bundle)).digest('hex');
const original = { stat: await stat(bundle), hash: await hash() };
const control = 'artifacts/sidebar-output-control.json';
let page, changed = false, jobStarted = false;
const request = async (action, sessionId) => {
  const id = `sidebar-output-${Date.now()}-${action}`;
  await writeFile(control, JSON.stringify({ id, action, sessionId, ...((streams || revocation) && action === 'start' ? { variant: 'streams' } : {}) }));
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    const value = await readFile('artifacts/sidebar-output-host.json', 'utf8').then(JSON.parse).catch(() => ({}));
    if (value.id === id) { assert.equal(value.error, undefined, value.error); return value; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host operation timed out');
};
try {
  await device.shell(`am start -f 0x20020000 -n ${packageName}/dev.dshmobile.validation.ValidationActivity`);
  const context = (await (await androidAppWebView(device, packageName)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const heading = main.locator('.remote-heading strong');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const menu = async (scope, name) => {
    await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await scope.getByRole('button', { name, exact: true }).click();
  };
  const oldOutput = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  if (await oldOutput.count()) await oldOutput.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  const oldJobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  if (await oldJobs.count()) {
    try { await oldJobs.getByRole('button', { name: '关闭窗口', exact: true }).click({ timeout: 5000 }); }
    catch (error) { if (await oldJobs.count()) throw error; }
  }
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (await heading.innerText() === seed.chat) {
    // 重连恢复可能在首次检查之后重挂载旁栏，先让真实返回操作收起它。
    try { await main.getByRole('button', { name: '返回', exact: true }).click({ timeout: 1500 }); }
    catch (error) {
      if (!await panel.isVisible()) throw error;
      if (await oldOutput.count()) await oldOutput.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      if (await oldJobs.count()) await oldJobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      await main.getByRole('button', { name: '返回', exact: true }).click();
    }
    await menu(main, '查看最近聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.original, { exact: true }) }).click();
  }
  if (await heading.innerText() === 'Remote') {
    if (await main.getByRole('heading', { name: '已归档', exact: true }).count()) await menu(main, '查看最近聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.original, { exact: true }) }).click();
  }
  await heading.getByText(seed.original, { exact: true }).waitFor();
  report.draft = await main.getByRole('textbox', { name: '消息', exact: true }).textContent();
  if (switchSession) {
    await installReadingProbe(page);
    await menu(main, '会话权限');
    await main.getByRole('dialog', { name: '会话权限', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.originalSession = await waitReading(page, 'non-null'); await removeReadingProbe(page);
  }
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await menu(main, '查看已归档聊天');
  await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
  await heading.getByText(seed.chat, { exact: true }).waitFor();
  await menu(main, '子会话');
  await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await installReadingProbe(page);
  if (await aside.getByRole('button', { name: '返回父会话', exact: true }).count()) {
    await aside.getByRole('button', { name: '返回父会话', exact: true }).click();
  } else {
    await menu(aside, '会话权限');
    await aside.getByRole('dialog', { name: '会话权限', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
  }
  await aside.locator('.remote-heading strong').getByText(seed.chat, { exact: true }).waitFor();
  const sessionId = await waitReading(page, 'non-null'); await removeReadingProbe(page);
  report.parentDraft = await aside.getByRole('textbox', { name: '消息', exact: true }).textContent();
  report.host = await request('start', sessionId); jobStarted = true;
  await menu(aside, '后台任务');
  const jobs = aside.getByRole('dialog', { name: '后台任务', exact: true });
  await jobs.locator(`[data-job-id="${report.host.job}"]`).getByRole('button', { name: '查看实时输出', exact: true }).click();
  const output = aside.getByRole('dialog', { name: '实时任务输出', exact: true });
  const text = output.getByLabel('独立任务输出', { exact: true });
  await text.getByText(/DSHM_SIDEBAR_LINE_5\b/).waitFor({ timeout: 120000 });
  await output.getByRole('button', { name: '放大窗口', exact: true }).click();
  report.rebuilds = [];
  if (switchSession) {
    const before = await text.innerText(), count = [...before.matchAll(/DSHM_SIDEBAR_LINE_(\d+)/g)].length;
    const previousLogs = (await device.shell('logcat -d -v brief -s DSHMNotifications:D *:S')).toString();
    const notice = await request('notify', report.originalSession);
    const noticeBy = Date.now() + 10000;
    let appeared = false;
    while (!appeared && Date.now() < noticeBy) {
      const logs = (await device.shell('logcat -d -v brief -s DSHMNotifications:D *:S')).toString();
      appeared = logs.slice(previousLogs.length).includes('display kind=question foreground=RemoteActivity');
      if (!appeared) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(appeared, '真实提问应产生前台原生通知');
    await device.screenshot({ path: `artifacts/${artifact}-notice-android.png` });
    // MuMu的非聚焦PopupWindow不进入UI树；位置取自原生48dp顶距和实际设备密度。
    const size = (await device.shell('wm size')).toString().match(/(\d+)x(\d+)/);
    const densities = [...(await device.shell('wm density')).toString().matchAll(/density: (\d+)/g)];
    assert.ok(size && densities.length);
    await device.shell(`input tap ${Math.floor(Number(size[1]) / 2)} ${Math.round(Number(densities.at(-1)[1]) / 160 * 74)}`);
    await heading.getByText(seed.original, { exact: true }).waitFor();
    await output.waitFor({ state: 'detached' });
    const question = main.locator('[data-question-key]');
    await question.getByRole('button', { name: '放弃整组问题', exact: true }).click();
    await question.waitFor({ state: 'detached' });
    const cancelledBy = Date.now() + 10000;
    let result;
    while (Date.now() < cancelledBy) {
      result = await readFile('artifacts/sidebar-output-host.json', 'utf8').then(JSON.parse);
      if (result.id === notice.id && result.error === 'ASK_CANCELLED') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result?.error, 'ASK_CANCELLED');
    assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), report.draft);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    if (!await main.getByRole('heading', { name: '已归档', exact: true }).count()) await menu(main, '查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
    // 原会话记住旁栏展开状态，返回时会自行恢复输出窗口。
    await output.waitFor();
    assert.match(await output.getAttribute('class'), /is-fullscreen/);
    assert.ok((await text.innerText()).startsWith(before));
    await output.getByRole('status').filter({ hasText: '读取已暂停' }).waitFor();
    assert.equal(await output.getByRole('alert').count(), 0);
    await output.getByText('已保留上次读取的位置，点击“重新读取”继续。', { exact: true }).waitFor();
    report.resumePrompt = { paused: true, connectionError: false };
    await page.screenshot({ path: `artifacts/${artifact}-paused-android.png` });
    await output.getByRole('button', { name: '重新读取', exact: true }).click();
    await text.getByText(new RegExp(`DSHM_SIDEBAR_LINE_${count + 2}\\b`)).waitFor();
    const after = await text.innerText();
    assert.ok(after.startsWith(before));
    const numbers = [...after.matchAll(/DSHM_SIDEBAR_LINE_(\d+)/g)].map(item => Number(item[1]));
    assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, i) => i + 1));
    report.switched = { nativeNotification: true, hostQuestionCancelled: true, before: count, after: numbers.length,
      prefixPreserved: true, continuous: true, fullscreenPreserved: true };
  }
  if (streams) report.streams = await verifySidebarOutputStreams({ page, output, artifact });
  if (revocation) report.revocation = await verifySidebarOutputRevocation({ page, output, artifact });
  for (const restore of switchSession || streams || revocation ? [] : [false, true]) {
    const before = await text.innerText();
    const count = [...before.matchAll(/DSHM_SIDEBAR_LINE_(\d+)/g)].length;
    assert.equal(await hash(), original.hash);
    await page.evaluate(() => { window.__sidebarOutputTransport = window.__DSH_TRANSPORT__; });
    await utimes(bundle, original.stat.atimeMs / 1000, restore ? original.stat.mtimeMs / 1000 : Date.now() / 1000); changed = !restore;
    await page.waitForFunction(() => window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__ !== window.__sidebarOutputTransport, null, { timeout: 40000 });
    await output.waitFor();
    assert.match(await output.getAttribute('class'), /is-fullscreen/);
    assert.ok((await text.innerText()).startsWith(before));
    // 当前产品约定：核心/连接重建保留已读内容，由用户恢复只读请求，不自动续发。
    await output.getByRole('button', { name: '重新读取', exact: true }).click();
    await text.getByText(new RegExp(`DSHM_SIDEBAR_LINE_${count + 2}\\b`)).waitFor();
    const after = await text.innerText();
    assert.ok(after.startsWith(before), '已确认输出必须保留且续读不能重置游标');
    const numbers = [...after.matchAll(/DSHM_SIDEBAR_LINE_(\d+)/g)].map(item => Number(item[1]));
    assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, i) => i + 1));
    report.rebuilds.push({ before: count, after: numbers.length, prefixPreserved: true, continuous: true });
  }
  await page.screenshot({ path: `artifacts/${artifact}-restored-android.png` });
  report.stopped = await request('stop'); jobStarted = false;
  if (!revocation) {
    await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
    await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await aside.getByRole('textbox', { name: '消息', exact: true }).textContent(), report.parentDraft);
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu(main, '查看最近聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.original, { exact: true }) }).click();
    assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), report.draft);
    report.originalRestored = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: `artifacts/${artifact}-failure-android.png` }).catch(() => {});
} finally {
  if (jobStarted) report.cleanup = await request('stop').catch(error => ({ error: error.message }));
  if (changed && await hash() === original.hash) await utimes(bundle, original.stat.atimeMs / 1000, original.stat.mtimeMs / 1000);
  report.bundleBytesUnchanged = await hash() === original.hash;
  report.bundleTimestampRestored = Math.abs((await stat(bundle)).mtimeMs - original.stat.mtimeMs) < 1;
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await page?.evaluate(() => { delete window.__sidebarOutputTransport; }).catch(() => {});
  await writeFile(`artifacts/${artifact}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
