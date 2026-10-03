import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立 DSH-TEST 聊天和文件；不会用任意路径调用打开接口。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['prepare', 'verify', 'missing', 'cleanup'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  let seed;
  if (phase === 'prepare') {
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    const stamp = Date.now();
    seed = { chat: `DSHM 电脑打开联调 ${stamp}`, marker: `DSHM_DESKTOP_READY_${stamp}`,
      path: resolve(`artifacts/dshm-desktop-${stamp}.txt`).replaceAll('\\', '/') };
    await writeFile(seed.path, 'DSHM_DESKTOP_BEFORE\n');
    await writeFile('artifacts/desktop-open-seed.json', JSON.stringify(seed, null, 2));
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.chat);
    await button('保存名称').click(); await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await editor.fill(`这是 DSHM 在电脑打开文件的独立联调。只处理测试文件 ${seed.path}：用 read 读取，然后用 edit 将 DSHM_DESKTOP_BEFORE 改为 DSHM_DESKTOP_AFTER；如需审批，请请求单次批准。接着必须调用 present 工具，把这个既有文件作为交付文件（files 数组中的 path 使用上述完整路径）。不运行命令、不修改其他文件。完成后仅回复 ${seed.marker}。`);
    await button('发送消息').click(); report.sent = true;
  } else {
    seed = JSON.parse(await readFile('artifacts/desktop-open-seed.json', 'utf8'));
    assert.equal(await workspace.locator('.remote-heading').innerText(), seed.chat);
    if (phase === 'verify') {
      const done = page.getByRole('article', { name: '模型回复' }).getByText(seed.marker, { exact: true }).filter({ visible: true });
      const deadline = Date.now() + 150000;
      while (!await done.count() && Date.now() < deadline) {
        const approval = page.getByRole('region', { name: '等待审批' });
        if (await approval.count()) {
          assert.match(await approval.first().innerText(), /edit/);
          await approval.first().getByRole('button', { name: '允许一次', exact: true }).click();
          report.approvals = (report.approvals ?? 0) + 1;
        }
        await page.waitForTimeout(400);
      }
      await done.waitFor({ timeout: 1000 }); await button('停止生成').waitFor({ state: 'detached' });
      assert.equal(await readFile(seed.path, 'utf8'), 'DSHM_DESKTOP_AFTER\n');
      const review = async dialog => {
        await dialog.getByRole('button', { name: '在电脑打开', exact: true }).click();
        const group = dialog.getByRole('group', { name: '确认在电脑打开' });
        await group.waitFor(); report.confirmation = await group.innerText();
        await page.screenshot({ path: `artifacts/desktop-open-${report.opened ?? 0}-android.png` });
        assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false);
        await group.getByRole('button', { name: '取消', exact: true }).click();
        await group.waitFor({ state: 'detached' });
        assert.equal(await dialog.getByText('已请求电脑打开文件。', { exact: true }).count(), 0);
        await dialog.getByRole('button', { name: '在电脑打开', exact: true }).click();
        await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
        await dialog.getByText('已请求电脑打开文件。', { exact: true }).waitFor();
        report.opened = (report.opened ?? 0) + 1;
      };
      await button(/^查看交付文件：/).click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      await preview.getByText('DSHM_DESKTOP_AFTER', { exact: true }).waitFor();
      await review(preview); await button('关闭文件预览').click(); report.presented = true;
      await button(/^查看第 \d+ 轮文件改动$/).click();
      const changes = page.getByRole('dialog', { name: '本轮文件改动', exact: true });
      await changes.locator('[data-diff-line="add"]').filter({ hasText: 'DSHM_DESKTOP_AFTER' }).waitFor();
      await review(changes); report.changes = true;
      await changes.getByRole('button', { name: '查看最新完整文件', exact: true }).click();
      await review(preview); await button('关闭文件预览').click(); report.current = true;
    } else if (phase === 'missing') {
      // 只暂移本脚本创建的文件，验证真实 Host 拒绝；无论结果均恢复原件。
      assert.equal(resolve(seed.path), resolve(`artifacts/${seed.path.split('/').at(-1)}`));
      assert.match(seed.path.split('/').at(-1), /^dshm-desktop-\d+\.txt$/);
      await rename(seed.path, `${seed.path}.parked`);
      try {
        await button(/^查看交付文件：/).click();
        const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
        await preview.getByRole('alert').waitFor();
        await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
        await preview.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
        await preview.getByText('电脑已不再保留这条文件记录，或文件已被移动、删除。', { exact: true }).waitFor();
        assert.equal(await preview.getByText('已请求电脑打开文件。', { exact: true }).count(), 0);
        await page.screenshot({ path: 'artifacts/desktop-open-missing-android.png' });
        await button('关闭文件预览').click(); report.missingRefused = true;
      } finally { await rename(`${seed.path}.parked`, seed.path); }
    } else {
      assert.equal(await editor.inputValue(), '');
      await menu('归档聊天');
      await button(/^DSHM Remote 联调提示/).click(); report.returned = true;
    }
  }
  report.chat = seed.chat;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) await page.screenshot({ path: 'artifacts/desktop-open-failed-android.png' }).catch(() => {});
} finally {
  await writeFile(`artifacts/desktop-open-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
