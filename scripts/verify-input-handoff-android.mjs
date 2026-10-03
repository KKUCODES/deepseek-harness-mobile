import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink, rmdir, stat, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 在专用归档聊天使用真实 @ 提供方，只编辑草稿，不发送消息或修改授权。
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const prefix = process.env.DSHM_REPORT_PREFIX || 'input-handoff';
const restart = process.argv.includes('--restart');
const rebuild = process.argv.includes('--rebuild');
const bundle = 'F:/Program Files/deepseek-harness/packages/api/remotes/lib/client.js';
const digest = async () => createHash('sha256').update(await readFile(bundle)).digest('hex');
const originalBundle = rebuild ? { stat: await stat(bundle), hash: await digest() } : null;
let changed = false;
assert.match(prefix, /^[a-z0-9-]+$/);
const run = `dshm-handoff-${Date.now()}`, directory = resolve('../DSH-TEST', run);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [], checks: [] };
let page, parentDraft, originalDraft, main, primary, panel, aside, fileCreated = false;
const menu = async (scope, name) => {
  await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await scope.getByRole('button', { name, exact: true }).click();
};
const returnMain = async () => {
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await primary.waitFor();
};
const openRemote = async () => {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  for (let attempt = 0; attempt < 150 && !(await device.shell('pidof dev.dshmobile.validation')).toString().trim(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  for (let attempt = 0; attempt < 200 && !page; attempt++) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  main = page.getByTestId('remote-workspace'); await main.waitFor();
  primary = main.getByRole('textbox', { name: '消息', exact: true });
  panel = page.getByRole('region', { name: '插件面板', exact: true });
  aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
};
try {
  await openRemote();
  const heading = main.locator('.remote-heading strong');
  if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await heading.innerText(), seed.original);
  originalDraft = await primary.innerText();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await heading.getByText('Remote', { exact: true }).waitFor();
  await menu(main, '查看已归档聊天');
  await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  await primary.waitFor();
  assert.equal(await primary.locator('[data-composer-chip]').count(), 0, '不能用文本备份覆盖已有结构化草稿');
  parentDraft = await primary.innerText();
  await mkdir(directory); fileCreated = true;
  await writeFile(resolve(directory, 'handoff.txt'), 'DSHM_INPUT_HANDOFF_VALIDATION', { flag: 'wx' });
  for (const kind of ['file', 'chat']) {
    await primary.fill(kind === 'file' ? `@./${run}` : '@联调测试');
    const suggestions = page.getByRole('listbox', { name: '触发候选建议', exact: true });
    if (kind === 'file') await suggestions.getByRole('option').filter({ hasText: run }).getByRole('button', { name: '进入目录', exact: true }).click();
    await suggestions.getByRole('option').filter({ hasText: kind === 'file' ? 'handoff.txt' : 'DSH Mobile 联调测试' }).click();
    const chip = primary.locator('[data-composer-chip]'); await chip.waitFor();
    const before = { source: await chip.getAttribute('data-composer-chip'), label: await chip.innerText() };
    await menu(main, '子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    await aside.getByRole('region', { name: '聊天内容', exact: true }).getByText('CHILD_NESTED_DONE', { exact: true }).waitFor();
    assert.equal(await primary.count(), 0);
    await aside.getByRole('button', { name: '返回父会话', exact: true }).click();
    await aside.locator('.remote-heading strong').getByText(seed.chat, { exact: true }).waitFor();
    const sideChip = aside.getByRole('textbox', { name: '消息', exact: true }).locator('[data-composer-chip]');
    await sideChip.waitFor();
    assert.deepEqual({ source: await sideChip.getAttribute('data-composer-chip'), label: await sideChip.innerText() }, before);
    await returnMain(); await chip.waitFor();
    assert.deepEqual({ source: await chip.getAttribute('data-composer-chip'), label: await chip.innerText() }, before);
    if (rebuild) {
      assert.equal(await digest(), originalBundle.hash);
      await page.evaluate(() => { window.__dshmInputOldTransport = window.__DSH_TRANSPORT__; });
      await utimes(bundle, originalBundle.stat.atimeMs / 1000, kind === 'file' ? Date.now() / 1000 : originalBundle.stat.mtimeMs / 1000);
      changed = kind === 'file';
      await page.waitForFunction(() => window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__ !== window.__dshmInputOldTransport, null, { timeout: 30000 });
      await chip.waitFor();
      assert.deepEqual({ source: await chip.getAttribute('data-composer-chip'), label: await chip.innerText() }, before);
      await page.evaluate(() => { delete window.__dshmInputOldTransport; });
      report.checks.push({ kind, coreRebuildPreserved: true });
    }
    if (restart) {
      // 只结束本验证App，模拟进程消失；不清数据、不替换绑定、不发送消息。
      await page.getByRole('status').filter({ hasText: '正在保存草稿' }).waitFor({ state: 'detached' });
      await device.shell('am force-stop dev.dshmobile.validation');
      page = null;
      await openRemote();
      if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) {
        if (!await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).count()) await menu(main, '查看已归档聊天');
        await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
      }
      const restoredChip = primary.locator('[data-composer-chip]'); await restoredChip.waitFor();
      assert.deepEqual({ source: await restoredChip.getAttribute('data-composer-chip'), label: await restoredChip.innerText() }, before);
      assert.equal(await main.locator('.remote-heading strong').innerText(), seed.chat);
      report.checks.push({ kind, appRestartPreserved: true });
    }
    await page.screenshot({ path: `artifacts/${prefix}-${kind}-android.png` });
    report.checks.push({ kind, sidebarPreserved: true, mainPreserved: true });
    await primary.fill(parentDraft);
    if (restart) continue; // 冷启动没有重开旧旁栏，清理仍由finally恢复原聊天与草稿。
    await menu(main, '插件面板');
    await panel.getByRole('navigation', { name: '已打开的面板', exact: true }).getByRole('button', { name: 'DSHM 恢复子会话', exact: true }).click();
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await page.getByTestId('remote-sidebar-conversation').waitFor({ state: 'detached' });
    await returnMain();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
  if (page) await page.screenshot({ path: `artifacts/${prefix}-failure-android.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  if (originalBundle) {
    try {
      if (changed) await utimes(bundle, originalBundle.stat.atimeMs / 1000, originalBundle.stat.mtimeMs / 1000);
      assert.equal(await digest(), originalBundle.hash); report.bundleRestored = true;
    } catch (error) { report.bundleRestoreFailure = error.message; process.exitCode = 1; }
  }
  try {
    if (parentDraft !== undefined) {
      await returnMain(); await primary.fill(parentDraft);
      // Lexical空段落的innerText可能是换行，语义上都为空草稿。
      const restored = await primary.innerText();
      report.parentDraftRestored = parentDraft.trim() ? restored === parentDraft : !restored.trim();
      assert.equal(report.parentDraftRestored, true);
      await main.getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-heading strong').getByText('Remote', { exact: true }).waitFor();
      await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).waitFor(); report.stillArchived = true;
      await menu(main, '查看最近聊天');
      await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      const originalRestored = await primary.innerText();
      assert.equal(originalDraft.trim() ? originalRestored === originalDraft : !originalRestored.trim(), true);
      report.originalRestored = true;
    }
    if (fileCreated) {
      await unlink(resolve(directory, 'handoff.txt')); await rmdir(directory); report.testFileRemoved = true;
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
