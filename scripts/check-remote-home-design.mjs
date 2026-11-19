import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { WORKSPACE_CHAT_STORAGE_KEY } from '../src/remote-home-workspaces.mjs';

/** 正式 RemoteWorkspace + 原会话模型回放，列表入口没有替换成展示组件。 */
export async function checkRemoteHomeDesign(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(() => { window.fixture.backNavigationProject(); return window.fixture.select(null); });
  const main = page.getByTestId('remote-workspace');
  await main.getByRole('button', { name: /我的工作电脑/ }).waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 820 });
    for (const dark of [false, true]) {
      await page.evaluate(value => document.body.toggleAttribute('data-ds-dark-theme', value), dark);
      assert.equal(await main.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true);
      assert.equal(await main.locator('.dhp-title').first().evaluate(e => getComputedStyle(e).fontSize), '16px');
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
      const heading = main.getByRole('heading', { level: 1 });
      assert.equal(await heading.innerText(), 'Remote');
      assert.equal(await heading.evaluate(e => getComputedStyle(e).color), dark ? 'rgb(243, 245, 250)' : 'rgb(21, 23, 30)', '首页使用手机页面槽主题颜色');
      assert.ok((await heading.boundingBox()).y >= 0);
      await page.screenshot({ path: resolve(output, `home-${width}-${dark ? 'dark' : 'light'}.png`), animations: 'disabled' });
    }
  }
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
  await main.getByRole('button', { name: '返回验证项目', exact: true }).click();
  assert.equal(await main.getByRole('heading', { level: 1 }).innerText(), '返回验证项目');
  await main.locator('.remote-session-row, [data-remote-home-session]').filter({ hasText: 'one' }).click();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.remote-topbar button').disabled);
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await main.getByRole('heading', { name: '返回验证项目', exact: true }).waitFor();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.getByRole('heading', { name: 'Remote', exact: true }).waitFor();
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('one');
  await main.getByRole('heading', { name: '搜索结果', exact: true }).waitFor();
  assert.ok(await main.locator('.remote-session-row, [data-remote-home-session]').filter({ hasText: 'one' }).count());
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await main.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'hidden' });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const groupedSwitch = page.getByRole('switch', { name: '工作区展开显示会话', exact: true });
  await groupedSwitch.waitFor();
  assert.equal(await groupedSwitch.getAttribute('aria-checked'), 'false');
  await groupedSwitch.click();
  assert.equal(await groupedSwitch.getAttribute('aria-checked'), 'true');
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  const project = main.locator('[data-remote-home-workspace="back-test"]');
  await project.waitFor();
  assert.equal(await main.locator('.dhp-group-sessions').count(), 0);
  await project.click();
  await main.locator('.dhp-group-sessions [data-remote-home-session]').filter({ hasText: 'one' }).waitFor();
  assert.equal(await main.locator('.dhp-group-sessions [data-remote-home-session]').count(), 1);
  assert.equal(await main.locator('.dhp-group-sessions .dhp-status').count(), 1);
  await project.click();
  assert.equal(await main.locator('.dhp-group-sessions').count(), 0);
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('one');
  await main.getByRole('heading', { name: '搜索结果', exact: true }).waitFor();
  assert.equal(await main.locator('.dhp-group-heading').count(), 1);
  assert.equal(await main.locator('[data-remote-home-session]').filter({ hasText: 'one' }).count(), 1);
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const restoreSwitch = page.getByRole('switch', { name: '工作区展开显示会话', exact: true });
  assert.equal(await restoreSwitch.getAttribute('aria-checked'), 'true');
  await restoreSwitch.click();
  assert.equal(await restoreSwitch.getAttribute('aria-checked'), 'false');
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await page.evaluate(key => localStorage.removeItem(key), WORKSPACE_CHAT_STORAGE_KEY);
  return { actualWorkspace: true, themes: ['light', 'dark'], widths: [390, 320], projectAndSessionEntry: true, search: true, newChatPicker: true, systemBack: true, workspaceChats: true };
}
