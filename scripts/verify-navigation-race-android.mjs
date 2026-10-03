import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只在专用测试工作区创建/分支；延迟真实回执，不替换结果或发起模型请求。
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cases: [], created: [], errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const heading = scope => scope.locator('.remote-heading strong');
  const input = scope => scope.getByRole('textbox', { name: '消息', exact: true });
  const menu = async (scope, name) => {
    await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await scope.getByRole('button', { name, exact: true }).click();
  };
  const parent = main.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: seed.chat, exact: true });
  if (await parent.isVisible()) await parent.click();
  if (await heading(main).innerText() === seed.chat) {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    if (await main.getByRole('heading', { name: '已归档', exact: true }).count()) await menu(main, '查看最近聊天');
  }
  if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await heading(main).innerText(), seed.original);
  report.draft = await input(main).innerText();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await menu(main, '查看已归档聊天');
  await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  await input(main).waitFor();
  const parentDraft = await input(main).innerText();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  for (const sidebar of [false, true]) {
    let scope = main;
    if (sidebar) {
      await menu(main, '子会话');
      await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
        .getByRole('button', { name: '在旁栏打开', exact: true }).click();
      scope = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
      await input(scope).waitFor();
      await scope.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: seed.chat, exact: true }).click();
      await input(scope).waitFor();
    }
    for (const operation of ['create', 'fork']) {
      assert.equal(await heading(scope).innerText(), seed.chat);
      await page.evaluate(operation => {
        const bridge = window.DSHMRemote, send = bridge.postMessage, receive = bridge.onmessage;
        let requestId, saved;
        const probe = window.__dshmNavigationProbe = { held: false, created: null };
        const post = raw => {
          const message = JSON.parse(raw), frame = message.data?.frame;
          if (!requestId && frame?.operation?.method === 'remote.rpc' && frame.operation.endpoint === `session/${operation}`) requestId = frame.id;
          return send.call(bridge, raw);
        };
        const deliver = event => {
          const frame = JSON.parse(event.data).event;
          if (frame?.type === 'result' && frame.id === requestId) {
            probe.created = frame.value?.ok ? frame.value.value.sessionId : null;
            probe.held = true; saved = event; return;
          }
          return receive.call(bridge, event);
        };
        probe.release = () => { if (saved) { const event = saved; saved = null; receive.call(bridge, event); } };
        probe.restore = () => { bridge.postMessage = send; bridge.onmessage = receive; probe.release(); delete window.__dshmNavigationProbe; };
        bridge.postMessage = post; bridge.onmessage = deliver;
      }, operation);
      if (operation === 'create') {
        await menu(scope, '新建聊天');
        await scope.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      } else await menu(scope, '在新聊天中分支');
      await page.waitForFunction(() => window.__dshmNavigationProbe?.held);
      const id = await page.evaluate(() => window.__dshmNavigationProbe.created);
      assert.ok(id); report.created.push(id);
      await scope.getByRole('button', { name: '关闭窗口', exact: true }).click();
      // 原子会话菜单不依赖当前创建按钮的busy状态，代表用户的较新导航。
      await scope.locator('.remote-heading button[aria-haspopup="tree"]').last().press('ArrowDown');
      await page.getByRole('tree', { name: '子代理会话', exact: true }).getByRole('treeitem', { name: /^DSHM 恢复子会话 / }).click();
      await input(scope).waitFor();
      assert.match(await scope.locator('.remote-heading').innerText(), /^DSHM 恢复子会话/);
      await page.evaluate(() => window.__dshmNavigationProbe.release());
      await scope.locator(':scope > header button[aria-label="返回"]:not([disabled])').waitFor();
      assert.match(await scope.locator('.remote-heading').innerText(), /^DSHM 恢复子会话/);
      report.cases.push({ sidebar, operation, stayedOnChild: true });
      await page.evaluate(() => window.__dshmNavigationProbe.restore());
      await scope.getByRole('navigation', { name: '父级会话', exact: true }).getByRole('button', { name: seed.chat, exact: true }).click();
      await input(scope).waitFor(); assert.equal(await input(scope).innerText(), parentDraft);
    }
    if (sidebar) {
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
  }
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await menu(main, '查看最近聊天');
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await input(main).waitFor(); assert.equal(await input(main).innerText(), report.draft);
  await main.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
  report.originalRestored = true;
  await page.screenshot({ path: 'artifacts/navigation-race-restored-android.png' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/navigation-race-failure-android.png' }).catch(() => {});
} finally {
  if (page) {
    const pendingId = await page.evaluate(() => {
      const probe = window.__dshmNavigationProbe, id = probe?.created; probe?.restore(); return id;
    }).catch(() => null);
    if (pendingId && !report.created.includes(pendingId)) report.created.push(pendingId);
    report.cleanup = await page.evaluate(async ids => {
      const results = [];
      for (const sessionId of ids) {
        const result = await window.__DSH_TRANSPORT__.rpc.call('/api', 'workspace/archiveSession', { args: { request: { sessionId } } }, new AbortController().signal);
        results.push({ sessionId, ok: result.ok, archived: result.ok && result.value.archivedSessionIds.includes(sessionId) });
      }
      return results;
    }, report.created).catch(error => ({ failure: error.message }));
    if (!Array.isArray(report.cleanup) || report.cleanup.some(value => !value.archived)) process.exitCode = 1;
  }
  await writeFile('artifacts/navigation-race-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
