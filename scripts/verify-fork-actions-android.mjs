import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 真实会话只检查显示，分支点击在隔离回放验证，避免为用户创建多余聊天。
const before = process.argv.includes('--before'), suffix = before ? 'before' : 'after';
const requestedSession = process.argv.find(arg => arg.startsWith('--session='))?.slice('--session='.length);
const packageName = 'dev.dshmobile.validation.officialtest';
const devices = await _android.devices({ omitDriverInstall: true });
const device = devices.find(item => item.serial() === '127.0.0.1:16384'); assert.ok(device);
await Promise.all(devices.filter(item => item !== device).map(item => item.close()));
const report = { passed: false, readOnly: true, forkRequestsSent: 0, errors: [] };
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
  {
    const previous = JSON.parse(await readFile(before ? 'artifacts/remote-running-android-settled.json' : 'artifacts/remote-fork-android-before.json'));
    report.restoredOriginalView = await main.evaluate(async (element, { id, before }) => {
      for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model; if (!model?.pluginPanels) continue;
        const selected = model.getSnapshot().selected;
        if (selected === id) return false;
        await model.select(id); return true;
      }
      throw Error('Remote model missing');
    }, { id: before && requestedSession ? requestedSession : previous.sessionId, before });
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  Object.assign(report, await main.evaluate(element => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model; if (!model?.pluginPanels) continue;
      const state = model.getSnapshot(); return { sessionId: state.selected, running: state.session.running,
        connected: state.connectionState === 'connected', renderedMessages: state.conversation.order.length,
        nodeKinds: state.conversation.order.map(key => { const node = state.conversation.nodes.get(key); return { kind: node.kind, closing: !!node.data.closing }; }) };
    }
  }));
  report.draftSha256 = createHash('sha256').update(await input.innerText()).digest('hex');
  const button = main.getByRole('button', { name: /^从第 \d+ 轮分支$/ }).last();
  assert.ok(await button.count(), '当前会话没有已完成回复的分支按钮');
  await button.scrollIntoViewIfNeeded();
  report.button = await button.evaluate(item => {
    const box = item.getBoundingClientRect(), row = item.closest('[data-turn-tail]');
    return { label: item.getAttribute('aria-label'), text: item.innerText, icons: item.querySelectorAll('svg').length,
      width: box.width, height: box.height, disabled: item.disabled,
      rowCenters: [...row.querySelectorAll('button')].map(button => { const rect = button.getBoundingClientRect(); return rect.top + rect.height / 2; }),
      rowBounds: [...row.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect(), icon = button.querySelector('svg').getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, iconWidth: icon.width, iconHeight: icon.height };
      }),
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  if (before) { assert.equal(report.button.icons, 0); assert.match(report.button.text, /在新聊天中分支/); }
  else {
    const previous = JSON.parse(await readFile('artifacts/remote-fork-android-before.json'));
    for (const key of ['sessionId', 'draftSha256', 'renderedMessages', 'running']) assert.equal(report[key], previous[key]);
    assert.equal(report.button.icons, 1); assert.equal(report.button.text, '');
    assert.ok(report.button.width >= 44 && report.button.height >= 44); assert.equal(report.button.overflow, false);
    assert.ok(report.button.rowCenters.length >= 3);
    assert.ok(Math.max(...report.button.rowCenters) - Math.min(...report.button.rowCenters) < 2);
    assert.ok(report.button.rowBounds.every(button => button.width >= 43.9 && button.height >= 43.9));
    assert.ok(report.button.rowBounds.every(button => Math.abs(button.iconWidth - 20) < .1 && Math.abs(button.iconHeight - 20) < .1));
    for (let index = 1; index < report.button.rowBounds.length; index++) {
      const gap = report.button.rowBounds[index].left - report.button.rowBounds[index - 1].right;
      assert.ok(Math.abs(gap - 4) < .1);
    }
  }
  await writeFile(`artifacts/remote-fork-android-${suffix}.png`, await device.screenshot());
  assert.deepEqual(report.errors, []); assert.equal(report.connected, true); report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await device.close(); await writeFile(`artifacts/remote-fork-android-${suffix}.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
