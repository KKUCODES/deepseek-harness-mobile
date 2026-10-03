import assert from 'node:assert/strict';

// 实际 RemoteWorkspace + 原编辑器的浏览器回放；不连接真实电脑或模型。
export async function checkRemoteComposer(page) {
  await page.evaluate(() => window.fixture.select('one'));
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('第一行'); await input.press('Enter'); await input.pressSequentially('第二行');
  assert.equal(await input.innerText(), '第一行\n第二行', '普通 Enter 换行而非发送');
  await input.evaluate(element => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '中' }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229 }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
  });
  assert.equal(await input.innerText(), '第一行\n第二行', '组合输入及结束当刻不发送、不换行');
  await page.evaluate(() => window.fixture.select('two'));
  await input.fill('另一会话');
  await page.evaluate(() => window.fixture.select('one'));
  // 恢复原编辑器结构，保留 Enter 产生的换行节点，不再按纯文字重建段落。
  assert.equal(await page.evaluate(() => window.fixture.inputDraft()), '第一行\n第二行', '换会话保留独立草稿');
  assert.equal(await input.innerText(), '第一行\n第二行');
  const overflow = await page.evaluate(async () => {
    const editor = document.querySelector('[data-composer-input]'), widths = [];
    editor.blur();
    for (let i = 0; i < 20; i++) {
      if (i === 5) editor.focus();
      await new Promise(resolve => requestAnimationFrame(resolve));
      widths.push(document.documentElement.scrollWidth - document.documentElement.clientWidth);
    }
    return Math.max(...widths);
  });
  assert.ok(overflow <= 1, `输入框动画横向溢出 ${overflow}`);
  await input.fill('');
  return { enterNewline: true, compositionReplay: true, sessionDraftIsolation: true, transitionOverflow: overflow };
}
