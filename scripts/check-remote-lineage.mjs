import assert from 'node:assert/strict';

export async function checkRemoteLineage(page) {
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('根草稿');
  await page.evaluate(() => window.fixture.enableLineage());
  const root = page.getByTestId('lineage-one');
  await root.waitFor();
  assert.equal(await root.getAttribute('data-session'), 'one');
  assert.equal(await root.getAttribute('data-ancestor'), 'false');
  await page.evaluate(() => window.fixture.openChild('child-chat'));
  const child = page.getByTestId('lineage-child-chat');
  await child.waitFor();
  assert.equal(await child.getAttribute('data-ancestor'), 'false');
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('子草稿');
  await page.evaluate(() => window.fixture.openChild('grandchild'));
  await page.getByTestId('lineage-grandchild').waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
  assert.equal(await child.getAttribute('data-session'), 'grandchild');
  assert.equal(await child.getAttribute('data-ancestor'), 'true');
  await child.click();
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), '子草稿');
  await page.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: 'one', exact: true }).click();
  await root.waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), '根草稿');
  await page.evaluate(() => window.fixture.staleLineage());
  await page.getByRole('alert').filter({ hasText: '聊天已切换，请在当前聊天中操作。' }).waitFor();
  assert.equal(await root.getAttribute('data-session'), 'one');
  await page.evaluate(() => window.fixture.removeLineage());
  await root.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.remote-heading strong').innerText(), 'one');
  // 点击原组件入口，不能依赖桌面悬停打开；菜单内部仍使用原树形组件。
  const main = page.getByTestId('remote-workspace');
  const tree = page.getByRole('tree', { name: 'Subagent sessions', exact: true });
  const trigger = main.locator('.remote-heading button[aria-haspopup="tree"]');
  await trigger.dispatchEvent('pointerdown', { pointerType: 'touch' });
  await trigger.dispatchEvent('click');
  await tree.waitFor();
  // WebView触摸后生成兼容mouseout；超过原120ms关闭计时器仍应能继续点菜单。
  await trigger.evaluate(node => node.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
  await page.waitForTimeout(180);
  assert.equal(await tree.isVisible(), true, '触摸打开的菜单不能被兼容鼠标离开事件关闭');
  await tree.getByRole('treeitem', { name: /^分析助手 / }).click();
  await main.getByRole('button', { name: 'Switch subagent: 分析助手', exact: true }).waitFor();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '子草稿');
  assert.equal(await page.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: 'one', exact: true }).count(), 1);
  await main.getByRole('button', { name: 'Switch subagent: 分析助手', exact: true }).dispatchEvent('click');
  await tree.getByRole('button', { name: 'Expand 分析助手 descendants', exact: true }).click();
  await tree.getByRole('treeitem', { name: /^孙会话 / }).click();
  await main.getByRole('button', { name: 'Switch subagent: 孙会话', exact: true }).waitFor();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
  await main.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: 'one', exact: true }).click();
  await main.locator('.remote-heading button[aria-haspopup="tree"]').dispatchEvent('click');
  await tree.getByRole('button', { name: 'Open 分析助手 in sidebar', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('button', { name: 'Switch subagent: 分析助手', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await aside.getByRole('button', { name: 'Switch subagent: 分析助手', exact: true }).dispatchEvent('click');
  await tree.getByRole('treeitem', { name: /^资料检查 / }).click();
  await aside.getByRole('button', { name: 'Switch subagent: 资料检查', exact: true }).waitFor();
  assert.equal(await aside.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '根草稿');
  return { ownerContract: true, nestedAncestorNavigation: true, readOnlyChild: true, draftsPreserved: true,
    staleCallbackRejected: true, unloadFallback: true, originalDropdownClick: true, nestedTree: true, sidebarNavigationScoped: true };
}
