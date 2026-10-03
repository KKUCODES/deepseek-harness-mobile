import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';
import { chooseDownload } from './android-picker-test.mjs';
import { attachmentImageFixture } from './attachment-image-fixture.mjs';

// 仅使用既有 DSH-TEST 归档测试会话；阶段间由调用方结束并重开 App。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'verify', 'clean'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const button = name => page.getByRole('button', { name, exact: true });
  const chat = JSON.parse(await readFile('artifacts/workflow-failure-seed.json', 'utf8')).chat;
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  if (await editor.count()) {
    assert.ok(['DSHM Remote 联调提示', chat].includes(await workspace.locator('.remote-heading').innerText()));
    await button('返回').click();
  }
  await button('Remote 选项').click();
  if (await button('查看已归档聊天').count()) await button('查看已归档聊天').click();
  else await button('关闭窗口').click();
  await button(new RegExp(`^${chat}`)).click(); await page.locator('[data-workflow-run]').waitFor(); await editor.waitFor();
  const pending = page.getByLabel('待发送附件', { exact: true });
  const saved = () => page.getByText('正在保存草稿…', { exact: true }).waitFor({ state: 'detached' });
  let seed;
  if (phase === 'prepare') {
    assert.equal(await editor.inputValue(), ''); assert.equal(await pending.count(), 0);
    const stamp = Date.now(), png = attachmentImageFixture(1024, 1024, [2, 0, 1]);
    seed = { chat, marker: `DSHM_ATTACHMENT_RESTORED_${stamp}`, file: `dshm-draft-${stamp}.txt`, image: `dshm-draft-${stamp}.png`,
      hash: createHash('sha256').update(png).digest('hex'), replies: await page.getByRole('article', { name: '模型回复' }).count() };
    await writeFile('artifacts/attachment-draft-seed.json', JSON.stringify(seed, null, 2));
    for (const [name, bytes] of [[seed.file, Buffer.from(seed.marker)], [seed.image, png]]) {
      await device.push(bytes, `/sdcard/Download/${name}`);
      await button('添加附件').click(); await button('选择文件').click(); await chooseDownload(device, name);
      await pending.locator('.remote-file').filter({ hasText: name }).getByText(/已上传|待发送图片/).waitFor({ timeout: 60000 }); await saved();
    }
    await editor.fill('附件恢复测试，尚未发送'); await saved();
    // 改写我们自己创建的下载文件，证明恢复读取的是已保存原件而非旧 URI。
    await device.push(Buffer.from('REPLACED_TEST_SOURCE'), `/sdcard/Download/${seed.file}`);
    await device.push(Buffer.from('REPLACED_TEST_SOURCE'), `/sdcard/Download/${seed.image}`);
    report.saved = true;
  } else {
    seed = JSON.parse(await readFile('artifacts/attachment-draft-seed.json', 'utf8'));
    if (phase === 'verify') {
      assert.equal(await editor.inputValue(), '附件恢复测试，尚未发送');
      assert.equal(await page.getByRole('article', { name: '模型回复' }).count(), seed.replies);
      await pending.getByText('已恢复本机原件，重新准备后即可发送', { exact: true }).waitFor();
      const image = pending.locator('.remote-file').filter({ hasText: seed.image }).locator('img');
      const hash = await image.evaluate(async node => {
        await node.decode();
        const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(node, 0, 0);
        const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
        return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
      });
      const png = attachmentImageFixture(1024, 1024, [2, 0, 1]);
      const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33))), rgba = Buffer.alloc(1024 * 1024 * 4, 255);
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) raw.copy(rgba, (y * 1024 + x) * 4, y * 3073 + 1 + x * 3, y * 3073 + 4 + x * 3);
      assert.equal(hash, createHash('sha256').update(rgba).digest('hex')); report.imageOriginalPixelsRestored = true;
      await page.screenshot({ path: 'artifacts/attachment-draft-restored-android.png' });
      await button('重新准备附件').click();
      await pending.locator('.remote-file').filter({ hasText: seed.file }).getByText(/已上传/).waitFor({ timeout: 60000 }); await saved();
      await button(`移除附件 ${seed.image}`).click(); await saved();
      await editor.fill(`这是 DSHM 附件草稿恢复联调。只读取本轮附件 ${seed.file}，只回复文件完整文本，不修改任何文件，不调用其他工具。`); await saved();
      await button('发送消息').click();
      await pending.waitFor({ state: 'detached', timeout: 60000 });
      await page.getByRole('article', { name: '模型回复' }).getByText(seed.marker, { exact: true }).waitFor({ timeout: 90000 });
      await button('停止生成').waitFor({ state: 'detached', timeout: 60000 }); await saved();
      report.fileOriginalSent = true; report.noAutomaticSend = true;
    } else { assert.equal(await editor.inputValue(), ''); assert.equal(await pending.count(), 0); report.clearedAfterRestart = true; }
  }
  assert.equal(await page.getByText(/附件草稿未能保存/).count(), 0);
  await page.screenshot({ path: `artifacts/attachment-draft-${phase}-android.png` });
  await button('返回').click(); await button('Remote 选项').click(); await button('查看最近聊天').click(); await button(/^DSHM Remote 联调提示/).click();
  report.returned = true; assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/attachment-draft-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
