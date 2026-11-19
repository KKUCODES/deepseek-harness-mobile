import assert from 'node:assert/strict';

export async function checkRemoteDraftImages(page) {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    window.fixture.toolLocale('zh');
    await window.preview15.images.open({ count: 1 });
    const transport = window.preview15.model.transport;
    transport.capabilities.channels = [...new Set([...(transport.capabilities.channels ?? []), 'prompt'])];
  });
  const scope = page.getByTestId('remote-workspace');
  const original = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 700;
    canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await scope.getByRole('button', { name: '添加附件', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'), page.getByRole('button', { name: '从相册选择', exact: true }).click(),
  ]);
  const names = Array.from({ length: 6 }, (_, index) => `narrow-viewport-wide-image-${index + 1}.png`);
  await chooser.setFiles(names.map(name => ({ name, mimeType: 'image/png', buffer: Buffer.from(original, 'base64') })));
  const draft = scope.getByTestId('remote-draft-images');
  const rail = draft.getByRole('group', { name: '待发送附件' });
  await page.waitForFunction(count => [...document.querySelectorAll('[data-testid="remote-draft-images"] img')]
    .filter(image => image.complete && image.naturalWidth === 1400).length === count, names.length);
  const layout = await rail.evaluate(node => ({
    scrollable: node.scrollWidth > node.clientWidth,
    cards: [...node.querySelectorAll('img')].map(image => image.closest('button').getBoundingClientRect()),
    pageFits: document.documentElement.scrollWidth === document.documentElement.clientWidth,
  }));
  assert.equal(layout.scrollable, true);
  assert.equal(layout.pageFits, true);
  assert.ok(layout.cards.every((card, index) => card.width === 64 && card.height === 64
    && (!index || layout.cards[index - 1].right <= card.left)));
  assert.equal(await draft.locator('[data-remote-image-gallery]').count(), 0);
  await rail.getByRole('button', { name: names.at(-1), exact: true }).click();
  const lightbox = page.getByRole('dialog', { name: '原图预览', exact: true });
  await lightbox.waitFor();
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await lightbox.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.preview15.model.getSnapshot().selected), 'one');
  for (const name of names.reverse()) await rail.getByRole('button', { name: `移除图片 ${name}`, exact: true }).click();
  await draft.waitFor({ state: 'detached' });
  assert.equal(await scope.locator('.conversation [data-remote-image-gallery] img').count(), 2);
  return { narrowViewport: 320, thumbnail: 64, horizontalRail: true, previewBack: true, remove: true, sentGallery: true };
}

export async function checkRemoteImages(page, { alpha2 = false, systemBack, fallbackOnly = false } = {}) {
  // 动画驱动器合同已在KKC-118单独定位；这里独立验证图片，不夹带其修复。
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.fixture.toolLocale('zh'); });
  await page.evaluate(() => window.preview15.images.open({ count: 1 }));
  const scope = page.getByTestId('remote-workspace');
  const retryAll = async buttons => {
    while (await buttons.count()) {
      const button = await buttons.first().elementHandle();
      const text = await button.textContent();
      await button.click();
      await page.waitForFunction(({ element, text }) => !element.isConnected || element.textContent !== text, { element: button, text });
      await button.dispose();
    }
  };
  const imageReady = count => page.waitForFunction(count => {
    const root = document.querySelector('[data-testid="remote-workspace"]');
    return root.textContent.includes('IMAGE_ANSWER_TEXT') && [...root.querySelectorAll('.conversation img')]
      .filter(image => image.complete && image.naturalWidth === 160).length === count;
  }, count);
  // 必须读取成功并真正解码；仅检查占位和已接收事件无法覆盖原空白问题。
  await imageReady(2);
  assert.equal(await scope.getByText('IMAGE_USER_TEXT', { exact: true }).count(), 1);
  assert.deepEqual((await page.evaluate(() => window.preview15.images.state())).errors, []);
  const report = { snapshot: true };
  await page.evaluate(() => window.preview15.images.open({ count: 2, live: true }));
  await imageReady(3); report.liveMultiple = true;
  const image = scope.locator('.conversation img').first();
  await image.click();
  const lightbox = page.getByRole('dialog', { name: '原图预览', exact: true });
  await lightbox.waitFor();
  await lightbox.getByRole('button', { name: '关闭原图预览', exact: true }).click();
  report.originalLightbox = true;
  await image.click(); await lightbox.waitFor();
  if (systemBack) await systemBack();
  else assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await lightbox.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.preview15.model.getSnapshot().selected), 'one', '系统返回先关闭图库，不能离开会话');
  report.lightboxBackPriority = true;
  await page.evaluate(() => window.preview15.images.open()); await imageReady(2); report.reopen = true;
  await page.evaluate(() => { window.preview15.images.failure(true); return window.preview15.images.open(); });
  // 附件读取失败改为手机端失败卡，重试按钮文字是“重新加载”。
  const failed = scope.getByRole('button', { name: '重新加载', exact: true });
  await failed.first().waitFor();
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1);
  await page.evaluate(() => window.preview15.images.failure(false));
  await retryAll(failed);
  await imageReady(2); report.failureRetry = true;
  await page.evaluate(() => { window.preview15.images.corrupt(true); return window.preview15.images.open(); });
  const decodeRetry = scope.getByRole('button', { name: '图片加载失败，点击重试', exact: true });
  await decodeRetry.first().waitFor();
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1);
  await page.evaluate(() => window.preview15.images.corrupt(false));
  await retryAll(decodeRetry); await imageReady(2); report.decodeFailureRetry = true;
  await page.evaluate(() => { window.preview15.images.renderFailure(true); return window.preview15.images.open(); });
  const recovery = scope.getByRole('button', { name: '图片加载失败，点击重试', exact: true });
  await recovery.first().waitFor();
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1, '画廊渲染异常只移除图片');
  await page.evaluate(() => window.preview15.images.renderFailure(false));
  await retryAll(recovery);
  await imageReady(2); report.renderFailureRetry = true;
  if (fallbackOnly) return report;
  const slot = alpha2 ? 'conversation.message.images' : 'conversation.chat.user.images';
  await page.evaluate(slot => window.preview15.images.plugin(slot), slot);
  await scope.locator(`[data-image-slot="${slot}"]`).first().waitFor();
  const frame = scope.locator('[data-plugin-frame="@fixture/image-slot"]').first();
  await frame.waitFor();
  await page.evaluate(() => window.preview15.model.pluginSlots.layout.setUser('@fixture/image-slot', false));
  await page.waitForFunction(() => document.querySelector('[data-plugin-frame="@fixture/image-slot"]')?.dataset.autoFit === 'false');
  await page.evaluate(() => window.preview15.model.pluginSlots.layout.setUser('@fixture/image-slot', true));
  report.pluginFitSetting = true;
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1);
  await page.evaluate(() => window.preview15.images.disablePlugin()); await imageReady(2);
  report.pluginReplacement = true;
  await page.evaluate(slot => window.preview15.images.plugin(slot, true), slot);
  await recovery.first().waitFor();
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1);
  const state = await page.evaluate(() => window.preview15.images.state());
  assert.ok(!state.errors.some(error => error.slot === slot), '每次图片调用局部保护，不撤下共享图片注册项');
  assert.ok(!state.errors.some(error => error.slot === 'dshm.chat.node'), '图片异常不能撤下共用聊天节点');
  await page.evaluate(() => window.preview15.images.disablePlugin());
  await imageReady(2);
  report.pluginCrashIsolated = true;
  await page.evaluate(() => window.preview15.images.originalPlugin());
  await imageReady(2); report.originalAttachmentPlugin = true;
  await page.evaluate(() => { window.preview15.images.renderFailure(true); return window.preview15.images.open(); });
  await recovery.first().waitFor();
  assert.equal(await scope.getByText('IMAGE_ANSWER_TEXT', { exact: true }).count(), 1);
  await page.evaluate(() => window.preview15.images.renderFailure(false));
  await retryAll(recovery); await imageReady(2);
  report.originalFactoryFailureRetry = true;
  await page.evaluate(() => window.preview15.images.tool());
  await scope.locator('button[data-turn-process="2"]').click();
  const tool = scope.locator('.remote-tool-card').filter({ hasText: 'IMAGE_TOOL_TEXT' });
  await tool.locator('summary').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.remote-tool-card img')].some(image => image.complete && image.naturalWidth === 160));
  report.toolImage = true;
  await page.evaluate(() => window.preview15.images.open({ asFile: true }));
  await scope.getByRole('button', { name: '查看附件 图片回归.png', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.remote-file-preview img')].some(image => image.complete && image.naturalWidth === 160));
  await page.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  report.fileIdentityAndPreview = true;
  await page.evaluate(() => window.fixture.select('two'));
  await page.evaluate(() => window.fixture.emitTurn('two', 1, 0, 'OTHER_CHAT_STILL_READABLE'));
  await scope.getByText('OTHER_CHAT_STILL_READABLE', { exact: true }).waitFor();
  report.otherChat = true;
  await page.evaluate(async () => {
    await window.preview15.images.prepareChild();
    await window.fixture.enableSidebarResources();
    window.preview15.model.sessions.handleSessionStatus('one', false);
  });
  await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('group', { name: '分析助手', exact: true }).getByRole('button', { name: '在旁栏打开', exact: true }).click();
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-testid="remote-sidebar-conversation"]');
    return root?.textContent.includes('IMAGE_ANSWER_TEXT') && [...root.querySelectorAll('.conversation img')]
      .filter(image => image.complete && image.naturalWidth === 160).length === 2;
  });
  report.sidebar = true;
  await page.evaluate(() => window.fixture.legacyImagePreview());
  await page.waitForFunction(() => [...document.querySelectorAll('.remote-file-preview img')].some(image => image.complete && image.naturalWidth === 160));
  report.legacyFilePreview = true;
  return report;
}
