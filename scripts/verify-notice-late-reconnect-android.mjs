import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'retry', 'navigate', 'cleanup'].includes(phase));
const prefix = 'artifacts/notice-late-reconnect';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device, page;
const save = () => writeFile(`${prefix}-${phase === 'retry' ? 'prepare' : phase}-android.json`, JSON.stringify(report, null, 2));
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 150000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const title = async () => (await main.locator('.remote-heading').innerText()).split('\n')[0];
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const open = async name => {
    if (await title() !== 'Remote') await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: name }).click();
    await editor.waitFor(); assert.equal(await title(), name);
  };
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.outcome:'));
  if (phase === 'prepare' || phase === 'retry') {
    if (phase === 'retry') {
      const seed = JSON.parse(await readFile(`${prefix}-model-sheet-before.json`, 'utf8'));
      assert.ok(!seed.sent); assert.equal(await title(), seed.title);
      assert.equal((await editor.innerText()).trim(), '');
      Object.assign(report, { title: seed.title, marker: seed.marker, draft: seed.draft, originalReplies: seed.originalReplies });
    } else {
    assert.equal(await title(), 'DSHM Remote 联调提示');
    assert.equal((await editor.innerText()).trim(), ''); assert.deepEqual(await keys(), []);
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    report.title = `DSHM 迟到提醒验证 ${Date.now()}`;
    report.marker = `DSHM_NOTICE_LATE_${Date.now()}`;
    report.draft = `DSHM_LATE_DRAFT_${Date.now()}`;
    await save();
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await editor.click(); await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    }
    await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
    await editor.fill(`这是DSHM恢复测试，不要调用工具。请用约100字说明手机与电脑共用同一会话的好处，最后单独回复 ${report.marker}。`);
    assert.ok((await editor.innerText()).includes(report.marker));
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true; await save();
    await open('DSHM Remote 联调提示');
    await history.getByRole('article', { name: '模型回复', exact: true }).nth(report.originalReplies - 1).waitFor();
    assert.equal((await editor.innerText()).trim(), ''); await editor.fill(report.draft);
    await delay(300); assert.equal((await editor.innerText()).trim(), report.draft);
    await device.shell('input keyevent KEYCODE_HOME');
    const until = Date.now() + 100000;
    while (!(await keys()).length && Date.now() < until) await delay(200);
    report.notifications = await keys(); assert.equal(report.notifications.length, 1);
    report.pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8')); assert.ok(seed.sent);
    if (phase === 'navigate') {
      assert.equal(await title(), 'DSHM Remote 联调提示');
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      // 旧准备报告缺少会话加载完成后的草稿断言，仅允许补上本测试空草稿。
      if ((await editor.innerText()).trim() === '') { await editor.fill(seed.draft); report.preparedMissingDraft = true; }
      await delay(300); assert.equal((await editor.innerText()).trim(), seed.draft);
      // 暂缓一次真实原生回执，身份、目标、事件内容及后续请求均原样传递。
      await page.evaluate(() => {
        const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage;
        const takes = new Set(), results = [], acknowledgements = [];
        let held, heldAt, first = true;
        const post = function(raw) {
          const message = JSON.parse(raw);
          if (message.op === 'notifications.take') takes.add(message.id);
          if (message.op === 'notifications.ack') acknowledgements.push(message.data.id);
          return send.call(bridge, raw);
        };
        const respond = function(event) {
          const message = JSON.parse(event.data);
          if (takes.delete(message.id)) {
            results.push({ id: message.data?.id ?? null, sessionId: message.data?.sessionId ?? null });
            if (first && message.data?.sessionId) { first = false; held = event; heldAt = Date.now(); return; }
          }
          return receive.call(bridge, event);
        };
        bridge.postMessage = post; bridge.onmessage = respond;
        window.__lateNoticeProbe = { results, acknowledgements, waiting: () => !!held,
          elapsed: () => Date.now() - heldAt,
          release() { const event = held; held = null; if (event) receive.call(bridge, event); },
          restore() { this.release(); if (bridge.postMessage === post) bridge.postMessage = send; if (bridge.onmessage === respond) bridge.onmessage = receive; } };
      });
      console.log('READY_FOR_ACTUAL_NOTIFICATION_CLICK');
      await page.waitForFunction(() => window.__lateNoticeProbe.waiting(), null, { timeout: 90000 });
      assert.equal(await title(), 'DSHM Remote 联调提示');
      await menu('电脑连接');
      await page.getByRole('dialog', { name: '电脑连接', exact: true }).getByRole('button', { name: '断开连接', exact: true }).click();
      await page.getByTestId('remote-page').waitFor({ state: 'visible' });
      report.disconnected = true;
      assert.deepEqual(await keys(), []);
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await main.waitFor({ timeout: 45000 });
      await open('DSHM Remote 联调提示');
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal((await editor.innerText()).trim(), seed.draft);
      report.elapsedBeforeRelease = await page.evaluate(() => window.__lateNoticeProbe.elapsed());
      assert.ok(report.elapsedBeforeRelease < 28000, 'Release before the production bridge timeout, not after a timeout already discarded it');
      await page.evaluate(() => window.__lateNoticeProbe.release());
      await delay(1200);
      report.navigation = await page.evaluate(() => ({ results: window.__lateNoticeProbe.results, acknowledgements: window.__lateNoticeProbe.acknowledgements }));
      assert.ok(report.navigation.results[0].sessionId);
      assert.notEqual(report.navigation.results[0].sessionId, report.navigation.results.at(-1).sessionId);
      assert.deepEqual(report.navigation.acknowledgements, []);
      assert.equal(await title(), 'DSHM Remote 联调提示');
      assert.equal((await editor.innerText()).trim(), seed.draft);
      assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), seed.pid);
      assert.deepEqual(await keys(), []);
      report.oldTargetDiscarded = true; report.draftPreserved = true;
      await page.screenshot({ path: `${prefix}-restored.png` });
    } else {
      if (await title() !== 'DSHM Remote 联调提示') await open('DSHM Remote 联调提示');
      assert.equal((await editor.innerText()).trim(), seed.draft); await editor.fill('');
      await open(seed.title);
      assert.equal((await editor.innerText()).trim(), '');
      await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: true }).waitFor();
      await menu('归档聊天');
      await open('DSHM Remote 联调提示');
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.equal((await editor.innerText()).trim(), ''); assert.deepEqual(await keys(), []);
      report.restored = true;
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (page) await page.evaluate(() => { window.__lateNoticeProbe?.restore(); delete window.__lateNoticeProbe; }).catch(() => {});
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(1500)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
