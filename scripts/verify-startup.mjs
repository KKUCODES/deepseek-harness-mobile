import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, _android } from 'playwright';
import { createValidationServer } from './serve.mjs';
import { androidAppWebView } from './android-app-webview.mjs';
import { checkRemoteStartup } from './check-remote-startup.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts/startup-transition', randomUUID());
await mkdir(output, { recursive: true });
console.log(JSON.stringify({ output }));
const report = { browser: [], android: [] };
const server = createValidationServer(resolve(root, 'artifacts/official-alpha2-mobile-dist'));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
// 启动阶段故意持有业务脚本，不能等待依赖整页load事件的document.fonts.ready。
async function capture(page, name) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(output, name), Buffer.from(data, 'base64'));
  } finally { await cdp.detach(); }
}
try {
  for (const entry of ['mobile', 'remote']) {
  const url = `${origin}/${entry}.html`;
  for (const colorScheme of ['light', 'dark']) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 404, height: 837 }, colorScheme, reducedMotion });
      // 持有真正业务模块请求，验证HTML阶段无白屏和裸占位文字。
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route(`**/${entry}-main.js`, async route => { await held; await route.continue(); });
      await page.goto(url, { waitUntil: 'commit' });
      await page.locator('#dshm-startup img').waitFor();
      assert.equal(await page.locator('#app').innerText(), '');
      assert.equal(await page.locator('#dshm-startup button').isVisible(), false);
      const loading = await page.locator('#dshm-startup').evaluate(element => ({
        color: getComputedStyle(element).backgroundColor,
        logoReady: element.querySelector('img').complete && element.querySelector('img').naturalWidth > 0,
      }));
      assert.equal(loading.logoReady, true);
      await capture(page, `web-${entry}-${colorScheme}-${reducedMotion}-loading.png`);
      release();
      await page.getByTestId(entry === 'mobile' ? 'ordinary-product' : 'remote-page').waitFor();
      await page.locator('#dshm-startup').waitFor({ state: 'detached' });
      if (entry === 'mobile') await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      assert.doesNotMatch(await page.locator('body').innerText(), /正在打开聊天|正在打开 Remote/);
      await capture(page, `web-${entry}-${colorScheme}-${reducedMotion}-ready.png`);
      report.browser.push({ entry, colorScheme, reducedMotion, ...loading, realProductReady: true });
      await page.close();
    }
  }
  const failed = await browser.newPage();
  await failed.route(`**/${entry}-main.js`, route => route.abort());
  await failed.goto(url);
  await failed.getByRole('button', { name: '重新打开', exact: true }).waitFor();
  await failed.unroute(`**/${entry}-main.js`);
  await failed.getByRole('button', { name: '重新打开', exact: true }).click();
  await failed.locator('#dshm-startup').waitFor({ state: 'detached' });
  await failed.getByTestId(entry === 'mobile' ? 'ordinary-product' : 'remote-page').waitFor();
  report.browser.push({ entry, moduleFailureRetry: true });
  await failed.close();
  }

  if (process.argv.includes('--android')) {
    const pkg = 'dev.dshmobile.validation.toolstyletest';
    const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
    assert.ok(device, 'MuMu is required');
    // 当前MuMu的旧Playwright原生驱动不能可靠执行wait(gone)，读取系统真实窗口树核对。
    const nativeTree = async () => {
      await device.shell('uiautomator dump /sdcard/dshm-startup-window.xml');
      return (await device.shell('cat /sdcard/dshm-startup-window.xml')).toString();
    };
    const noCover = async () => assert.doesNotMatch(await nativeTree(), /content-desc="DSHM"/);
    try {
      for (let round = 0; round < 2; round++) {
        await device.shell(`am force-stop ${pkg}`);
        const recording = round === 0 ? device.shell('screenrecord --time-limit 4 /sdcard/dshm-startup-transition.mp4') : null;
        if (recording) await wait(250);
        await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
        const page = await (await androidAppWebView(device, pkg)).page();
        page.context().setDefaultTimeout(15_000);
        await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
        await page.locator('#dshm-startup').waitFor({ state: 'detached' });
        await noCover();
        await writeFile(resolve(output, `android-cold-${round}.png`), await device.screenshot());
        if (recording) {
          await recording;
          await writeFile(resolve(output, 'android-cold-transition.mp4'), await device.shell('cat /sdcard/dshm-startup-transition.mp4'));
        }
        report.android.push({ coldLaunch: round, nativeCoverRemoved: true, composerReady: true });
      }
      const page = await (await androidAppWebView(device, pkg)).page();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Page.enable');
      // 故意延迟真实页面的就绪通知；不替换业务数据、Key桥或模型请求。
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
      await writeFile(resolve(output, 'android-held-logo.png'), await device.screenshot());
      await page.evaluate(() => window.releaseStartup());
      await page.locator('#dshm-startup').waitFor({ state: 'detached' });
      await noCover();
      await page.getByRole('textbox', { name: '消息', exact: true }).fill('启动验收草稿');
      await page.waitForFunction(async () => {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('dshm-ordinary-history-v1', 2);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise(resolve => {
            db.transaction('chats').objectStore('chats').getAll().onsuccess = event => resolve(event.target.result.some(chat => chat.draft === '启动验收草稿'));
          });
        } finally { db.close(); }
      });
      report.android.push({ delayedLocalReady: true, nativeCoverRemoved: true, inputWorks: true });
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      // 同一真实首屏的异常通知必须进入原生重试页，不能无限持有系统启动页。
      const failure = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.addEventListener('DOMContentLoaded', () => window.__dshmStartup.fail(), { once: true });
      ` });
      await page.reload();
      await page.getByRole('button', { name: '重新打开', exact: true }).waitFor();
      const failureTree = await nativeTree();
      const nativeError = failureTree.slice(failureTree.indexOf('content-desc="DSHM"'));
      const retry = /text="重新打开"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nativeError);
      assert.ok(retry, 'Native retry button must be present');
      await writeFile(resolve(output, 'android-failed-retry.png'), await device.screenshot());
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: failure.identifier });
      await device.shell(`input tap ${Math.round((+retry[1] + +retry[3]) / 2)} ${Math.round((+retry[2] + +retry[4]) / 2)}`);
      await page.locator('#dshm-startup').waitFor({ state: 'detached' });
      await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      await noCover();
      report.android.push({ failureRetry: true });
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await page.locator('.history-row').first().click();
      await page.waitForFunction(() => document.querySelector('textarea[aria-label="消息"]')?.value === '启动验收草稿');
      assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '启动验收草稿');
      report.android.push({ draftPreservedAfterReload: true });
      await page.getByRole('button', { name: '新聊天', exact: true }).click();
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await page.getByRole('button', { name: '设置', exact: true }).click();
      await page.getByRole('button', { name: /外观与语言/ }).click();
      await page.getByRole('button', { name: /^主题/ }).click();
      await page.getByRole('button', { name: '深色', exact: true }).click();
      await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
      await page.getByRole('dialog', { name: '主题', exact: true }).waitFor({ state: 'detached' });
      // 原生镜像已提交、WebView已有空闲绘制后才结束进程，避免测试制造设置落盘竞争。
      await nativeTree();
      assert.match((await device.shell(`run-as ${pkg} cat shared_prefs/dshm.phone.appearance.v1.xml`)).toString(), /name="preference">dark</);
      await device.shell(`am force-stop ${pkg}`);
      await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
      const dark = await (await androidAppWebView(device, pkg)).page();
      await dark.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      await noCover();
      assert.equal(await dark.locator('body').getAttribute('data-ds-dark-theme'), '');
      await writeFile(resolve(output, 'android-dark-ready.png'), await device.screenshot());
      report.android.push({ persistedDarkColdLaunch: true });
      const scale = (await device.shell('settings get global animator_duration_scale')).toString().trim();
      try {
        await device.shell('settings put global animator_duration_scale 0');
        await device.shell(`am force-stop ${pkg}`);
        await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
        const reduced = await (await androidAppWebView(device, pkg)).page();
        await reduced.getByRole('textbox', { name: '消息', exact: true }).waitFor();
        await noCover();
        report.android.push({ nativeAnimationsDisabled: true });
      } finally {
        if (scale === 'null') await device.shell('settings delete global animator_duration_scale');
        else { assert.match(scale, /^\d+(?:\.\d+)?$/); await device.shell(`settings put global animator_duration_scale ${scale}`); }
      }
      report.remote = await checkRemoteStartup({ device, pkg, output, nativeTree, noCover });
    } finally {
      await device.shell('rm -f /sdcard/dshm-startup-window.xml');
      await device.shell('rm -f /sdcard/dshm-startup-transition.mp4');
      await device.close();
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
console.log(JSON.stringify(report));
