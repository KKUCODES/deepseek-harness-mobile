import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { installReadingProbe, waitReading, removeReadingProbe } from './remote-reading-probe.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const cross = process.argv.includes('--cross');
const background = process.argv.includes('--background');
assert.ok(!background || cross, '后台连续通知验证必须使用两个不同会话');
const prefix = background ? 'notification-queue-background' : cross ? 'notification-queue-cross' : 'notification-queue-live';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), background, errors: [], cancelled: [] };
let page;
const control = 'artifacts/original-interactions-host-control.json';
const readResult = () => readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  const openChat = async title => {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.connection-dot.online').waitFor();
    await main.locator('button.remote-session-row').filter({ has: page.getByText(title, { exact: true }) }).click();
    await page.getByTestId('live-interactions').waitFor();
  };
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const oldSheet = page.getByRole('dialog', { name: '会话权限', exact: true });
  if (await oldSheet.isVisible()) await oldSheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  // 电脑刚重启时旧页面标题可能仍存在；从实际列表重开，确保重新持有电脑运行时。
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.locator('.connection-dot.online').waitFor();
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const probe = page.getByTestId('live-interactions'); await probe.waitFor();
  const sessionId = await probe.getAttribute('data-session');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const original = await editor.evaluate(node => node.textContent === '' ? '' : node.innerText);
  let otherSession, otherDraft;
  if (cross) {
    await openChat('DSHM 电脑端对照测试询问');
    otherSession = await probe.getAttribute('data-session');
    assert.notEqual(otherSession, sessionId);
    otherDraft = await editor.evaluate(node => node.textContent === '' ? '' : node.innerText);
    await openChat('DSHM Remote 联调提示');
  }
  const targets = [sessionId, otherSession ?? sessionId];
  await installReadingProbe(page);
  // 只暂缓第一次真实原生读取回执；请求、身份核验、目标和后续响应原样转发。
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage;
    const takes = new Set(), acks = new Map(), results = [], acknowledgements = [], confirmations = []; let held, intercepted = false;
    const post = function(raw) {
      const message = JSON.parse(raw);
      if (message.op === 'notifications.take') takes.add(message.id);
      if (message.op === 'notifications.ack') { acknowledgements.push(message.data.id); acks.set(message.id, message.data.id); }
      return send.call(bridge, raw);
    };
    const respond = function(event) {
      const message = JSON.parse(event.data);
      if (acks.has(message.id)) { confirmations.push({ id: acks.get(message.id), error: message.error ?? null }); acks.delete(message.id); }
      if (takes.delete(message.id) && message.data?.sessionId) {
        results.push({ id: message.data.id, sessionId: message.data.sessionId });
        if (!intercepted) { intercepted = true; held = event; return; }
      }
      return receive.call(bridge, event);
    };
    bridge.postMessage = post; bridge.onmessage = respond;
    window.__noticeQueueProbe = { results, acknowledgements, confirmations, waiting: () => !!held,
      release() { const event = held; held = null; if (event) receive.call(bridge, event); },
      restore() {
        this.release();
        if (bridge.postMessage === post) bridge.postMessage = send;
        if (bridge.onmessage === respond) bridge.onmessage = receive;
      } };
  });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '会话权限', exact: true }).click();
  await waitReading(page, null);
  const ids = [0, 1].map(index => `${Date.now()}-queue-${index}`);
  const logs = async () => (await device.shell('logcat -d -v brief -s DSHMNotifications:D *:S')).toString();
  const noticeKeys = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .map(value => value.trim()).filter(value => value.includes('|dev.dshmobile.validation|') && value.includes('dshm.remote.notice.'));
  const originalNotices = background ? await noticeKeys() : [];
  for (let index = 0; index < ids.length; index++) {
    const before = await logs();
    const noticesBefore = background ? await noticeKeys() : [];
    if (background) await device.shell('input keyevent KEYCODE_HOME');
    await writeFile(control, JSON.stringify({ id: ids[index], kind: 'question', sessionId: targets[index] }));
    const until = Date.now() + 12000; let found = false;
    while (Date.now() < until) {
      if (background ? (await noticeKeys()).some(value => !noticesBefore.includes(value))
        : (await logs()).slice(before.length).includes('display kind=question foreground=RemoteActivity started=1 sameSession=false')) { found = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(found, '必须收到真实电脑问题和对应的原生通知');
    if (background) {
      await device.shell('cmd statusbar expand-notifications');
      await device.shell('uiautomator dump /data/local/tmp/dshm-queue-notice.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-queue-notice.xml')).toString();
      const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
        [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
      const notices = nodes.filter(node => node.package === 'com.android.systemui' && node.text === '有问题等待你回答');
      assert.equal(notices.length, 1, '只点击当前实际观察到的唯一提问通知');
      await device.screenshot({ path: `artifacts/${prefix}-${index}.png` });
      const [x1, y1, x2, y2] = notices[0].bounds.match(/\d+/g).map(Number);
      await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
    } else {
      await device.screenshot({ path: `artifacts/${prefix}-${index}.png` });
      // 与已经核验的MuMu横幅位置一致；尺寸改变时拒绝使用固定坐标。
      assert.match((await device.shell('wm size')).toString(), /786x1624/);
      await device.shell('input tap 390 133');
    }
    if (index === 0) await page.waitForFunction(() => window.__noticeQueueProbe.waiting());
  }
  assert.equal(await page.evaluate(() => window.__noticeQueueProbe.results.length), 1);
  await page.evaluate(() => window.__noticeQueueProbe.release());
  await page.waitForFunction(() => window.__noticeQueueProbe.results.length === 2 && window.__noticeQueueProbe.confirmations.length === 1);
  report.navigation = await page.evaluate(() => ({ results: window.__noticeQueueProbe.results, acknowledgements: window.__noticeQueueProbe.acknowledgements, confirmations: window.__noticeQueueProbe.confirmations }));
  const [first, last] = report.navigation.results;
  assert.notEqual(first.id, last.id);
  assert.deepEqual([first.sessionId, last.sessionId], targets);
  assert.deepEqual(report.navigation.acknowledgements, [last.id]);
  assert.deepEqual(report.navigation.confirmations, [{ id: last.id, error: null }]);
  await waitReading(page, targets[1]);
  assert.equal(await probe.getAttribute('data-session'), targets[1]);
  assert.equal(await page.getByRole('dialog', { name: '会话权限', exact: true }).count(), 0);
  for (let index = 0; index < 2; index++) {
    if (cross && index === 1) {
      await editor.waitFor();
      assert.equal(await editor.evaluate(node => node.textContent === '' ? '' : node.innerText), otherDraft);
      await openChat('DSHM Remote 联调提示');
    }
    await page.getByRole('button', { name: '放弃整组问题', exact: true }).first().click();
    const until = Date.now() + 10000; let result;
    while (Date.now() < until) {
      result = await readResult();
      if (ids.includes(result.id) && !report.cancelled.includes(result.id)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result.error, 'ASK_CANCELLED'); assert.ok(ids.includes(result.id));
    assert.ok(!report.cancelled.includes(result.id)); report.cancelled.push(result.id);
  }
  await editor.waitFor();
  assert.equal(await editor.evaluate(node => node.textContent === '' ? '' : node.innerText), original);
  report.draftPreserved = true;
  if (background) { assert.deepEqual(await noticeKeys(), originalNotices); report.systemNoticesCleared = true; }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack; report.hostResult = await readResult(); process.exitCode = 1;
  await device.screenshot({ path: `artifacts/${prefix}-failure.png` }).catch(() => {});
} finally {
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (page) {
    await page.evaluate(() => { window.__noticeQueueProbe?.restore(); delete window.__noticeQueueProbe; }).catch(() => {});
    report.reading = await removeReadingProbe(page).catch(error => ({ error: error.message }));
  }
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
