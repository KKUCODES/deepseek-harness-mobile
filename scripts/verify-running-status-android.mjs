import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只观察用户正在运行的同一轮，不发送消息、不停止任务、不修改绑定或电脑配置。
const before = process.argv.includes('--before');
const settled = process.argv.includes('--settled');
const evidenceName = before ? 'before' : settled ? 'settled' : 'after';
const packageName = 'dev.dshmobile.validation.officialtest';
const devices = await _android.devices({ omitDriverInstall: true });
const device = devices.find(item => item.serial() === '127.0.0.1:16384'); assert.ok(device);
await Promise.all(devices.filter(item => item !== device).map(item => item.close()));
const report = { before, passed: false, readOnly: true, modelMessagesSent: 0, errors: [] };
try {
  await device.shell(`am start -W -n ${packageName}/dev.dshmobile.validation.ValidationActivity`);
  const first = await (await androidAppWebView(device, packageName)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); page = await opened;
  }
  page.setDefaultTimeout(20000); page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  if (!before) {
    const previous = JSON.parse(await readFile('artifacts/remote-running-android-before.json'));
    report.restoredOriginalView = await main.evaluate(async (element, id) => {
      for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model; if (!model?.pluginPanels) continue;
        if (model.getSnapshot().selected === id) return false;
        await model.select(id); return true;
      }
      throw Error('Remote model missing');
    }, previous.sessionId);
  }
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"][aria-label="消息"]'));
  const snapshot = await main.evaluate(element => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model; if (!model?.pluginPanels) continue;
      const state = model.getSnapshot();
      let startTime;
      for (const turn of state.conversation?.timeline.turns.values() ?? []) if (turn.status === 'open') startTime = turn.start?.time;
      return { sessionId: state.selected, connected: state.connectionState === 'connected', running: state.session?.running,
        startTime, version: model.transport.capabilities?.dshVersion, draft: state.drafts[state.selected] ?? '',
        renderedMessages: state.conversation?.order.length, now: Date.now() };
    }
  });
  report.draftSha256 = createHash('sha256').update(snapshot.draft).digest('hex'); delete snapshot.draft;
  Object.assign(report, snapshot);
  report.theme = await main.evaluate(item => {
    const style = getComputedStyle(item);
    return { dark: document.body.hasAttribute('data-ds-dark-theme'), colorMix: CSS.supports('color', 'color-mix(in srgb, blue 70%, black)'),
      animatedMask: CSS.supports('mask-mode', 'alpha') && CSS.supports('mask-image', 'url("")'),
      deepDiving: style.getPropertyValue('--dsw-alias-label-deep-diving'),
      primary: style.getPropertyValue('--dsw-alias-state-business-primary'),
      staticBlue: style.getPropertyValue('--dsw-static-deepseek-500') };
  });
  // 轮次自然结束后仅用临时 DOM 检查同一正式样式，不修改会话状态或伪造运行记录。
  report.styleProbe = await main.evaluate(item => {
    const wrapper = document.createElement('div'); wrapper.className = 'remote-running-status';
    const label = document.createElement('div'); label.setAttribute('data-chat-running', '');
    label.style.color = 'var(--dsw-alias-label-deep-diving)'; wrapper.append(label); item.append(wrapper);
    try { const style = getComputedStyle(label); return { color: style.color, font: parseFloat(style.fontSize) }; }
    finally { wrapper.remove(); }
  });
  assert.notEqual(report.styleProbe.color, 'rgb(0, 0, 0)'); assert.ok(report.styleProbe.font >= 14);
  assert.equal(report.connected, true); assert.equal(report.running, !settled);
  const indicator = main.locator('[data-chat-running]'); report.indicatorCount = await indicator.count();
  if (settled) {
    const previous = JSON.parse(await readFile('artifacts/remote-running-android-before.json'));
    assert.equal(report.sessionId, previous.sessionId); assert.equal(report.draftSha256, previous.draftSha256);
    assert.equal(report.indicatorCount, 0);
    assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    report.naturalEndClears = true;
  } else if (before) {
    assert.equal(report.indicatorCount, 0);
    report.stopVisible = await main.getByRole('button', { name: '停止生成', exact: true }).isVisible();
    assert.equal(report.stopVisible, true);
  } else {
    const previous = JSON.parse(await readFile('artifacts/remote-running-android-before.json'));
    assert.equal(report.sessionId, previous.sessionId); assert.equal(report.startTime, previous.startTime);
    assert.equal(report.draftSha256, previous.draftSha256);
    await indicator.getByRole('status').waitFor();
    report.label = await indicator.innerText(); assert.match(report.label, /深度求索中，用时/);
    await page.waitForTimeout(1100); report.nextLabel = await indicator.innerText();
    assert.notEqual(report.nextLabel, report.label);
    const geometry = await indicator.evaluate(item => {
      const box = item.getBoundingClientRect(), view = item.closest('.conversation').getBoundingClientRect();
      const style = getComputedStyle(item);
      return { font: parseFloat(style.fontSize), color: style.color,
        deepDiving: style.getPropertyValue('--dsw-alias-label-deep-diving'),
        primary: style.getPropertyValue('--dsw-alias-state-business-primary'),
        animations: item.getAnimations({ subtree: true }).map(animation => animation.animationName),
        visible: box.top >= view.top && box.bottom <= view.bottom, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    assert.equal(geometry.visible, true); assert.ok(geometry.font >= 14); assert.ok(geometry.pageWidth <= geometry.viewport);
    report.geometry = geometry;
  }
  await writeFile(`artifacts/remote-running-android-${evidenceName}.png`, await device.screenshot());
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await device.close(); await writeFile(`artifacts/remote-running-android-${evidenceName}.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
