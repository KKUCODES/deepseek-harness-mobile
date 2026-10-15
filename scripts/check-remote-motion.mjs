import assert from 'node:assert/strict';

/** 使用实际 RemoteWorkspace 与窗口组件，检查动画途中及结算后的交互契约。 */
export async function checkRemoteMotion(page) {
  const idle = () => page.waitForFunction(() => document.getAnimations().every(item => item.playState !== 'running'));
  const overflow = () => page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight }));
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(() => window.fixture.select('one'));
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await idle();
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('动画验收草稿'); await idle();
  assert.equal(await page.locator('[data-navigation-motion]').count(), 0, '输入更新不能重播整页动画');
  await page.evaluate(() => window.fixture.emitTurn('one', 1, 0, '远程追加的回复'));
  await page.getByText('远程追加的回复', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-navigation-motion]').count(), 0, '远程内容更新不能重播整页动画');
  await page.getByRole('button', { name: /选择模型，当前/ }).click();
  const dialog = page.getByRole('dialog', { name: '选择模型', exact: true });
  await dialog.waitFor(); await idle();
  const exit = await dialog.getByRole('button', { name: '关闭窗口', exact: true }).evaluate(button => {
    button.click();
    return new Promise(resolve => requestAnimationFrame(() => {
      const element = document.querySelector('dialog[open]');
      resolve({ connected: !!element, inert: element?.inert, state: element?.dataset.motionState });
    }));
  });
  assert.deepEqual(exit, { connected: true, inert: true, state: 'exit' });
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await input.innerText(), '动画验收草稿');
  await page.evaluate(() => window.fixture.back()); await idle();
  assert.ok(await page.locator('.remote-session-row').count() > 0);
  await page.evaluate(() => window.mountMotionProbe());
  await page.getByTestId('probe-trigger').waitFor();
  for (const kind of ['sheet', 'drawer', 'panel']) {
    await page.evaluate(value => window.motionProbe.open(value), kind); await idle();
    const element = page.locator(kind === 'panel' ? '.remote-plugin-panel' : 'dialog[open]').filter({ visible: true }).last();
    await element.waitFor();
    const during = await page.evaluate(() => {
      window.motionProbe.close();
      return new Promise(resolve => requestAnimationFrame(() => {
        const item = [...document.querySelectorAll('[data-motion-state="exit"]')].at(-1);
        resolve({ inert: item?.inert, animated: item?.getAnimations().some(animation => animation.playState === 'running') });
      }));
    });
    assert.deepEqual(during, { inert: true, animated: true });
    await idle();
    assert.equal(await page.locator('[data-motion-state="exit"]').count(), 0);
  }
  await page.getByTestId('probe-trigger').click(); await idle();
  await page.getByRole('textbox', { name: '窗口草稿' }).fill('窗口内容保持');
  const layout = await page.getByRole('button', { name: '切换全屏' }).evaluate(button => {
    button.click(); return new Promise(resolve => requestAnimationFrame(() => {
      const element = document.querySelector('dialog[open]');
      resolve({ state: element.dataset.motionState, frames: element.getAnimations()[0]?.effect.getKeyframes() });
    }));
  });
  assert.equal(layout.state, 'layout'); assert.equal(layout.frames.length, 2);
  await idle();
  assert.equal(await page.getByRole('textbox', { name: '窗口草稿' }).inputValue(), '窗口内容保持');
  await page.getByRole('button', { name: '切换全屏' }).click(); await idle();
  for (let index = 0; index < 6; index++) await page.getByRole('button', { name: '切换全屏' }).evaluate(element => element.click());
  await idle();
  assert.equal(await page.locator('dialog[open]').evaluate(element => element.style.transformOrigin), '');
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click(); await idle();
  assert.equal(await page.getByTestId('probe-trigger').evaluate(element => element === document.activeElement), true);
  for (let index = 0; index < 10; index++) {
    await page.evaluate(() => window.motionProbe.open('sheet'));
    await page.waitForFunction(() => document.querySelector('dialog[open]'));
    await page.evaluate(() => window.motionProbe.close());
    await page.evaluate(() => window.motionProbe.open('sheet'));
    await idle();
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await page.evaluate(() => window.motionProbe.close()); await idle();
  }
  await page.getByText('展开过程', { exact: true }).click(); await idle();
  assert.equal(await page.getByText('执行过程详情', { exact: true }).isVisible(), true);
  await page.getByText('展开过程', { exact: true }).click(); await idle();
  assert.equal(await page.getByText('执行过程详情', { exact: true }).isVisible(), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.motionProbe.open('sheet'));
  await page.getByRole('textbox', { name: '窗口草稿' }).waitFor();
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.evaluate(() => window.motionProbe.close());
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.evaluate(() => window.motionProbe.dispose());
  const size = await overflow(); assert.ok(size.width <= size.viewport, JSON.stringify(size));
  assert.equal(await page.locator('.remote-app:not([hidden])').evaluate(element => element.inert), false);
  return { navigation: true, streamingDoesNotReplay: true, enterExit: true, closeInert: true, draftPreserved: true,
    fullscreen: true, focusRestored: true, interruptedTenTimes: true, disclosure: true, reducedMotion: true, noHorizontalOverflow: true };
}
