import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, unlink, rmdir } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'verify';
assert.ok(['prepare', 'verify', 'cleanup'].includes(phase));
const seedFile = 'artifacts/workspace-files-seed.json';
if (phase === 'prepare') {
  const root = resolve('../DSH-TEST', `dshm-files-${Date.now()}`);
  const seed = { root, text: 'DSHM_WORKSPACE_FILES_VERIFIED', added: 'DSHM_WORKSPACE_REFRESH' };
  await writeFile(seedFile, JSON.stringify(seed, null, 2), { flag: 'wx' });
  await mkdir(root); await mkdir(resolve(root, 'nested')); await mkdir(resolve(root, 'empty'));
  await writeFile(resolve(root, 'nested/readme.txt'), seed.text, { flag: 'wx' });
  console.log(JSON.stringify({ prepared: root }));
} else {
  const seed = JSON.parse(await readFile(seedFile, 'utf8'));
  assert.equal(dirname(resolve(seed.root)), resolve('../DSH-TEST'));
  assert.match(basename(seed.root), /^dshm-files-\d+$/);
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
  try {
    const first = await (await androidAppWebView(device)).page();
    const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', item => { if (item.type() === 'error') report.errors.push(item.text()); });
    page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
    const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true }), draft = await editor.inputValue();
    const surface = page.getByRole('region', { name: '插件面板', exact: true });
    const menu = async () => {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '插件面板', exact: true }).click();
    };
    if (!await surface.isVisible()) await menu();
    const filesTab = surface.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await filesTab.count()) await filesTab.click();
    else await surface.getByRole('button', { name: /工作区文件/ }).click();
    const tree = surface.locator('[data-files-state="tree"]');
    await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(), resolve('../DSH-TEST').replaceAll('\\', '/').toLowerCase());
    const reload = tree.getByRole('button', { name: '重新读取', exact: true });
    if (phase === 'verify') {
      const folder = tree.getByRole('button', { name: basename(seed.root), exact: true });
      await folder.waitFor();
      if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
      const empty = tree.getByRole('button', { name: 'empty', exact: true });
      if (await empty.getAttribute('aria-expanded') !== 'true') await empty.click();
      await tree.getByText('空目录', { exact: true }).waitFor();
      assert.equal(await tree.getByRole('button', { name: 'readme.txt', exact: true }).count(), 0);
      await tree.getByRole('button', { name: 'nested', exact: true }).click();
      await tree.getByRole('button', { name: 'readme.txt', exact: true }).click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      await preview.locator('pre').waitFor();
      assert.equal(await preview.locator('pre').innerText(), seed.text);
      await page.screenshot({ path: 'artifacts/workspace-files-preview-android.png' });
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await menu(); await filesTab.click();
      assert.equal(await folder.getAttribute('aria-expanded'), 'true');
      await tree.getByRole('button', { name: 'readme.txt', exact: true }).waitFor();
      await writeFile(resolve(seed.root, 'nested/new.txt'), seed.added, { flag: 'wx' });
      assert.equal(await tree.getByRole('button', { name: 'new.txt', exact: true }).count(), 0);
      await reload.click(); await tree.getByRole('button', { name: 'new.txt', exact: true }).waitFor();
      report.lazyExpansion = true; report.emptyDirectory = true; report.previewMatches = true; report.refresh = true; report.retainedExpansion = true;
      const box = await tree.boundingBox();
      report.treeBox = box;
      await page.screenshot({ path: 'artifacts/workspace-files-tree-android.png' });
    } else {
      // 只清理本次自建的三个目录和已核对内容，未知文件使清理停止。
      assert.deepEqual((await readdir(seed.root)).sort(), ['empty', 'nested']);
      assert.deepEqual(await readdir(resolve(seed.root, 'empty')), []);
      const files = (await readdir(resolve(seed.root, 'nested'))).sort();
      assert.deepEqual(files, ['new.txt', 'readme.txt']);
      assert.equal(await readFile(resolve(seed.root, 'nested/readme.txt'), 'utf8'), seed.text);
      assert.equal(await readFile(resolve(seed.root, 'nested/new.txt'), 'utf8'), seed.added);
      for (const file of files) await unlink(resolve(seed.root, 'nested', file));
      await rmdir(resolve(seed.root, 'nested')); await rmdir(resolve(seed.root, 'empty')); await rmdir(seed.root);
      await reload.click(); await tree.getByRole('button', { name: basename(seed.root), exact: true }).waitFor({ state: 'detached' });
      report.removedDirectoryRefreshed = true;
    }
    await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.inputValue(), draft); report.draftPreserved = true;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  } catch (error) { report.failure = String(error); process.exitCode = 1; }
  finally { await writeFile(`artifacts/workspace-files-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
}
