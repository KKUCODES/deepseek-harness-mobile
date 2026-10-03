import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chooseDownload } from './android-picker-test.mjs';

/** 只使用自造附件和既有专用会话，验证真实系统选择器到原附件沙箱的完整链路。 */
export async function verifyHtmlAttachment(page, device, history) {
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  const stem = `dshm-html-attachment-${Date.now()}`;
  const good = `${stem}.html`, missing = `${stem}-missing.html`;
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;background:#f3f6ff;padding:20px;color:#182746}button{padding:12px;border:0;border-radius:12px;background:#315bc7;color:white}</style><h1>原始 HTML 附件</h1><p id="ready">等待脚本</p><button id="count">计数 0</button><script>document.querySelector("#ready").textContent="附件内脚本已加载";let n=0;document.querySelector("#count").onclick=()=>document.querySelector("#count").textContent="计数 "+(++n);</script>';
  for (const [name, data] of [[good, html], [missing, '<!doctype html><h1>缺失依赖</h1><script src="private.js"></script>']]) {
    await writeFile(`artifacts/${name}`, data);
    await device.push(Buffer.from(data), `/sdcard/Download/${name}`);
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
    await chooseDownload(device, name);
    await page.getByLabel('待发送附件', { exact: true }).locator('.remote-file').filter({ hasText: name }).getByText(/已上传/).waitFor();
  }
  const before = await history.getByRole('article', { name: '模型回复' }).count();
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 HTML 附件预览联调，只回复 DSHM_HTML_ATTACHMENT_READY，不读取附件，不调用工具。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByLabel('待发送附件', { exact: true }).waitFor({ state: 'detached', timeout: 60000 });
  await history.getByRole('article', { name: '模型回复' }).nth(before).filter({ hasText: 'DSHM_HTML_ATTACHMENT_READY' }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  await history.getByRole('button', { name: `查看附件 ${good}`, exact: true }).click();
  const frame = page.frameLocator('iframe[title="HTML 文件预览"]');
  await frame.getByText('附件内脚本已加载', { exact: true }).waitFor();
  await frame.getByRole('button', { name: '计数 0', exact: true }).click();
  await frame.getByRole('button', { name: '计数 1', exact: true }).waitFor();
  const isolation = await frame.locator('body').evaluate(async () => {
    const result = { origin: self.origin, bridge: typeof window.DSHMRemote, ordinary: typeof window.DSHMOrdinary };
    try { void parent.document.body; result.parentBlocked = false; } catch { result.parentBlocked = true; }
    try { localStorage.setItem('test', '1'); result.storageBlocked = false; } catch { result.storageBlocked = true; }
    try { await fetch('https://remote.dshm.invalid/assets/web/remote.html'); result.networkBlocked = false; } catch { result.networkBlocked = true; }
    return result;
  });
  assert.deepEqual(isolation, { origin: 'null', bridge: 'undefined', ordinary: 'undefined', parentBlocked: true, storageBlocked: true, networkBlocked: true });
  await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
  await page.screenshot({ path: 'artifacts/remote-html-attachment-android.png' });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('iframe').length === 0);
  assert.equal((await device.shell('run-as dev.dshmobile.validation ls cache/remote-html')).toString().trim(), '');
  // 修改上传前的本地样例不应改变已经发送的原始附件。
  await writeFile(`artifacts/${good}`, '<h1>不得替换历史附件</h1>');
  await history.getByRole('button', { name: `查看附件 ${good}`, exact: true }).click();
  await frame.getByRole('heading', { name: '原始 HTML 附件', exact: true }).waitFor();
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  await history.getByRole('button', { name: `查看附件 ${missing}`, exact: true }).click();
  await preview.getByRole('alert').filter({ hasText: '附件缺少引用的脚本或样式' }).waitFor();
  assert.equal(await preview.locator('iframe').count(), 0);
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  return { good, missing, isolation, interactive: true, fullscreen: true, immutableOriginal: true, missingDependencyRejected: true, stagingEmpty: true };
}
