import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 网关由执行者核验PID后停启；本脚本只走真实页面，不替换业务响应、不确认启动。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const asideMode = process.argv.includes('--aside');
const middle = process.argv.includes('--middle');
const reading = process.argv.includes('--reading') || middle;
const header = process.argv.includes('--header') || asideMode;
const artifact = `desktop-apps-disconnect-${asideMode ? 'aside' : header ? 'header' : 'menu'}${middle ? '-middle' : reading ? '-reading' : ''}`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), header, aside: asideMode, errors: [], opens: 0 };
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  if (asideMode && await main.locator('.remote-heading strong').innerText() !== 'DSHM Remote 联调提示') {
    const existing = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
    if (await existing.isVisible()) await existing.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    const previous = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
    assert.equal(await main.locator('.remote-heading strong').innerText(), previous.chat);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '查看最近聊天', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ has: page.getByText(previous.original, { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const originalInput = main.getByRole('textbox', { name: '消息', exact: true });
  const originalDraft = await originalInput.innerText();
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  let owner = main, seed;
  if (asideMode) {
    seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu('查看已归档聊天');
    await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await menu('子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    owner = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  }
  const input = owner.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.innerText();
  const conversation = owner.getByRole('region', { name: '聊天内容', exact: true });
  let readingAnchorKey;
  const measure = async () => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return conversation.evaluate((node, key) => {
      const articles = [...node.querySelectorAll('article[aria-label="模型回复"]')];
      const anchor = key ? [...node.querySelectorAll('[data-chat-flow-key]')].find(item => item.dataset.chatFlowKey === key) : articles.at(-1);
      const bounds = node.getBoundingClientRect(), rect = anchor?.getBoundingClientRect();
      return { top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight,
        distance: node.scrollHeight - node.scrollTop - node.clientHeight,
        anchorKey: anchor?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key'),
        anchorText: anchor?.textContent, anchorY: rect?.top, viewportTop: bounds.top,
        visible: !!rect && rect.bottom > bounds.top && rect.top < bounds.bottom };
    }, readingAnchorKey);
  };
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage;
    const prepares = new Set(), snapshots = [], opens = [], sessions = [];
    const post = raw => {
      const item = JSON.parse(raw), operation = item.data?.frame?.operation;
      if (operation?.method === 'remote.prepareDesktopApp') { prepares.add(item.data.frame.id); sessions.push(operation.sessionId); }
      if (operation?.method === 'remote.openDesktopApp') opens.push(operation);
      return send.call(bridge, raw);
    };
    const respond = event => {
      const item = JSON.parse(event.data);
      if (prepares.has(item.event?.id) && item.event?.value?.snapshot) snapshots.push(item.event.value.snapshot);
      return receive.call(bridge, event);
    };
    bridge.postMessage = post; bridge.onmessage = respond;
    window.desktopDisconnectProbe = { snapshots, opens, sessions, restore() {
      if (bridge.postMessage === post) bridge.postMessage = send;
      if (bridge.onmessage === respond) bridge.onmessage = receive;
    } };
  });
  const dialog = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const action = owner.locator('[data-remote-desktop-app-action]');
  const open = async () => {
    if (header) {
      await action.getByRole('button', { name: '选择打开方式', exact: true }).click();
      await page.getByRole('menuitem', { name: 'VS Code', exact: true }).click();
    } else {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '在电脑应用中打开', exact: true }).click();
      await dialog.getByRole('button', { name: 'VS Code', exact: true }).click();
    }
  };
  await open();
  const confirm = dialog.getByRole('button', { name: '确认在电脑打开', exact: true });
  await confirm.waitFor();
  if (reading) {
    readingAnchorKey = await conversation.evaluate((node, middle) => {
      node.scrollTop = middle ? (node.scrollHeight - node.clientHeight) / 2 : node.scrollHeight;
      if (!middle) return null;
      const bounds = node.getBoundingClientRect();
      return [...node.querySelectorAll('[data-chat-flow-key]')].find(item => {
        const rect = item.getBoundingClientRect();
        return rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom;
      })?.dataset.chatFlowKey;
    }, middle);
    report.readingBefore = await measure();
    assert.ok(report.readingBefore.visible && (middle ? report.readingBefore.top > 0 && report.readingBefore.distance > 80 : report.readingBefore.distance < 2));
  }
  report.prepared = true;
  console.log('READY_FOR_GATEWAY_STOP');
  if (header) await dialog.waitFor({ state: 'detached', timeout: 60000 });
  else await dialog.getByRole('status').filter({ hasText: /^(电脑连接已断开，重新连接后可继续操作。|正在连接电脑…)$/ }).waitFor({ timeout: 60000 });
  assert.equal(await confirm.count(), 0);
  report.oldConfirmationRemoved = true;
  if (reading) {
    report.readingSamples = [];
    for (const delay of [0, 250, 1000, 3000]) {
      await new Promise(resolve => setTimeout(resolve, delay));
      report.readingSamples.push(await measure());
    }
    report.readingOffline = report.readingSamples.at(-1);
  }
  await page.screenshot({ path: `artifacts/${artifact}-offline.png` });
  console.log('OFFLINE_VERIFIED_READY_FOR_GATEWAY_START');
  if (header) {
    await action.getByRole('button', { name: '选择打开方式', exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await dialog.count(), 0);
    if (reading) report.readingRecovered = await measure();
    await open();
  } else {
    await dialog.getByRole('button', { name: 'VS Code', exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await confirm.count(), 0);
    await dialog.getByRole('button', { name: 'VS Code', exact: true }).click();
  }
  await confirm.waitFor();
  const snapshots = await page.evaluate(() => window.desktopDisconnectProbe.snapshots);
  assert.equal(snapshots.length, 2); assert.notEqual(snapshots[0], snapshots[1]);
  report.newConfirmationAfterReconnect = true;
  await page.screenshot({ path: `artifacts/${artifact}-recovered.png` });
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await input.innerText(), draft); report.draftPreserved = true;
  report.opens = await page.evaluate(() => window.desktopDisconnectProbe.opens.length);
  if (asideMode) {
    const sessions = await page.evaluate(() => window.desktopDisconnectProbe.sessions);
    assert.equal(sessions.length, 2); assert.equal(sessions[0], sessions[1]);
    report.sameChildSession = true;
    await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await main.locator('.remote-heading strong').innerText(), seed.chat);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu('查看最近聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.original, { exact: true }) }).click();
    assert.equal(await originalInput.innerText(), originalDraft);
    report.originalDraftPreserved = true;
    report.returnedToOriginal = true;
  }
  assert.equal(report.opens, 0); assert.deepEqual(report.errors, []);
  if (reading) {
    for (const current of [...report.readingSamples, report.readingRecovered]) {
      assert.equal(current.anchorKey, report.readingBefore.anchorKey);
      assert.equal(current.anchorText, report.readingBefore.anchorText);
      // 连接提示改变视口高度；容许四个CSS像素的边界差，不接受消息跳出可视区。
      assert.ok(current.visible && (middle || current.distance < 4), '断线及重连期间仍保持阅读位置');
      assert.ok(Math.abs((current.anchorY - current.viewportTop)
        - (report.readingBefore.anchorY - report.readingBefore.viewportTop)) < 4, '同一回复在聊天视口中的位置保持');
    }
  }
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: `artifacts/${artifact}-failure.png` }).catch(() => {});
} finally {
  await page?.evaluate(() => window.desktopDisconnectProbe?.restore()).catch(() => {});
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
