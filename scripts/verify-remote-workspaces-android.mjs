import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 只操作电脑提前登记的专用测试工作区。管理授权由用户在电脑确认，脚本不授予权限。
const name = 'DSHM-WORKSPACE-TEST-20260924', renamed = `${name}-RENAMED`;
const chat = 'DSHM 工作区保留验证 20260924', marker = 'DSHM_WORKSPACE_CHAT_KEPT_20260924';
const phase = process.argv[2];
assert.ok(['prepare', 'rename', 'sort', 'remove', 'preserved', 'revoked'].includes(phase));
if (!['preserved', 'revoked'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) report.resources.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  const button = text => page.getByRole('button', { name: text, exact: true });
  const menu = async () => button('Remote 选项').click();
  const close = async () => { await button('关闭窗口').click(); await page.getByRole('dialog').waitFor({ state: 'detached' }); };
  if (await button('重新连接').isVisible()) await button('重新连接').click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  if (phase === 'prepare') {
    await menu(); await button('新建聊天').click();
    await page.getByRole('dialog', { name: '选择工作区' }).getByRole('button', { name, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await menu(); await button('重命名聊天').click();
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(chat);
    await button('保存名称').click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是工作区注册保留测试，只回复 ${marker}，不调用工具，不读取或修改任何文件。`);
    await button('发送消息').click();
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).waitFor({ timeout: 60000 });
    await button('停止生成').waitFor({ state: 'detached' });
    report.testChatCreated = true;
  } else if (phase === 'preserved') {
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await button('返回').click();
    await page.getByRole('button', { name: new RegExp(`^${chat}`) }).click();
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).waitFor();
    report.chatReadableAfterRemoval = true;
    assert.equal((await readFile('artifacts/DSHM-WORKSPACE-TEST-20260924/keep.txt', 'utf8')).trim(), 'DSHM_WORKSPACE_REGISTRATION_MUST_KEEP_FILES_20260924');
    report.fileUnchanged = true;
  } else {
    await menu(); await button('管理工作区').click();
    const manager = page.getByTestId('remote-workspace-manager');
    if (phase === 'revoked') {
      await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
      assert.equal(await manager.getByRole('button').count(), 0);
      report.managementRemoved = true;
    } else {
      await manager.getByRole('button', { name: phase === 'rename' ? name : renamed, exact: true }).click();
      if (phase === 'rename') {
        await button('重命名工作区').click(); await page.getByRole('textbox', { name: '工作区名称', exact: true }).fill(renamed);
        await button('保存工作区名称').click(); await manager.getByRole('button', { name: renamed, exact: true }).waitFor();
        report.renamed = true;
      } else if (phase === 'sort') {
        await button('调整排序').click(); await button('移到最后').click();
        await manager.getByRole('button', { name: renamed, exact: true }).waitFor();
        report.order = await manager.getByRole('button').allTextContents(); assert.equal(report.order.at(-1), renamed);
      } else {
        await button('移除工作区注册').click(); assert.equal(await button('确认移除注册').isEnabled(), false);
        await manager.getByRole('checkbox').check();
        await page.screenshot({ path: 'artifacts/remote-workspace-remove-confirm-android.png' });
        await button('确认移除注册').click();
        await manager.getByRole('heading', { name: renamed, exact: true }).waitFor({ state: 'detached' });
        assert.equal(await manager.getByRole('button', { name: renamed, exact: true }).count(), 0);
        report.removedAfterAcknowledgement = true;
      }
    }
    await page.screenshot({ path: `artifacts/remote-workspace-${phase}-android.png` });
    await close();
  }
  if (phase === 'revoked') {
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await page.getByRole('article', { name: '模型回复' }).first().waitFor();
    report.originalChatAuthorizationPreserved = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  await page.screenshot({ path: `artifacts/remote-workspace-${phase}-final-android.png` });
} catch (error) { report.failure = error.message; throw error; }
finally { await writeFile(`artifacts/remote-workspace-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
