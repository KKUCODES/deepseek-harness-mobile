import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createValidationServer } from './serve.mjs';

// 正式普通聊天/Remote页面；只回放原生更新状态，不声称下载或安装已在浏览器执行。
const folder = resolve('artifacts/app-update-web-check'); await mkdir(folder, { recursive: true });
const server = createValidationServer(resolve('artifacts/ci/web')); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], report = { checks: [] };
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await context.addInitScript(() => {
    let state = { phase: 'current', revision: 1, currentVersion: '0.1.0-preview.7', currentVersionCode: 9, requiredPluginVersion: '0.1.87-latest.0', release: null, received: 0 };
    const notes = ['## 更新说明', '', '- **改进**：保留聊天和草稿。', '- 支持 `Markdown` 格式。', '',
      '[发行记录](https://github.com/KKUCODES/deepseek-harness-mobile/releases)', '',
      '| 功能 | 状态 |', '| --- | --- |', '| 更新 | 可用 |', '',
      '```js', 'const version = "0.1.0-preview.8";', '```', '',
      '<script id="release-exploit">window.noteScriptRan = true</script>', '[无效链接](javascript:alert(1))'].join('\n');
    const release = { version: '0.1.0-preview.8', versionCode: 10, bytes: 11000000, requiredPluginVersion: '0.1.87-latest.0', notes };
    window.updateFixture = { release, push(patch) { state = { ...state, ...patch, revision: state.revision + 1 }; window.DSHMUpdates.onmessage?.({ data: JSON.stringify({ event: state }) }); } };
    window.DSHMUpdates = { postMessage(raw) {
      const request = JSON.parse(raw), op = request.op;
      if (op === 'updates.check') { window.updateFixture.push({ phase: 'checking', error: null }); setTimeout(() => window.updateFixture.push({ phase: 'available', release }), 200); }
      if (op === 'updates.download') window.updateFixture.push({ phase: 'downloading', received: 5500000, error: null });
      if (op === 'updates.cancel') window.updateFixture.push({ phase: 'cancelled' });
      if (op === 'updates.install') window.updateFixture.push({ phase: 'permission' });
      if (op === 'updates.openLink') window.noteOpenedLink = request.data.url;
      queueMicrotask(() => window.DSHMUpdates.onmessage({ data: JSON.stringify({ id: request.id, data: state }) }));
    } };
    window.DSHMRemote = { postMessage(raw) {
      const request = JSON.parse(raw);
      const data = request.op === 'binding.info' ? { paired: false } : request.op === 'appearance.read' ? { preference: 'dark', fontSize: 14, language: 'zh', enabled: true } : {};
      queueMicrotask(() => window.DSHMRemote.onmessage({ data: JSON.stringify({ id: request.id, data }) }));
    } };
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function checkNotes(entry) {
    const notes = panel.locator('.app-update-notes');
    assert.equal(await notes.count(), 0, 'Collapsed notes do not mount the Markdown renderer');
    await panel.locator('summary').filter({ hasText: /^更新内容$/ }).click();
    await notes.getByRole('heading', { name: '更新说明', exact: true }).waitFor();
    assert.equal(await notes.locator('li').count(), 2);
    assert.equal(await notes.locator('strong').innerText(), '改进');
    assert.equal(await notes.locator('table').count(), 1);
    assert.match(await notes.locator('pre').innerText(), /const version/);
    assert.equal(await notes.locator('script').count(), 0);
    assert.equal(await notes.locator('a[href^="javascript:"]').count(), 0);
    await notes.getByRole('link', { name: '发行记录', exact: true }).click();
    assert.equal(await page.evaluate(() => window.noteOpenedLink), 'https://github.com/KKUCODES/deepseek-harness-mobile/releases');
    assert.equal(await page.evaluate(() => window.noteScriptRan), undefined);
    assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await page.screenshot({ path: resolve(folder, `${entry}-release-notes.png`) });
    await panel.locator('summary').filter({ hasText: /^更新内容$/ }).click();
    report.checks.push(`${entry}: Markdown headings/lists/bold/table/code/link, unsafe HTML/URL rejection and narrow layout`);
  }
  await page.goto(base + '/mobile.html');
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^软件更新/ }).click();
  const panel = page.getByRole('dialog', { name: '软件更新', exact: true });
  await panel.getByText('当前已是最新版本', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '检查更新', exact: true }).click();
  await panel.getByRole('heading', { name: 'DSHM 0.1.0-preview.8', exact: true }).waitFor();
  assert.doesNotMatch(await panel.innerText(), /未声明|配套电脑插件/);
  await checkNotes('ordinary');
  report.checks.push('Ordinary settings: compact version metadata without redundant plugin warning');
  await panel.getByRole('button', { name: '下载更新', exact: true }).click();
  assert.equal(await panel.getByRole('progressbar').getAttribute('value'), '5500000');
  assert.equal(await panel.getByRole('button').count(), 2, 'Only close and cancel buttons while downloading');
  assert.doesNotMatch(await panel.innerText(), /请勿先卸载|进程结束|GitHub/);
  await page.screenshot({ path: resolve(folder, 'ordinary-downloading.png') });
  await panel.getByRole('button', { name: '取消下载', exact: true }).click();
  await panel.getByRole('button', { name: '重新下载', exact: true }).click();
  await page.evaluate(() => window.updateFixture.push({ phase: 'ready', received: 11000000 }));
  await panel.getByRole('button', { name: '安装更新', exact: true }).click();
  await panel.getByText('请在系统设置中允许安装', { exact: true }).waitFor();
  await page.evaluate(() => window.updateFixture.push({ phase: 'ready', error: 'update_permission_required' }));
  await panel.getByRole('alert').waitFor();
  report.checks.push('Download progress, cancel, retry, ready and install permission return');
  await page.screenshot({ path: resolve(folder, 'ordinary-update.png') });
  assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.evaluate(() => window.updateFixture.push({ phase: 'error', error: 'update_digest_mismatch' }));
  await panel.getByText('安装包校验失败，请重新下载。', { exact: true }).waitFor();
  report.checks.push('Checksum failure and narrow viewport remain readable');
  const failures = [
    ['update_package_mismatch', '新版与当前 App 的包名不一致，不能覆盖安装。'],
    ['update_release_tag_mismatch', '版本信息中的版本号与 Release 标签不一致，已停止更新。'],
    ['update_release_unsigned', '此版本标记为未签名，不能直接安装。'],
    ['update_apk_missing', '此版本缺少对应的 APK 安装包，请前往发行页查看。'],
  ];
  for (const [error, message] of failures) {
    await page.evaluate(error => window.updateFixture.push({ phase: 'error', error }), error);
    await panel.getByText(message, { exact: true }).waitFor();
  }
  report.checks.push('Ordinary page preserves distinct native package/tag/signing/asset failure messages');
  await page.goto(base + '/remote.html');
  await page.getByRole('button', { name: '连接选项', exact: true }).click();
  await page.getByRole('button', { name: /^软件更新/ }).click();
  await panel.getByText('当前已是最新版本', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.evaluate(() => window.updateFixture.push({ phase: 'available', release: window.updateFixture.release }));
  await page.getByRole('button', { name: '查看更新', exact: true }).click();
  await panel.getByRole('button', { name: '下载更新', exact: true }).waitFor();
  await checkNotes('remote');
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(folder, 'remote-update.png') });
  assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  report.checks.push('Remote connection menu and non-blocking startup notice share the update panel');
  for (const [error, message] of failures) {
    await page.evaluate(error => window.updateFixture.push({ phase: 'error', error }), error);
    await panel.getByText(message, { exact: true }).waitFor();
  }
  await page.screenshot({ path: resolve(folder, 'remote-update-errors.png') });
  report.checks.push('Remote page preserves the same distinct failure messages');
  await page.evaluate(() => window.updateFixture.push({ phase: 'current', error: null,
    release: { ...window.updateFixture.release, version: '0.1.0-preview.7', versionCode: 9 } }));
  await panel.getByText('当前已是最新版本', { exact: true }).waitFor();
  assert.equal(await panel.getByRole('button', { name: '下载更新', exact: true }).count(), 0);
  await checkNotes('current-version');
  report.checks.push('Current release keeps readable notes without a download button');
  assert.deepEqual(errors, []); report.errors = errors; report.passed = true;
  await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); server.close(); }
