import assert from 'node:assert/strict';

/** 在真实聊天容器模拟异步插件高度和输入区尺寸变化，不伪造会话状态。 */
export async function checkRemoteResizeFollow(page, chat) {
  const settle = () => page.evaluate(() => new Promise(resolve => {
    let frames = 5;
    const next = () => --frames ? requestAnimationFrame(next) : resolve();
    requestAnimationFrame(next);
  }));
  const distance = () => chat.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop);
  await chat.evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle();
  assert.ok(await distance() < 2);
  try {
    await chat.evaluate(el => {
      const extra = document.createElement('div');
      extra.dataset.resizeProbe = ''; extra.style.height = '1000px';
      el.querySelector('.messages').append(extra);
    });
    await settle();
    const contentDistance = await distance();
    assert.ok(contentDistance < 2, `异步内容增高后应跟随底部，偏离 ${contentDistance}px`);
    const previousStyle = await chat.getAttribute('style');
    try {
      await chat.evaluate(el => { el.style.height = `${el.clientHeight - 40}px`; el.style.flex = 'none'; });
      await settle();
      assert.ok(await distance() < 2, '可视区缩小后仍跟随底部');
      await chat.evaluate(el => { el.scrollTop = el.scrollHeight * .35; }); await settle();
      const reading = await chat.evaluate(el => el.scrollTop);
      assert.ok(await distance() > 80, '阅读位置须离开现有尾部跟随范围');
      await chat.evaluate(el => { el.querySelector('[data-resize-probe]').style.height = '1100px'; });
      await settle();
      assert.ok(Math.abs(await chat.evaluate(el => el.scrollTop) - reading) < 2, '翻阅历史时不得被尺寸变化拉回尾部');
    } finally {
      await chat.evaluate((el, style) => style === null ? el.removeAttribute('style') : el.setAttribute('style', style), previousStyle);
    }
  } finally { await chat.evaluate(el => el.querySelector('[data-resize-probe]')?.remove()); }
  return { contentResize: true, viewportResize: true, readingPreserved: true };
}
