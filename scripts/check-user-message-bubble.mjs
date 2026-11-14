import assert from 'node:assert/strict';

export const bubblePrompt = `窄屏长消息回归\n${'DSHM_UNBROKEN_TOKEN_'.repeat(12)}\n结尾应完整可见`;

export async function checkUserMessageBubble(page) {
  const bubble = page.locator('[data-message-bubble]').filter({ hasText: '窄屏长消息回归' });
  await bubble.waitFor();
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'
    || animation.effect?.getTiming().iterations === Infinity));
  const layout = await bubble.evaluate(element => {
    const style = getComputedStyle(element);
    const text = document.createRange();
    text.selectNodeContents(element);
    const lines = [...text.getClientRects()];
    const box = element.getBoundingClientRect();
    return {
      text: element.textContent,
      background: style.backgroundColor,
      padding: style.padding,
      whiteSpace: style.whiteSpace,
      wordBreak: style.wordBreak,
      lineCount: new Set(lines.map(line => line.top)).size,
      viewport: innerWidth,
      left: box.left,
      right: box.right,
      textLeft: Math.min(...lines.map(line => line.left)),
      textRight: Math.max(...lines.map(line => line.right)),
      fits: box.left >= 0 && box.right <= innerWidth + 1
        && lines.every(line => line.left >= box.left - 1 && line.right <= box.right + 1),
    };
  });
  assert.equal(layout.text, bubblePrompt);
  assert.notEqual(layout.background, 'rgba(0, 0, 0, 0)');
  assert.equal(layout.padding, '10px 16px');
  assert.equal(layout.whiteSpace, 'pre-wrap');
  assert.equal(layout.wordBreak, 'break-word');
  assert.ok(layout.lineCount > 3 && layout.fits, JSON.stringify(layout));
}
