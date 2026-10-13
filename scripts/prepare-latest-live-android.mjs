// 专用 UID 领取本轮配对；不读取普通 App、电脑或用户的 Key。
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--connect', '--open', '--verify-open', '--restore', '--name', '--inspect'].includes(process.argv[2]));
const connect = process.argv[2] === '--connect';
const open = process.argv[2] === '--open';
const verifyOpen = process.argv[2] === '--verify-open';
const restore = process.argv[2] === '--restore';
const name = process.argv[2] === '--name';
const connected = connect || open || verifyOpen || restore || name;
const chatTitle = 'DSHM 新版手机真实模型验收';
const inspect = process.argv[2] === '--inspect';
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
const child = relative(resolve(runtime, 'live-homes'), state.home);
assert.ok(child && !child.startsWith('..') && !isAbsolute(child));
assert.match(child, /^[0-9a-f-]{36}$/);
assert.equal(await realpath(state.home), resolve(await realpath(resolve(runtime, 'live-homes')), child));
assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(state.ready, true);
const pairing = JSON.parse(await readFile(resolve(state.home, 'private-pair.json'), 'utf8'));
const key = new URLSearchParams(new URL(pairing.link).hash.slice(1)).get('key');
assert.match(key, /^[A-Za-z0-9_-]{43}$/);
assert.match(state.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(new URL(pairing.link).origin, state.origin);
const adb = process.env.DSHM_ADB_PATH, serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(adb && isAbsolute(adb)); assert.equal(serial, 'emulator-5554');
const packageName = 'dev.dshmobile.validation.latesttest';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device, 'Explicit test emulator must be running');
const run = promisify(execFile), port = new URL(state.origin).port;
try {
  await run(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { windowsHide: true });
  if (!connected && !inspect) {
    assert.equal((await device.shell(`pm clear ${packageName}`)).toString().trim(), 'Success');
    const link = `dshm://pair?server=${encodeURIComponent(state.origin)}#key=${key}`;
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${link}' -p ${packageName}`);
  }
  const first = await (await androidAppWebView(device, packageName)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
    ?? await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
  page.setDefaultTimeout(30000);
  if (inspect) {
    console.log(await page.locator('body').innerText());
    await writeFile(resolve(runtime, 'latest-live-android-page.png'), await device.screenshot());
    process.exitCode = 0;
  } else {
    if (!connected) {
      assert.equal(await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).inputValue(), pairing.link);
      await page.getByLabel('设备名称', { exact: true }).fill('DSHM latest model validation');
      await page.getByRole('button', { name: '继续配对', exact: true }).click();
    }
    const pending = connected ? JSON.parse(await readFile(resolve(runtime, 'latest-live-android.json'), 'utf8')) : null;
    if (pending) assert.equal(pending.home, state.home);
    if (!open && !verifyOpen && !restore && !name) await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    const fingerprint = open || verifyOpen || restore || name ? pending.fingerprint : await page.getByTestId('remote-fingerprint').innerText();
    assert.match(fingerprint, /^[A-Za-z0-9_-]{43}$/);
    if (connect) {
      assert.equal(pending.fingerprint, fingerprint);
      await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    }
    if (connected) {
      await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
      if (restore) {
        const recorded = JSON.parse(await readFile(resolve(runtime, 'latest-live-android-session.json'), 'utf8'));
        assert.equal(recorded.home, state.home); assert.equal(recorded.title, chatTitle);
        assert.equal(recorded.originalSessionListVerified, true);
        assert.match(recorded.sessionId, /^session-[0-9a-f-]{36}$/);
        // 空聊天不在“最近”列表；只调用原导航打开已记录的会话，绝不重新创建或发消息。
        await page.getByTestId('remote-workspace').evaluate(async (element, recorded) => {
          const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
          let model;
          for (let fiber = element[key]; fiber; fiber = fiber.return) {
            if (fiber.memoizedProps?.model?.workspaceNavigation) { model = fiber.memoizedProps.model; break; }
          }
          const row = model?.getSnapshot().list?.byId[recorded.sessionId];
          if (!row || row.displayTitle !== recorded.title || !row.blank) throw Error('recorded_blank_session_unavailable');
          await model.workspaceNavigation.showMain(recorded.sessionId);
          if (model.getSnapshot().selected !== recorded.sessionId) throw Error('recorded_session_not_selected');
        }, recorded);
      }
      if (!verifyOpen && !restore && !name) {
        // 新建按钮创建空会话；原插件导航的 startSession 才采用空会话复用规则。
        await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
        await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'test-project', exact: true }).click();
      }
      await page.locator('[data-composer-input]').waitFor();
      const heading = page.getByTestId('remote-workspace').locator('.remote-heading strong');
      assert.equal(await heading.innerText(), verifyOpen || restore || name ? pending.title ?? 'test-project' : 'test-project');
      if (name && pending.title !== chatTitle) {
        await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
        await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(chatTitle);
        await page.getByRole('button', { name: '保存名称', exact: true }).click();
        await heading.filter({ hasText: chatTitle }).waitFor();
        assert.equal(await heading.innerText(), chatTitle);
      }
      assert.equal(await page.locator('iframe').count(), 0);
      await writeFile(resolve(runtime, 'latest-live-android-page.png'), await device.screenshot());
    }
    const result = { at: new Date().toISOString(), home: state.home, origin: state.origin, packageName, serial,
      fingerprint, pending: !connected, connected, ownPage: connected,
      ...(connected ? { title: name ? chatTitle : verifyOpen || restore ? pending.title ?? 'test-project' : 'test-project' } : {}),
      ...(restore ? { restoredRecordedSession: true } : {}),
      inferenceVerified: false };
    await writeFile(resolve(runtime, 'latest-live-android.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ pending: result.pending, connected: result.connected, fingerprint, packageName }));
  }
} finally { await device.close(); }
