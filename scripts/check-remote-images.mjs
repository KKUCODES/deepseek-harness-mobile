import assert from 'node:assert/strict';

export async function checkRemoteImages(page, { alpha2 = false, systemBack } = {}) {
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
  const failed = scope.getByRole('button', { name: '图片加载失败，点击重试', exact: true });
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
