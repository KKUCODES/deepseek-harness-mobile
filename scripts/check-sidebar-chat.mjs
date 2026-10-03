import assert from 'node:assert/strict';

// 原资源/旁栏标签/SessionReference与正式聊天界面，传输使用页面标明的协议回放。
export async function checkSidebarChat(page) {
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  const main = page.getByTestId('remote-workspace');
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await page.evaluate(() => window.fixture.holdSelection());
  await main.getByRole('button', { name: /^one/ }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await main.getByRole('button', { name: '返回', exact: true }).isDisabled(), true);
  await page.evaluate(() => window.fixture.releaseSelection());
  await page.waitForFunction(() => !document.querySelector('[data-testid="remote-workspace"] button[aria-label="返回"]').disabled);
  assert.equal(await page.evaluate(() => window.fixture.insertSidebarReference()), true);
  await main.locator('[data-composer-chip="fixture"]').waitFor();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const open = async label => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '子会话', exact: true }).click();
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: label, exact: true })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    await aside.waitFor();
  };
  await open('资料检查');
  await aside.getByText('这是一次性子任务，可以查看执行记录。', { exact: true }).waitFor();
  assert.equal(await aside.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await main.locator('[data-composer-chip="fixture"]').waitFor();
  await open('分析助手');
  const input = aside.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('仅旁栏发送');
  await page.evaluate(() => window.fixture.enableComposerBarProbe());
  const pluginInput = aside.getByRole('textbox', { name: '插件消息', exact: true });
  await pluginInput.waitFor(); assert.equal(await pluginInput.inputValue(), '仅旁栏发送');
  const barWidth = await aside.getByTestId('composer-bar-probe').evaluate(node => ({
    displayed: node.getBoundingClientRect().width, viewport: innerWidth,
    ancestors: [...function* () { for (let at = node.parentElement; at; at = at.parentElement) yield at; }()]
      .map(at => ({ tag: at.tagName, class: at.className, frame: at.dataset.pluginFrame,
        width: at.getBoundingClientRect().width, minWidth: getComputedStyle(at).minWidth, display: getComputedStyle(at).display })),
  }));
  assert.ok(barWidth.displayed <= barWidth.viewport + 0.01, JSON.stringify(barWidth));
  assert.equal(await aside.getByTestId('input-dock-probe').getAttribute('data-session'), 'child-chat');
  await aside.getByRole('button', { name: '插件发送', exact: true }).click();
  await page.waitForFunction(() => window.fixture.sidebarState().prompts.length === 1);
  const sent = (await page.evaluate(() => window.fixture.sidebarState())).prompts[0];
  assert.equal(sent.parentSessionId, 'one'); assert.equal(sent.childSessionId, 'child-chat');
  assert.deepEqual(sent.content, [{ type: 'text', text: '仅旁栏发送' }]);
  await page.waitForFunction(() => document.querySelector('[data-testid="composer-bar-probe"] input')?.value === '');
  await page.evaluate(() => window.fixture.disableComposerBarProbe());
  await input.waitFor();
  await input.fill('可继续子会话草稿');
  await page.evaluate(async () => { await window.fixture.enableComposerProbe(); window.fixture.composerTakeover('child-chat'); });
  const takeover = aside.getByTestId('composer-takeover'); await takeover.waitFor();
  assert.equal(await takeover.getAttribute('data-session'), 'child-chat');
  assert.equal(await takeover.locator('span').innerText(), '可继续子会话草稿');
  assert.equal(await input.count(), 0);
  await takeover.getByRole('button', { name: '完成插件输入' }).click();
  await input.waitFor(); assert.equal(await input.innerText(), '可继续子会话草稿');
  await page.evaluate(() => window.fixture.disableComposerProbe());
  const geometry = await aside.evaluate(node => {
    const box = node.getBoundingClientRect(), panel = node.closest('.remote-plugin-panel-content').getBoundingClientRect();
    return { width: box.width, height: box.height, panelHeight: panel.height, cssHeight: node.clientHeight,
      headerTop: node.querySelector('header').getBoundingClientRect().top, panelTop: panel.top };
  });
  assert.ok(Math.abs(geometry.height - geometry.cssHeight) < 1, 'DSHM自己的聊天不能被插件外层缩小');
  assert.ok(geometry.height <= geometry.panelHeight + 1 && geometry.headerTop >= geometry.panelTop - 1, '聊天与输入框受面板高度约束');
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).drafts.one.trim(), '@handoff');
  await aside.getByRole('button', { name: '返回父会话', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-sidebar-conversation"]:not([hidden])'));
  await input.waitFor();
  await input.locator('[data-composer-chip="fixture"]').waitFor();
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await page.evaluate(() => window.fixture.referenceMenuSetup());
  await aside.getByRole('button', { name: '添加附件', exact: true }).click();
  await page.getByRole('dialog', { name: '附件', exact: true }).getByRole('button', { name: '引用文件或聊天', exact: true }).click();
  const referencePicker = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
  await referencePicker.getByRole('button', { name: '引用 menu file.txt', exact: true }).click();
  await referencePicker.waitFor({ state: 'detached' });
  assert.equal(await input.locator('[data-composer-chip]').count(), 2, '旁栏菜单保留已有引用');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).locator('[data-composer-chip="fixture"]').waitFor();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).locator('[data-composer-chip]').count(), 2, '返回主聊天仍保留菜单引用');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  await panel.getByRole('navigation', { name: '已打开的面板', exact: true }).getByRole('button', { name: 'child-chat', exact: true }).click();
  await input.fill('旁栏恢复草稿');
  await page.evaluate(() => window.fixture.seedSidebarOutput());
  const savedViews = await page.evaluate(() => window.fixture.rebuildSidebarPage());
  assert.ok(savedViews.some(([, saved]) => saved.selected === 'one'));
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  await output.getByText('旁栏已确认输出', { exact: true }).waitFor();
  assert.match(await output.getAttribute('class'), /is-fullscreen/);
  assert.equal(await output.getByRole('button', { name: '错误输出', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await output.getByRole('button', { name: '从头查看', exact: true }).getAttribute('aria-pressed'), 'true');
  await output.getByRole('status').filter({ hasText: '21 / 42 字节' }).waitFor();
  // 切走主会话会实际卸载整个旁栏，返回仍需恢复当前导航与只读输出，而非初始地址。
  await page.evaluate(() => window.fixture.select('two'));
  await aside.waitFor({ state: 'hidden' });
  await page.evaluate(() => window.fixture.select('one'));
  await output.getByText('旁栏已确认输出', { exact: true }).waitFor();
  await aside.locator('.remote-heading strong').getByText('one', { exact: true }).waitFor();
  await output.getByRole('status').filter({ hasText: '21 / 42 字节' }).waitFor();
  await page.evaluate(() => window.fixture.rebuildSidebarPage());
  await output.getByText('旁栏已确认输出', { exact: true }).waitFor();
  await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  const afterClose = await page.evaluate(() => window.fixture.rebuildSidebarPage());
  assert.ok(afterClose.every(([, saved]) => !saved.jobOutput));
  assert.equal(await output.count(), 0);
  await aside.locator('.remote-heading strong').getByText('one', { exact: true }).waitFor();
  assert.equal(await input.innerText(), '旁栏恢复草稿');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const primaryInput = main.getByRole('textbox', { name: '消息', exact: true });
  await primaryInput.waitFor();
  assert.equal(await primaryInput.innerText(), '旁栏恢复草稿');
  await primaryInput.fill('主输入仍可编辑');
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).drafts.one, '主输入仍可编辑');
  await primaryInput.fill('');
  return { originalResourceAndTab: true, ownSharedWorkspace: true, oneShotReadOnly: true,
    scopedSend: true, primarySelectionPreserved: true, sameSessionInputReturn: true, structuredReferenceHandoff: true, referenceMenuHandoff: true,
    sidebarSelectionRestored: true, sidebarOutputRestored: true, switchedSessionRestored: true, closedOutputNotRestored: true, navigationBusyVisible: true };
}
