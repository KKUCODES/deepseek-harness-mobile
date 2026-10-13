import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 原手机会话入口操作独立测试聊天；搜索、分支内容和归档均另读官方服务核对。 */
export async function verifyOfficialSessionNavigation({ page, device, evidence, navigation, title, phoneMarker, mark }) {
  const main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const renamed = `${title} 改名`;
  const report = { renamed, completed: false };
  const save = () => writeFile(resolve(evidence, 'session-navigation.json'), JSON.stringify(report, null, 2) + '\n');
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      return { selected: state.selected, title: state.list?.byId[state.selected]?.displayTitle };
    }
    throw Error('official_navigation_model_missing');
  });
  const menu = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    return page.getByRole('dialog', { name: 'Remote 选项', exact: true });
  };
  const row = name => main.locator('.remote-session-row').filter({ has: page.getByText(name, { exact: true }) });
  const back = () => main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  const rename = async name => {
    await (await menu()).getByRole('button', { name: '重命名聊天', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '重命名聊天', exact: true });
    await dialog.getByRole('textbox', { name: '聊天名称', exact: true }).fill(name);
    await dialog.getByRole('button', { name: '保存名称', exact: true }).click();
    await main.locator('.remote-heading strong').getByText(name, { exact: true }).waitFor();
  };
  try {
    report.originalId = (await snapshot()).selected;
    await navigation.verify({ phase: 'initial', selected: report.originalId });
    await editor.fill('DSHM_NAVIGATION_DRAFT');
    await rename(renamed);
    report.rename = await navigation.verify({ phase: 'renamed', selected: report.originalId, title: renamed });
    assert.equal(await editor.innerText(), 'DSHM_NAVIGATION_DRAFT');
    await back();
    const search = main.getByRole('textbox', { name: '搜索远程聊天', exact: true });
    await search.fill(renamed);
    await row(renamed).waitFor();
    report.titleSearchVerified = true;
    await search.fill(phoneMarker);
    report.contentSearch = await navigation.search(phoneMarker);
    await row(renamed).locator('.remote-search-snippet').filter({ hasText: phoneMarker }).waitFor({ timeout: 60000 });
    assert.equal(await main.locator('.remote-search-error').count(), 0);
    await writeFile(resolve(evidence, 'session-content-search.png'), await device.screenshot());
    await search.fill(''); await row(renamed).click();
    assert.equal(await editor.innerText(), 'DSHM_NAVIGATION_DRAFT');
    await mark('official-phone-rename-title-and-content-search');
    await (await menu()).getByRole('button', { name: '在新聊天中分支', exact: true }).click();
    await page.waitForFunction(originalId => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const selected = fiber.memoizedProps.model.getSnapshot().selected;
        return selected && selected !== originalId;
      }
      return false;
    }, report.originalId);
    const fork = await snapshot();
    report.forkId = fork.selected; report.forkTitle = fork.title;
    await main.getByRole('article', { name: '模型回复', exact: true }).getByText(phoneMarker, { exact: true }).waitFor();
    report.fork = await navigation.verify({ phase: 'forked', selected: fork.selected, title: fork.title });
    assert.equal(await editor.innerText(), '');
    await editor.fill('DSHM_FORK_DRAFT');
    await (await menu()).getByRole('button', { name: '归档聊天', exact: true }).click();
    await search.waitFor();
    assert.equal(await row(fork.title).count(), 0);
    report.archive = await navigation.verify({ phase: 'archived', selected: fork.selected });
    await (await menu()).getByRole('button', { name: '查看已归档聊天', exact: true }).click();
    await row(fork.title).click();
    assert.equal(await editor.innerText(), 'DSHM_FORK_DRAFT');
    await main.getByRole('article', { name: '模型回复', exact: true }).getByText(phoneMarker, { exact: true }).waitFor();
    await (await menu()).getByRole('button', { name: '取消归档', exact: true }).click();
    await search.waitFor();
    assert.equal(await row(fork.title).count(), 0);
    report.restore = await navigation.verify({ phase: 'unarchived', selected: fork.selected });
    await (await menu()).getByRole('button', { name: '查看最近聊天', exact: true }).click();
    await row(fork.title).waitFor();
    await row(renamed).click();
    assert.equal(await editor.innerText(), 'DSHM_NAVIGATION_DRAFT');
    await rename(title);
    report.originalRestored = await navigation.verify({ phase: 'restored', selected: report.originalId, title });
    await editor.fill('');
    await writeFile(resolve(evidence, 'session-original-restored.png'), await device.screenshot());
    await mark('official-phone-fork-archive-restore-and-draft-isolation');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
