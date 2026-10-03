import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'verify', 'entries'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [] };
const top = async () => (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=.*?dev\.dshmobile\.validation\/\.(\w+)/)?.[1];
async function waitTop(name) {
  const deadline = Date.now() + 20000;
  do { if (await top() === name) return; await delay(200); } while (Date.now() < deadline);
  throw Error(`Android foreground did not become ${name}`);
}
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  if (phase === 'inspect') {
    report.pages = await Promise.all(context.pages().map(async page => ({ url: page.url(),
      buttons: await page.getByRole('button').allTextContents(),
      textboxes: await page.getByRole('textbox').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
    })));
  } else if (phase === 'entries') {
    const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
    const remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(ordinary); assert.ok(remote);
    const epochs = await Promise.all([ordinary, remote].map(page => page.evaluate(() => performance.timeOrigin)));
    const back = remote.getByRole('button', { name: '返回', exact: true });
    const input = remote.getByRole('textbox', { name: '消息', exact: true });
    if (await input.count()) { assert.equal(await input.inputValue(), ''); await back.click(); }
    await remote.locator('.connection-dot.online').waitFor();
    // 原生返回走页面导航栈，然后走同一模式切换入口。
    await device.shell('input keyevent KEYCODE_BACK'); await waitTop('ValidationActivity');
    const ordinaryDraft = await ordinary.getByRole('textbox', { name: '消息', exact: true }).inputValue();
    const openDrawer = () => ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    for (const kind of ['settings', 'plugins']) {
      await openDrawer();
      await ordinary.getByRole('button', { name: kind === 'settings' ? '设置' : '插件', exact: true }).click();
      if (kind === 'settings') await ordinary.getByRole('button', { name: '电脑连接', exact: true }).click();
      else await ordinary.getByRole('tab', { name: '电脑', exact: true }).click();
      await waitTop('RemoteActivity'); await remote.locator('.connection-dot.online').waitFor();
      await back.click(); await waitTop('ValidationActivity');
      await ordinary.getByRole('button', { name: kind === 'settings' ? '退出设置' : '返回', exact: true }).click();
      assert.equal(await ordinary.getByRole('textbox', { name: '消息', exact: true }).inputValue(), ordinaryDraft);
    }
    assert.deepEqual(await Promise.all([ordinary, remote].map(page => page.evaluate(() => performance.timeOrigin))), epochs);
    assert.equal(context.pages().length, 2);
    await openDrawer(); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await waitTop('RemoteActivity');
    await remote.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    assert.equal(await input.inputValue(), '');
    report.nativeBack = true; report.settingsEntry = true; report.pluginsEntry = true;
    report.pagesReused = true; report.draftsUnchanged = true;
  } else {
    const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); ordinary.setDefaultTimeout(30000);
    if (await top() === 'RemoteActivity') {
      const previous = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
      assert.ok(previous);
      assert.equal(await previous.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'Remote');
      await previous.getByRole('button', { name: '返回', exact: true }).click();
    }
    await waitTop('ValidationActivity');
    const input = ordinary.getByRole('textbox', { name: '消息', exact: true });
    await input.waitFor();
    const ordinaryDraft = await input.inputValue();
    const ordinaryEpoch = await ordinary.evaluate(() => performance.timeOrigin);
    const openRemote = async () => {
      await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
      await waitTop('RemoteActivity');
    };
    await openRemote();
    let remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) remote = await context.waitForEvent('page', { predicate: page => page.url().startsWith('https://remote.dshm.invalid/') });
    await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    remote.on('pageerror', error => report.errors.push(error.message));
    const remoteEpoch = await remote.evaluate(() => performance.timeOrigin);
    const title = 'DSHM Remote 联调提示', marker = 'DSHM_MODE_DRAFT_20260925';
    const row = remote.locator('.remote-session-row').filter({ hasText: title });
    const back = remote.getByRole('button', { name: '返回', exact: true });
    if (!(await row.count())) await back.click();
    await row.click();
    const draft = remote.getByRole('textbox', { name: '消息', exact: true });
    await draft.waitFor(); assert.equal(await draft.inputValue(), '', '只在专用空草稿中验证');
    await draft.fill(marker);
    await back.click();
    await remote.locator('.connection-dot.online').waitFor();
    for (let i = 0; i < 3; i++) {
      await back.click();
      await waitTop('ValidationActivity');
      assert.equal(remote.isClosed(), false);
      assert.equal(await ordinary.evaluate(() => performance.timeOrigin), ordinaryEpoch);
      assert.equal(await input.inputValue(), ordinaryDraft);
      assert.equal(await ordinary.getByRole('navigation', { name: '侧边导航' }).count(), 0);
      await openRemote();
      await waitTop('RemoteActivity');
      assert.equal(await remote.evaluate(() => performance.timeOrigin), remoteEpoch);
      await remote.locator('.connection-dot.online').waitFor();
      assert.equal(context.pages().filter(page => page.url().startsWith('https://remote.dshm.invalid/')).length, 1);
      assert.equal(context.pages().filter(page => page.url().startsWith('https://appassets.androidplatform.net/')).length, 1);
    }
    await row.click(); assert.equal(await draft.inputValue(), marker);
    await draft.fill(''); await remote.getByTestId('remote-workspace').locator('.remote-heading').getByText(title, { exact: true }).waitFor();
    assert.deepEqual(report.errors, []);
    report.modeCycles = 3; report.pagesReused = true; report.ordinaryDraftUnchanged = true;
    report.remoteDraftPreservedAndCleared = true; report.connectedAfterSwitches = true;
    report.bridgesIsolated = await ordinary.evaluate(() => !!window.DSHMOrdinary && !window.DSHMRemote)
      && await remote.evaluate(() => !!window.DSHMRemote && !window.DSHMOrdinary);
    assert.equal(report.bridgesIsolated, true);
    await remote.screenshot({ path: 'artifacts/mode-lifecycle-android.png' });
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/mode-lifecycle-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
