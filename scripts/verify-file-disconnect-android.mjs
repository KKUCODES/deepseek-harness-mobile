import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from './android-picker-test.mjs';

const workspace = process.argv.includes('--workspace'), source = workspace ? 'workspace' : 'attachment';
const share = process.argv.includes('--share'), action = share ? '分享' : '下载';
const prefix = `${share ? 'share' : 'file'}-disconnect-${source}`;
const seed = JSON.parse(await readFile('artifacts/desktop-open-seed.json', 'utf8'));
const name = 'dshm-shared-upload-20260924.txt';
const expected = await readFile(workspace ? seed.path : `artifacts/${name}`);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), source, action, errors: [] }; let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(25000); page.on('pageerror', e => report.errors.push(e.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  if (workspace) {
    await button('返回').click(); await menu('查看已归档聊天');
    await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.chat);
    await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await page.locator('[data-presented-file]').first().getByRole('button', { name: /^在侧边栏打开/ }).click();
  } else {
    const card = button(`查看附件 ${name}`).first();
    await page.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
    for (let i = 0; i < 12 && !await card.count(); i++) {
      const count = await page.locator('.conversation article').count(); await button('加载更早的消息').click();
      await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
    }
    await card.click();
  }
  const plain = panel.locator('.remote-document-tab:not([hidden]) [data-textpreview-plain]');
  await plain.waitFor(); assert.equal(await plain.textContent(), expected.toString());
  report.timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const cacheFiles = async () => (await device.shell('run-as dev.dshmobile.validation find cache/remote-downloads -type f')).toString().trim();
  const shareFiles = async () => (await device.shell('run-as dev.dshmobile.validation find cache/remote-shares -type f -print0')).toString().split('\0').filter(Boolean);
  const originalShares = new Set(await shareFiles());
  assert.equal(await cacheFiles(), '');
  // 下载延迟已落盘的chunk，分享延迟完整文件的finish回执；不替换网络或业务响应。
  await page.evaluate(share => {
    const bridge = window.DSHMRemote, send = bridge.postMessage.bind(bridge), deliver = bridge.onmessage;
    const probe = window.__disconnectProbe = { calls: [], closed: 0, ready: 0, held: false };
    let heldId, savedEvent, armed = true;
    bridge.postMessage = raw => {
      const request = JSON.parse(raw);
      if (request.op.startsWith('file.')) {
        probe.calls.push(request.op);
        if (armed && request.op === (share ? 'file.finish' : 'file.chunk')) {
          heldId = request.id; armed = false;
          if (share) probe.written = request.data.bytes;
        }
      }
      return send(raw);
    };
    bridge.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id === heldId && message.data && (share || message.data.bytes > 0)) {
        savedEvent = event; probe.held = true;
        if (!share) probe.written = message.data.bytes;
        return;
      }
      if (message.event?.type === 'closed') probe.closed++;
      if (message.event?.type === 'ready') probe.ready++;
      return deliver(event);
    };
    window.__releaseDisconnectChunk = () => { if (savedEvent) { const event = savedEvent; savedEvent = null; deliver(event); } };
    window.__restoreDisconnectProbe = () => { bridge.postMessage = send; bridge.onmessage = deliver; window.__releaseDisconnectChunk(); };
  }, share);
  await panel.getByRole('button', { name: `${action}完整文件`, exact: true }).click();
  await page.waitForFunction(() => window.__disconnectProbe.held);
  report.beforeDisconnect = await page.evaluate(() => window.__disconnectProbe);
  assert.equal(report.beforeDisconnect.written, expected.length); assert.match(await cacheFiles(), /\.part$/);
  console.log(JSON.stringify({ phase: 'gateway-restart-ready', source, written: expected.length }));
  await page.waitForFunction(() => window.__disconnectProbe.closed > 0, null, { timeout: 60000 });
  await page.evaluate(() => window.__releaseDisconnectChunk());
  await panel.getByRole('status').filter({ hasText: `${action}未完成` }).waitFor();
  assert.equal(await cacheFiles(), ''); report.partialRemoved = true;
  const failed = await page.evaluate(() => window.__disconnectProbe.calls);
  assert.equal(failed.some(op => (share ? ['file.save', 'file.share'] : ['file.finish', 'file.save', 'file.share']).includes(op)), false);
  assert.equal((await shareFiles()).some(path => !originalShares.has(path)), false);
  report.notDelivered = true;
  await device.screenshot({ path: `artifacts/${prefix}-failed-android.png` });
  console.log(JSON.stringify({ phase: 'old-transfer-rejected', source }));
  await page.waitForFunction(() => window.__disconnectProbe.ready > 0, null, { timeout: 120000 });
  await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 120000 });
  assert.equal(await page.evaluate(() => performance.timeOrigin), report.timeOrigin); report.sameWebView = true;
  if (!await panel.isVisible()) {
    if (workspace) await page.locator('[data-presented-file]').first().getByRole('button', { name: /^在侧边栏打开/ }).click();
    else await button(`查看附件 ${name}`).first().click();
  }
  await plain.waitFor(); assert.equal(await plain.textContent(), expected.toString());
  if (share) {
    await panel.getByRole('button', { name: '分享完整文件', exact: true }).click();
    let chooserVisible = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      await device.shell('uiautomator dump /data/local/tmp/dshm-share-disconnect.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-share-disconnect.xml')).toString();
      chooserVisible = xml.includes('resource-id="android:id/chooser_header"');
      if (chooserVisible) break;
    }
    assert.ok(chooserVisible);
    await device.screenshot({ path: `artifacts/${prefix}-recovered-android.png` });
    await device.shell('input keyevent 4');
    await panel.getByText('已打开系统分享面板。', { exact: true }).waitFor();
    const added = (await shareFiles()).filter(path => !originalShares.has(path)); assert.equal(added.length, 1);
    const target = added[0]; assert.match(target, /^cache\/remote-shares\/[a-f0-9-]{36}\/dshm-[\w.() -]+$/);
    report.sha256 = createHash('sha256').update(expected).digest('hex');
    assert.equal((await device.shell(`run-as dev.dshmobile.validation sha256sum '${target}'`)).toString().split(/\s/)[0], report.sha256);
    // 未选择接收方，只移除本次新增且摘要一致的测试快照及其空目录。
    await device.shell(`run-as dev.dshmobile.validation rm '${target}'`);
    await device.shell(`run-as dev.dshmobile.validation rmdir '${target.slice(0, target.lastIndexOf('/'))}'`);
    assert.equal((await shareFiles()).includes(target), false);
    report.recoveredShareMatches = true; report.noRecipientSelected = true; report.testSnapshotRemoved = true;
  } else {
    const savedPaths = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0').filter(Boolean);
    const before = new Set(await savedPaths());
    await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor();
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    if ((await pickerNodes(device)).some(node => node.text === '替换')) {
      await device.shell('input keyevent 4'); await device.shell('input keyevent 4'); throw new Error('Refusing existing-file replacement');
    }
    await panel.getByText('已保存到所选位置。', { exact: true }).waitFor();
    const added = (await savedPaths()).filter(path => !before.has(path)); assert.equal(added.length, 1);
    const target = added[0]; assert.match(target, /^\/sdcard\/Download\/dshm-[\w.() -]+$/);
    report.sha256 = createHash('sha256').update(expected).digest('hex');
    assert.equal((await device.shell(`sha256sum '${target}'`)).toString().split(/\s/)[0], report.sha256);
    await device.shell(`rm '${target}'`); assert.equal((await savedPaths()).includes(target), false); report.recoveredSaveMatches = true;
  }
  assert.equal(await cacheFiles(), '');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (workspace) {
    await button('返回').click(); await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
    await menu('查看最近聊天'); await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft); report.draftPreserved = true;
  report.calls = await page.evaluate(() => window.__disconnectProbe.calls);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; if (page) { report.body = (await page.locator('body').innerText()).slice(-3000); await page.screenshot({ path: `artifacts/${prefix}-failure.png` }); } throw error; }
finally {
  if (page) await page.evaluate(() => window.__restoreDisconnectProbe?.()).catch(() => {});
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
