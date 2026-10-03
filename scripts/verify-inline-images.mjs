import assert from 'node:assert/strict';
import { chooseDownload } from './android-picker-test.mjs';

const revoked = (page, url) => page.evaluate(src => new Promise(resolve => {
  const image = new Image(); image.onload = () => resolve(false); image.onerror = () => resolve(true); image.src = src;
}), url);

export async function verifyInlineImages(page, device, history) {
  const leftover = page.getByLabel('待发送附件', { exact: true }).getByRole('button', { name: '移除附件 dshm-image-input.png', exact: true });
  while (await leftover.count()) await leftover.first().click();
  const user = history.getByRole('button', { name: '查看附件 dshm-image-input.png', exact: true }).last();
  for (let index = 0; index < 10 && !await user.count(); index++) {
    const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
    if (!await older.count()) break;
    await older.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === '加载更早的消息' && button.disabled));
  }
  assert.equal(await user.count(), 1);
  await user.scrollIntoViewIfNeeded();
  const image = user.locator('img'); await image.waitFor();
  assert.equal(await image.evaluate(element => element.naturalWidth), 1024);
  const colors = await image.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(element, 0, 0);
    return [170, 512, 850].map(x => [...context.getImageData(x, 100, 1, 1).data].slice(0, 3));
  });
  assert.ok(colors[0][2] > 200 && colors[1][0] > 200 && colors[2][1] > 200, '真实历史 PNG 顶部蓝红绿');
  const firstUrl = await image.getAttribute('src');
  await page.screenshot({ path: 'artifacts/remote-inline-user-android.png' });
  await user.click();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  await preview.locator('img').waitFor();
  await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
  await preview.getByRole('button', { name: '下载完整文件', exact: true }).waitFor();
  await preview.getByRole('button', { name: '分享完整文件', exact: true }).waitFor();
  // Android 返回只关闭图片窗口，仍留在原会话。
  await device.shell('input keyevent 4');
  await preview.waitFor({ state: 'detached' });
  await page.locator('.remote-heading').filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
  await history.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await image.waitFor({ state: 'detached' });
  assert.equal(await revoked(page, firstUrl), true);
  await user.scrollIntoViewIfNeeded(); await image.waitFor();
  assert.notEqual(await image.getAttribute('src'), firstUrl);
  const tool = history.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^read_image · 已完成/ }) }).last();
  assert.equal(await tool.count(), 1);
  if (!await tool.getAttribute('open').then(value => value !== null)) await tool.locator('summary').click();
  const toolImage = tool.locator('.remote-inline-image img').first();
  await tool.locator('.remote-inline-image').first().scrollIntoViewIfNeeded(); await toolImage.waitFor();
  assert.equal(await toolImage.evaluate(element => element.naturalWidth), 1024);
  await page.screenshot({ path: 'artifacts/remote-inline-tool-android.png' });
  const toolUrl = await toolImage.getAttribute('src');
  await tool.locator('summary').click(); await toolImage.waitFor({ state: 'detached' });
  assert.equal(await revoked(page, toolUrl), true, '收起工具后释放图片');

  await page.getByRole('button', { name: '添加附件', exact: true }).click();
  await page.getByRole('button', { name: '从相册选择', exact: true }).click();
  await chooseDownload(device, 'dshm-image-input.png');
  const pending = page.getByLabel('待发送附件', { exact: true });
  await pending.locator('img').waitFor();
  await page.waitForFunction(() => { const image = document.querySelector('.remote-pending-files img'); return image?.complete && image.naturalWidth > 0; });
  assert.equal(await pending.locator('img').evaluate(element => element.naturalWidth), 1024);
  const draftUrl = await pending.locator('img').getAttribute('src');
  await pending.getByRole('button', { name: '移除附件 dshm-image-input.png', exact: true }).click();
  await pending.waitFor({ state: 'detached' });
  assert.equal(await revoked(page, draftUrl), true);

  await user.scrollIntoViewIfNeeded(); await image.waitFor();
  const sessionUrl = await image.getAttribute('src');
  await page.getByRole('button', { name: '返回', exact: true }).click();
  assert.equal(await revoked(page, sessionUrl), true, '离开会话释放 URL');
  assert.equal(await page.locator('.remote-inline-image').count(), 0);
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await user.scrollIntoViewIfNeeded(); await image.waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
  return { originalUserImage: true, colors, toolImage: true, fullScreen: true, androidBack: true,
    offscreenReleased: true, collapsedToolReleased: true, sessionReleased: true, reload: true,
    albumDraft: true, removedDraftReleased: true, horizontalOverflow: false };
}
