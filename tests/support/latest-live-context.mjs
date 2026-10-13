// 持久新版真实模型专项的只读入口；不创建绑定、不读取 Key、不注入事件。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

export async function openLatestLiveAndroid(sessionFile = 'latest-live-android-session.json', { preparingPtc = false, preparingEncoding = false, openRecorded = false, expectedChildId, observePage, reconnectRecorded = false } = {}) {
  assert.ok(['latest-live-android-session.json', 'latest-live-ptc-session.json', 'latest-live-encoding-session.json',
    'latest-live-ptc-owned-session.json', 'latest-live-source-creator-session.json',
    'latest-live-creator-session.json'].includes(sessionFile));
  const runtime = resolve(import.meta.dirname, '../../../plugin/artifacts/latest-runtime-check');
  const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
  const primary = JSON.parse(await readFile(resolve(runtime, 'latest-live-android-session.json'), 'utf8'));
  const session = sessionFile === 'latest-live-android-session.json' ? primary
    : JSON.parse(await readFile(resolve(runtime, sessionFile), 'utf8'));
  const evidence = JSON.parse(await readFile(resolve(runtime, 'latest-live-model-android.json'), 'utf8'));
  const name = relative(resolve(runtime, 'live-homes'), state.home);
  assert.match(name, /^[0-9a-f-]{36}$/);
  assert.equal(await realpath(state.home), resolve(await realpath(resolve(runtime, 'live-homes')), name));
  assert.equal(await realpath(state.workspacePath), resolve(await realpath(state.home), 'test-project'));
  assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(state.ready, true);
  assert.equal(session.home, state.home); assert.equal(evidence.home, state.home);
  assert.equal(evidence.sessionId, primary.sessionId); assert.equal(evidence.inferenceVerified, true);
  assert.equal(evidence.passed, true);
  if (sessionFile.endsWith('creator-session.json') && session.sessionId === state.sessionId)
    assert.match(session.sessionId, /^latest-live-[0-9a-f-]{36}$/);
  else assert.match(session.sessionId, /^session-[0-9a-f-]{36}$/);
  let selectedWorkspacePath = state.workspacePath;
  if (sessionFile === 'latest-live-ptc-owned-session.json') {
    const prepared = JSON.parse(await readFile(resolve(runtime, 'latest-live-ptc-owned-preparation.json'), 'utf8'));
    assert.equal(prepared.home, state.home);
    assert.equal(prepared.sourceCommit, '5badb15009ae1756c3afe0ae0cef1faafc290ccc');
    if (state.executionMode === 'source') assert.equal(prepared.sourceCommit, state.sourceCommit);
    else {
      assert.equal(state.executionMode, 'release');
      const pkg = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
      assert.equal(pkg.name, '@deepseek-ai/dsh'); assert.equal(pkg.version, state.target);
    }
    assert.equal(prepared.workspaceCreated, true); assert.equal(prepared.workspaceRegistered, true);
    assert.equal(session.workspacePath, prepared.workspacePath);
    assert.match(relative(state.home, prepared.workspacePath), /^ptc-owned-project-[0-9a-f-]{36}$/);
    selectedWorkspacePath = await realpath(prepared.workspacePath);
    assert.equal(selectedWorkspacePath, resolve(state.home, relative(state.home, prepared.workspacePath)));
  }
  assert.ok(['emulator-5554', '127.0.0.1:16384'].includes(process.env.DSHM_ANDROID_SERIAL));
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  try {
    if (device.serial() === '127.0.0.1:16384') {
      const installed = (await device.shell('pm path dev.dshmobile.validation.latesttest')).toString().trim();
      assert.match(installed, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
      const sha = (await device.shell('sha256sum ' + installed.slice(8))).toString().trim().split(/\s+/)[0];
      assert.equal(sha, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
    }
    const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.latesttest')).page();
    const context = first.context();
    let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    // 暂停的WebView仍报告DOM可见；用Android前台Activity确认实际可操作的页面。
    const activities = openRecorded ? (await device.shell('dumpsys activity activities')).toString() : '';
    const remoteForeground = /topResumedActivity=.*dev\.dshmobile\.validation\.latesttest\/dev\.dshmobile\.validation\.RemoteActivity/.test(activities);
    // Host 重连时 Remote 的载入页会暂时替代工作区；前台仍是 Remote，不能去点击暂停的普通页面。
    if (openRecorded && remoteForeground) {
      assert.ok(page, 'latest_live_foreground_remote_page_missing');
      if (reconnectRecorded) {
        const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
        if (await reconnect.isVisible()) {
          assert.equal(await page.getByTestId('remote-fingerprint').textContent(), 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
          await reconnect.click();
        }
      }
      await page.getByTestId('remote-workspace').waitFor({ state: 'visible', timeout: 30000 });
    }
    if (openRecorded && (!page || !remoteForeground)) {
      const ordinary = context.pages().filter(item => item.url().startsWith('https://appassets.androidplatform.net/')).at(-1); assert.ok(ordinary);
      const drawer = ordinary.getByRole('dialog', { name: '侧边导航', exact: true });
      if (!await drawer.isVisible()) await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      // 返回普通首页后原Remote Activity仍存在，点击入口会恢复它而非创建新页面。
      const opened = page ? undefined : context.waitForEvent('page', {
        predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
      if (opened) page = await opened;
    }
    assert.ok(page); page.setDefaultTimeout(30000);
    observePage?.(page);
    const main = page.getByTestId('remote-workspace'); await main.waitFor();
    const heading = main.locator('.remote-heading strong');
    const selectedState = () => main.evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) {
          const state = fiber.memoizedProps.model.getSnapshot();
          return { id: state.selected, row: state.list.byId[state.selected] };
        }
      // 导航提交时 React 已替换元素，新的祖先 fiber 尚未挂上；最终身份仍须严格核对。
      return { id: undefined, row: undefined };
    });
    if (openRecorded) {
      for (const [name, button] of [['实时任务输出', '关闭任务输出'], ['后台任务', '关闭窗口'], ['命令详情', '关闭命令详情'], ['工具详情', '关闭工具详情']]) {
        const dialog = page.getByRole('dialog', { name, exact: true });
        if (await dialog.isVisible()) await dialog.getByRole('button', { name: button, exact: true }).click();
      }
      // 子页的祖先区域也有父标题；先沿真实导航返回，不能仅凭 strong 判定当前父会话。
      const parentButton = main.getByRole('button', { name: '返回父会话', exact: true });
      for (let depth = 0; await parentButton.isVisible(); depth++) {
        assert.ok(depth < 16, 'latest_live_child_navigation_depth');
        const previous = (await selectedState()).id; await parentButton.click();
        const deadline = Date.now() + 15000;
        while ((await selectedState()).id === previous) {
          assert.ok(Date.now() < deadline, 'latest_live_parent_navigation_timeout');
          await new Promise(done => setTimeout(done, 100));
        }
      }
      if (await heading.innerText() !== session.title) {
        if (await heading.innerText() !== 'Remote') await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        const recordedBlank = await main.evaluate((element, id) => {
          const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
          for (let fiber = element[key]; fiber; fiber = fiber.return)
            if (fiber.memoizedProps?.model?.client) {
              const snapshot = fiber.memoizedProps.model.getSnapshot();
              const row = snapshot.list.byId[id];
              if (!row?.blank) return null;
              const workspace = snapshot.workspaces?.items.find(item => item.sessionIds.includes(id));
              return workspace ? { title: workspace.title, cwd: row.cwd } : null;
            }
          throw Error('latest_live_blank_directory_missing');
        }, session.sessionId);
        if (recordedBlank) {
          // 已由 Creator UI 登记的空会话不出现在最近列表；用同一手机模型的原选择接口恢复。
          assert.equal(resolve(recordedBlank.cwd), selectedWorkspacePath);
          await main.evaluate(async (element, id) => {
            const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
            for (let fiber = element[key]; fiber; fiber = fiber.return)
              if (fiber.memoizedProps?.model?.client) { await fiber.memoizedProps.model.select(id); return; }
            throw Error('latest_live_blank_selection_missing');
          }, session.sessionId);
        } else await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
        // 列表点击异步切换原 RemoteModel；载入中的“Remote”标题不能当成最终会话。
        const selectedDeadline = Date.now() + 15000;
        while ((await selectedState()).id !== session.sessionId || await heading.innerText() !== session.title) {
          assert.ok(Date.now() < selectedDeadline, 'latest_live_recorded_navigation_timeout');
          await new Promise(done => setTimeout(done, 100));
        }
      }
    }
    const title = expectedChildId === undefined ? await heading.innerText() : undefined;
    const selected = await selectedState();
    if (expectedChildId !== undefined) {
      assert.equal(openRecorded, false); assert.equal(selected.id, expectedChildId);
      assert.equal(selected.row.origin, 'subagent');
    } else if (preparingEncoding) {
      assert.equal(title, 'Remote'); assert.ok(!selected.id); assert.equal(selected.row, undefined);
    } else if (preparingPtc && title === 'DSHM 新版 PTC 取消验收') {
      assert.match(selected.id, /^session-[0-9a-f-]{36}$/);
      assert.notEqual(selected.id, primary.sessionId);
      assert.equal(selected.row.blank, true); assert.equal(selected.row.running, false);
      assert.equal(resolve(selected.row.cwd), resolve(state.workspacePath));
    } else {
      assert.equal(title, session.title); assert.equal(selected.id, session.sessionId);
    }
    assert.equal(await page.locator('iframe').count(), 0);
    // 原登录交换、生成请求信封及只读方法均来自已经核验的原 DSH 契约。
    const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
    const url = new URL(loginURL); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
    const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    const read = async (method, args) => {
      assert.ok(['session/list', 'session/projections', 'session/page'].includes(method));
      const rpcId = randomUUID();
      const response = await fetch(new URL('/api/' + method, url), { method: 'POST',
        headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }) });
      assert.equal(response.status, 200, 'latest_live_read_' + response.status);
      const frame = await response.json(); assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true);
      return frame.result.value;
    };
    if (expectedChildId !== undefined) {
      const parent = await read('session/projections', { request: { sessionId: session.sessionId } });
      assert.ok(parent.values.subagentCatalog.some(entry => entry.id === expectedChildId));
    }
    return { runtime, state, session, device, page, main,
      // 只读本轮已登记父会话的原目录子项，不接受任意 sessionId。
      readChild: async (childId, { ancestors = [] } = {}) => {
        assert.ok(Array.isArray(ancestors) && ancestors.length < 16);
        assert.ok([childId, ...ancestors].every(id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)));
        assert.equal(new Set([childId, ...ancestors]).size, ancestors.length + 1);
        // 嵌套测试只沿本轮原父目录逐层核验，不接受任意父地址或跨树读取。
        let parentId = session.sessionId;
        for (const ancestor of ancestors) {
          const catalog = await read('session/projections', { request: { sessionId: parentId } });
          const entry = catalog.values.subagentCatalog?.find(item => item.id === ancestor);
          assert.ok(entry, 'latest_live_ancestor_missing_from_original_catalog');
          assert.ok(['continuable', 'one-shot'].includes(entry.mode)); parentId = ancestor;
        }
        const parent = await read('session/projections', { request: { sessionId: parentId } });
        const entry = parent.values.subagentCatalog?.find(item => item.id === childId);
        assert.ok(entry, 'latest_live_child_missing_from_original_parent_catalog');
        const projections = await read('session/projections', { request: { sessionId: childId } });
        assert.ok(Number.isInteger(projections.asOfSeq));
        const history = await read('session/page', { request: { address: { kind: 'subagent',
          parentSessionId: parentId, childSessionId: childId, mode: entry.mode },
          throughSeq: projections.asOfSeq, maxMessages: 60 } });
        const parentSummary = (await read('session/list', { _request: {} })).items.find(item => item.sessionId === parentId);
        return { entry, projections, records: history.records, parentSummary };
      },
      capture: async name => {
        assert.match(name, /^latest-live-[a-z0-9-]+$/);
        await writeFile(resolve(runtime, name + '.png'), await device.screenshot());
      },
      readSession: async ({ allRecords = false } = {}) => {
        assert.equal(typeof allRecords, 'boolean');
        const projections = await read('session/projections', { request: { sessionId: session.sessionId } });
        assert.ok(Number.isInteger(projections?.asOfSeq));
        let history = await read('session/page', { request: { address: { kind: 'session', sessionId: session.sessionId },
          throughSeq: projections.asOfSeq, maxMessages: 60 } });
        let records = history.records;
        if (allRecords) {
          // 旧分页窗口可能随新消息前移；恢复审计必须固定throughSeq并读完原历史。
          for (let pages = 1; history.hasMore; pages++) {
            assert.ok(pages < 128); const beforeSeq = records[0]?.event.seq;
            assert.ok(Number.isSafeInteger(beforeSeq) && beforeSeq > 0);
            history = await read('session/page', { request: { address: { kind: 'session', sessionId: session.sessionId },
              throughSeq: projections.asOfSeq, maxMessages: 60, beforeSeq } });
            assert.ok(history.records.length > 0); assert.ok(history.records.at(-1).event.seq < beforeSeq);
            records = [...history.records, ...records];
          }
          assert.equal(records.length, projections.asOfSeq + 1);
          records.forEach((row, index) => assert.equal(row.event.seq, index));
          assert.deepEqual(await read('session/projections', { request: { sessionId: session.sessionId } }), projections);
        }
        const row = (await read('session/list', { _request: {} })).items.find(item => item.sessionId === session.sessionId);
        assert.equal(resolve(row.cwd), resolve(selectedWorkspacePath));
        return { row, projections, records };
      },
    };
  } catch (error) { await device.close(); throw error; }
}
