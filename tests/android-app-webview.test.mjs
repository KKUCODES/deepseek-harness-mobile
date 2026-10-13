import test from 'node:test';
import assert from 'node:assert/strict';
import { androidAppWebView } from '../scripts/android-app-webview.mjs';

test('Android 验证按精确 PID 连接，不依赖 Playwright 误识别的包名', async () => {
  const target = { pid: () => 566, pkg: () => '[kworker/1:2]' };
  const other = { pid: () => 1566, pkg: () => 'dev.dshmobile.validation' };
  const device = {
    shell: async command => { assert.equal(command, 'pidof dev.dshmobile.validation'); return Buffer.from('566\n'); },
    webViews: () => [other, target],
  };
  assert.equal(await androidAppWebView(device), target);
});

test('Android WebView 迟启动时只接收目标进程的事件', async () => {
  const target = { pid: () => 566 };
  const device = {
    shell: async () => Buffer.from('566'), webViews: () => [],
    waitForEvent: async (event, { predicate }) => {
      assert.equal(event, 'webview');
      assert.equal(predicate({ pid: () => 1566 }), false);
      assert.equal(predicate(target), true);
      return target;
    },
  };
  assert.equal(await androidAppWebView(device), target);
});

test('Android 主进程缺失或不唯一时拒绝连接任意 WebView', async () => {
  for (const value of ['', '566 1566', 'not-a-pid']) {
    await assert.rejects(androidAppWebView({ shell: async () => Buffer.from(value) }), /主进程必须/);
  }
});

test('新增并发测试包仍按自己的 PID 选择，拒绝任意其他包名', async () => {
  const target = { pid: () => 566 };
  const device = { shell: async command => {
    assert.equal(command, 'pidof dev.dshmobile.validation.latestcordispeer'); return Buffer.from('566');
  }, webViews: () => [target] };
  assert.equal(await androidAppWebView(device, 'dev.dshmobile.validation.latestcordispeer'), target);
  await assert.rejects(androidAppWebView(device, 'dev.dshmobile.validation.other'), /match/);
});

test('纯官方独立测试包只选择自己的进程，不连接原凭据 App', async () => {
  const own = { pid: () => 120 }, original = { pid: () => 1200 };
  const device = { shell: async command => {
    assert.equal(command, 'pidof dev.dshmobile.validation.officialtest'); return Buffer.from('120');
  }, webViews: () => [original, own] };
  assert.equal(await androidAppWebView(device, 'dev.dshmobile.validation.officialtest'), own);
});
