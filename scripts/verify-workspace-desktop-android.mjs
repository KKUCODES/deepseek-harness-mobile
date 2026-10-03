import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'verify', 'cleanup'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  let seed;
  if (phase === 'prepare') {
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    const stamp = Date.now(); seed = { title: `DSHM 文件入口验证 ${stamp}`, path: resolve(`artifacts/dshm-file-origin-${stamp}.txt`).replaceAll('\\', '/'), marker: `DSHM_FILE_ORIGIN_${stamp}` };
    await writeFile(seed.path, seed.marker + '\n'); await writeFile('artifacts/workspace-desktop-seed.json', JSON.stringify(seed, null, 2));
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title); await button('保存名称').click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await editor.fill(`这是独立文件预览联调。只调用一次 read 读取 ${seed.path}，不执行命令、不修改文件、不调用其他工具。然后仅输出这个 Markdown 链接：[打开测试文本](${seed.path})。`);
    await button('发送消息').click(); report.sent = true;
  } else {
    seed = JSON.parse(await readFile('artifacts/workspace-desktop-seed.json', 'utf8'));
    assert.equal(await workspace.locator('.remote-heading').innerText(), seed.title);
    assert.equal(resolve(seed.path), resolve('artifacts', seed.path.split('/').at(-1)));
    assert.match(seed.path.split('/').at(-1), /^dshm-file-origin-\d+\.txt$/);
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    if (phase === 'cleanup') {
      if (await preview.count()) await button('关闭文件预览').click();
      assert.equal(await editor.inputValue(), ''); await menu('归档聊天');
      await button(/^DSHM Remote 联调提示/).click(); report.returned = true;
    } else {
      await button('打开测试文本').waitFor({ timeout: 120000 }); await button('停止生成').waitFor({ state: 'detached' });
      const tool = page.getByRole('region', { name: '聊天内容', exact: true }).locator('details.remote-tool-card').filter({ hasText: seed.path }).first();
      if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
      await tool.getByRole('button', { name: `打开文件：${seed.path}`, exact: true }).click();
      await preview.getByText(seed.marker, { exact: true }).waitFor();
      const review = async () => {
        await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
        const group = preview.getByRole('group', { name: '确认在电脑打开', exact: true }); await group.waitFor();
        assert.match(await group.innerText(), new RegExp(seed.path.split('/').at(-1).replaceAll('.', '\\.')));
        return group;
      };
      let group = await review(); await group.getByRole('button', { name: '取消', exact: true }).click(); await group.waitFor({ state: 'detached' });
      assert.equal(await preview.getByText('已请求电脑打开文件。', { exact: true }).count(), 0); report.cancel = true;
      group = await review(); await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
      await preview.getByText('已请求电脑打开文件。', { exact: true }).waitFor(); report.toolOpen = true;
      await button('关闭文件预览').click(); await button('打开测试文本').click();
      await preview.getByText(seed.marker, { exact: true }).waitFor(); group = await review();
      const original = await readFile(seed.path);
      try {
        await writeFile(seed.path, seed.marker + '_CHANGED\n');
        await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
        await preview.getByText('文件已变化，请重新核对后再打开。', { exact: true }).waitFor(); report.changedRefused = true;
        group = await review(); await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
        await preview.getByText('已请求电脑打开文件。', { exact: true }).waitFor(); report.markdownOpen = true;
        await page.screenshot({ path: 'artifacts/workspace-desktop-android.png' });
      } finally { await writeFile(seed.path, original); }
      await rename(seed.path, `${seed.path}.parked`);
      try {
        await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
        await preview.getByText('电脑已不再保留这条文件记录，或文件已被移动、删除。', { exact: true }).waitFor();
        assert.equal(await preview.getByRole('group', { name: '确认在电脑打开', exact: true }).count(), 0); report.missingRefused = true;
      } finally { await rename(`${seed.path}.parked`, seed.path); }
      await button('关闭文件预览').click(); assert.equal(await readFile(seed.path, 'utf8'), seed.marker + '\n'); report.sourceRestored = true;
    }
  }
  report.title = seed.title; assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-3000); await page.screenshot({ path: 'artifacts/workspace-desktop-failed.png' }).catch(() => {}); }
} finally {
  await writeFile(`artifacts/workspace-desktop-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
