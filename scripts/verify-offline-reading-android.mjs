import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅观察真实页面并编辑/恢复本机草稿；网关故障由外部对已核对进程执行。
const mode = process.argv[2] ?? 'chat';
assert.ok(['chat', 'output', 'initial'].includes(mode));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), mode, errors: [] };
const hash = text => createHash('sha256').update(text).digest('hex');
let editor, originalDraft;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    if (!await ordinary.getByRole('dialog', { name: '侧边导航', exact: true }).count()) await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  if (mode === 'initial') {
    const connection = page.getByTestId('remote-page');
    await connection.getByRole('alert').waitFor({ timeout: 45000 });
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal(await page.getByTestId('remote-offline-status').count(), 0);
    await page.screenshot({ path: 'artifacts/offline-reading-initial-android.png' });
    await connection.getByRole('button', { name: '返回普通聊天', exact: true }).click();
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    report.initialFailureShowsConnectionPage = true; report.ordinaryStillAvailable = true;
    assert.deepEqual(report.errors, []);
  } else {
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const heading = workspace.locator('.remote-heading');
  if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  const conversation = page.getByRole('region', { name: '聊天内容', exact: true });
  await conversation.getByRole('article', { name: '模型回复' }).first().waitFor();
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  const content = mode === 'output' ? output.locator('pre') : conversation.locator('.messages');
  await content.waitFor();
  const text = await content.innerText(), title = await heading.innerText();
  const node = await content.elementHandle();
  assert.ok(text.length > 10);
  if (mode === 'chat') {
    editor = page.getByRole('textbox', { name: '消息', exact: true }); originalDraft = await editor.inputValue();
    await editor.fill(originalDraft + '\nDSHM 离线阅读验证草稿（不发送）'); await editor.blur();
    await conversation.evaluate(el => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2); });
  }
  const scrollTop = await conversation.evaluate(el => el.scrollTop);
  console.log('READY: stop the verified local gateway; keep DSH running');
  const offline = (mode === 'output' ? output : workspace).getByTestId('remote-offline-status');
  await offline.waitFor({ timeout: 120000 });
  const timestamp = await offline.locator('time').getAttribute('datetime'); assert.ok(timestamp);
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    assert.equal(await heading.innerText(), title);
    assert.equal(await content.innerText(), text, '断线期间保留已加载内容');
    assert.equal(await node.evaluate(el => el.isConnected), true, '保留同一页面节点');
    assert.equal(await offline.locator('time').getAttribute('datetime'), timestamp, '离线最后同步时间不能前移');
    if (mode === 'chat') {
      assert.ok(await page.getByRole('button', { name: '发送消息', exact: true }).isDisabled());
      assert.ok(Math.abs(await conversation.evaluate(el => el.scrollTop) - scrollTop) <= 2, '保留阅读位置');
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  await page.screenshot({ path: `artifacts/offline-reading-${mode}-android.png` });
  report.offline = { retained: true, sameNode: true, lastSync: timestamp, durationMs: 15000, hash: hash(text), scrollTop };
  console.log('RESTORE: offline reading passed; restart original gateway now');
  await offline.waitFor({ state: 'detached', timeout: 120000 });
  assert.equal(await heading.innerText(), title);
  assert.equal(await node.evaluate(el => el.isConnected), true);
  if (mode === 'chat') {
    assert.equal(await editor.inputValue(), originalDraft + '\nDSHM 离线阅读验证草稿（不发送）');
    await page.waitForFunction(() => !document.querySelector('button[aria-label="发送消息"]')?.disabled);
    assert.equal(await content.innerText(), text);
  } else {
    assert.equal(await content.innerText(), text);
    await output.getByRole('button', { name: '重新读取', exact: true }).click();
    await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
    assert.equal(await content.innerText(), text);
  }
  report.reconnected = true; assert.deepEqual(report.errors, []);
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (editor && originalDraft !== undefined) await editor.fill(originalDraft).catch(() => {});
  await writeFile(`artifacts/offline-reading-${mode}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
