import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { androidAppWebView } from './android-app-webview.mjs';

/** 沿普通聊天抽屉进入真实Remote，不替换配对、认证或模型桥。 */
export async function checkRemoteStartup({ device, pkg, output, nativeTree, noCover }) {
  const first = await (await androidAppWebView(device, pkg)).page();
  const context = first.context();
  const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  const cases = [];
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const recording = device.shell('screenrecord --time-limit 4 /sdcard/dshm-remote-startup.mp4');
  await wait(250);
  const opening = context.waitForEvent('page', { predicate: page => page.url().startsWith('https://remote.dshm.invalid/') });
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opening;
  page.setDefaultTimeout(15_000);
  await page.getByLabel('设备名称', { exact: true }).waitFor();
  await page.locator('#dshm-startup').waitFor({ state: 'detached' });
  await noCover();
  assert.doesNotMatch(await page.locator('body').innerText(), /正在打开 Remote/);
  await writeFile(resolve(output, 'android-remote-first.png'), await device.screenshot());
  await recording;
  await writeFile(resolve(output, 'android-remote-first.mp4'), await device.shell('cat /sdcard/dshm-remote-startup.mp4'));
  await device.shell('rm -f /sdcard/dshm-remote-startup.mp4');
  cases.push({ firstUnpairedEntry: true, nativeCoverRemoved: true });

  await page.getByLabel('设备名称', { exact: true }).fill('DSHM 启动验收');
  await page.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  assert.match(await nativeTree(), /打开侧边抽屉/);
  const count = context.pages().length;
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  assert.match(await nativeTree(), /设备名称/);
  assert.equal(context.pages().length, count);
  assert.equal(await page.getByLabel('设备名称', { exact: true }).inputValue(), 'DSHM 启动验收');
  await noCover();
  cases.push({ warmModeSwitchPreservesPage: true });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.enable');
  try {
    const { identifier } = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      let startup;
      Object.defineProperty(window, '__dshmStartup', { configurable: true,
        get: () => startup, set(value) {
          startup = value;
          const ready = value.ready.bind(value);
          value.ready = () => { window.releaseStartup = ready; };
        }
      });
    ` });
    await page.reload();
    await page.waitForFunction(() => !!window.releaseStartup);
    assert.match(await nativeTree(), /content-desc="DSHM"/);
    await writeFile(resolve(output, 'android-remote-held-logo.png'), await device.screenshot());
    await page.evaluate(() => window.releaseStartup());
    await page.locator('#dshm-startup').waitFor({ state: 'detached' });
    await noCover();
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    cases.push({ waitsForLocalRemotePage: true, nativeCoverRemoved: true });

    const failure = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.addEventListener('DOMContentLoaded', () => window.__dshmStartup.fail(), { once: true });
    ` });
    await page.reload();
    await page.getByRole('button', { name: '重新打开', exact: true }).waitFor();
    const tree = await nativeTree();
    const nativeError = tree.slice(tree.indexOf('content-desc="DSHM"'));
    const button = /text="重新打开"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nativeError);
    assert.ok(button);
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: failure.identifier });
    await device.shell(`input tap ${Math.round((+button[1] + +button[3]) / 2)} ${Math.round((+button[2] + +button[4]) / 2)}`);
    await page.locator('#dshm-startup').waitFor({ state: 'detached' });
    await page.getByLabel('设备名称', { exact: true }).waitFor();
    await noCover();
    cases.push({ remoteNativeFailureRetry: true });
  } finally { await cdp.detach(); }
  await page.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  assert.match(await nativeTree(), /打开侧边抽屉/);
  return cases;
}
