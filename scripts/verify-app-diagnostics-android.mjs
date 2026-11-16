import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { symbolicateWebLog } from './symbolicate-web-log.mjs';

const serial = process.env.DSHM_ADB_SERIAL ?? '127.0.0.1:16384';
const pkg = 'dev.dshmobile.validation.rc3test';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device, 'MuMu not connected');
const evidence = {};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = resolve('artifacts/rc3');

async function ordinary() {
  const page = await (await androidAppWebView(device, pkg)).page();
  page.setDefaultTimeout(12000);
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  return page;
}

async function openSettings(page) {
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
}

async function openLog(page) {
  await page.getByRole('button', { name: '问题诊断', exact: true }).click();
  const log = page.getByTestId('remote-live-log');
  await log.getByText('Android 进程已启动', { exact: true }).first().waitFor();
  return log;
}

async function entry(page, event, after = 0) {
  const handle = await page.waitForFunction(({ event, after }) => window.__dshmDiagnostics.getSnapshot()
    .findLast(row => row.event === event && row.id > after), { event, after });
  return handle.jsonValue();
}

async function verifyCaptureSwitch(page, native) {
  const control = () => page.getByRole('switch', { name: '日志采集', exact: true });
  const baseline = (await entry(page, 'process_started')).id;
  await control().uncheck();
  await page.getByText('采集已关闭，仍可查看已有日志。', { exact: true }).waitFor();
  assert.equal((await entry(page, 'native_uncaught', native.id - 1)).id, native.id);
  const exercised = await page.evaluate(() => {
    let reads = 0;
    const error = { get stack() { reads++; return 'Error'; } };
    for (let index = 0; index < 5000; index++) {
      window.__dshmDiagnostics.record('ordinary', 'render_failed', { error, level: 'ERROR', count: 718 });
    }
    window.DSHMDiagnostics.postMessage(JSON.stringify({ op: 'record', entry: {
      domain: 'ordinary', event: 'render_failed', level: 'ERROR', count: 719,
    } }));
    return reads;
  });
  assert.equal(exercised, 0, 'The disabled WebView must not inspect exception stacks');
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  page = await ordinary();
  await openSettings(page);
  await openLog(page);
  await page.getByText('采集已关闭，仍可查看已有日志。', { exact: true }).waitFor();
  assert.equal(await control().isChecked(), false);
  assert.equal((await entry(page, 'process_started')).id, baseline, 'Disabled native startup created a record');
  assert.equal(await page.evaluate(() => window.__dshmDiagnostics.getSnapshot().some(row => [718, 719].includes(row.count))), false);
  await control().check();
  await page.waitForFunction(() => window.__dshmDiagnostics.enabled);
  const rate = await page.evaluate(() => {
    let reads = 0;
    const error = { get stack() { reads++; return 'Error'; } };
    for (let index = 0; index < 5000; index++) {
      window.__dshmDiagnostics.record('ordinary', 'render_failed', { error, level: 'ERROR', count: 720 });
    }
    return reads;
  });
  await entry(page, 'render_failed', native.id);
  assert.ok(rate > 0 && rate <= 64, `Expected bounded stack capture, received ${rate} accesses`);
  evidence.captureSwitch = { historyPreserved: true, offAfterRestart: true, nativeStopped: true, stackAccesses: rate, recordsResumed: true };
  return page;
}

try {
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  let page = await ordinary();
  await openSettings(page);
  let log = await openLog(page);
  await entry(page, 'ordinary_open_done');
  await entry(page, 'phone_plugin_done');
  const baseline = (await entry(page, 'process_started')).id;
  await page.evaluate(() => {
    const error = new TypeError('DSHM_PRIVATE_MESSAGE_PROBE', { cause: new RangeError('DSHM_PRIVATE_CAUSE_PROBE') });
    error.stack = 'TypeError: DSHM_PRIVATE_MESSAGE_PROBE\n    at https://appassets.androidplatform.net/assets/web/startup.js:4:8';
    window.dispatchEvent(new ErrorEvent('error', { error }));
  });
  const web = await entry(page, 'uncaught_error', baseline);
  assert.equal(web.source, 'webview');
  assert.equal(web.exception.causes.length, 2);
  assert.ok(!JSON.stringify(web).includes('DSHM_PRIVATE'));
  await log.getByRole('button', { name: /WebView 未捕获异常/ }).last().click();
  assert.match(await page.getByTestId('dshm-log-detail').innerText(), /startup\.js:4:8/);
  await page.getByRole('button', { name: '复制详情与调用栈', exact: true }).click();
  await page.getByText('诊断信息已复制', { exact: true }).waitFor();
  evidence.webCaptureAndCopy = true;
  await page.getByRole('dialog', { name: '问题诊断', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();

  await page.getByRole('button', { name: /软件更新/ }).click();
  const update = page.getByRole('dialog', { name: '软件更新', exact: true });
  const check = update.getByRole('button', { name: /检查更新|重试/ }).first();
  await check.waitFor();
  await page.evaluate(() => {
    const bridge = window.DSHMUpdates;
    const post = bridge.postMessage;
    bridge.postMessage = function (message) {
      if (JSON.parse(message).op === 'updates.check') {
        bridge.postMessage = post;
        throw Error('DSHM_PRIVATE_TRANSPORT_PROBE');
      }
      return post.call(bridge, message);
    };
  });
  await check.click();
  await update.getByText('更新未完成', { exact: true }).waitFor();
  await update.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await openLog(page);
  const minified = await entry(page, 'update_action_failed', web.id);
  const symbols = JSON.parse(await readFile('artifacts/ci/web-symbols/current.json', 'utf8'));
  const decoded = symbolicateWebLog(minified, await readFile(resolve('artifacts/ci/web-symbols', symbols.file)));
  const located = decoded.exception.causes.flatMap(cause => cause.frames).find(frame => frame.source === 'src/app-updates.mjs');
  assert.ok(located?.line > 0, 'Expected an actual minified AppUpdates frame');
  evidence.minifiedFrame = located;
  await writeFile(resolve(output, 'diagnostics-webview-sample.json'), JSON.stringify(minified, null, 2));

  // The debug package is separate from the signed app. Trigger Android's own uncaught-exception path.
  const pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.match(pid, /^\d+$/);
  await device.shell(`am crash --user 0 ${pid}`);
  let persisted;
  for (let attempt = 0; attempt < 30 && !persisted; attempt++) {
    const query = `SELECT count(*) FROM log WHERE id>${minified.id} AND instr(entry,'native_uncaught')>0;`;
    const result = await device.shell(`run-as ${pkg} sqlite3 databases/dshm-diagnostics-v1.db "${query}"`);
    persisted = Number(result.toString().trim()) > 0;
    if (!persisted) await pause(250);
  }
  assert.ok(persisted, 'Android crash did not reach the persisted journal');
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  page = await ordinary();
  await openSettings(page);
  log = await openLog(page);
  assert.equal((await entry(page, 'update_action_failed', web.id)).id, minified.id);
  const native = await entry(page, 'native_uncaught', minified.id);
  assert.equal(native.source, 'android');
  assert.ok(native.exception.causes.some(cause => cause.frames.length));
  await log.getByRole('button', { name: /Android 未捕获异常/ }).last().click();
  await page.getByRole('button', { name: '复制详情与调用栈', exact: true }).click();
  await page.getByText('诊断信息已复制', { exact: true }).waitFor();
  evidence.nativeCrashAndRestart = true;
  await writeFile(resolve(output, 'diagnostics-native-sample.json'), JSON.stringify(native, null, 2));
  await page.screenshot({ path: resolve(output, 'diagnostics-android-stack.png') });
  if (process.argv.includes('--capture-toggle')) page = await verifyCaptureSwitch(page, native);
  if (process.argv.includes('--live-remote')) {
    await page.getByRole('dialog', { name: '问题诊断', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.getByRole('button', { name: '退出设置', exact: true }).click();
    const context = page.context();
    await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await page.getByRole('button', { name: 'Remote', exact: true }).click();
    for (let attempt = 0; attempt < 100; attempt++) {
      const remote = context.pages().find(candidate => candidate.url().startsWith('https://remote.dshm.invalid/'));
      if (remote) { page = remote; break; }
      await pause(150);
    }
    assert.ok(page.url().startsWith('https://remote.dshm.invalid/'));
    page.setDefaultTimeout(30000);
    await page.getByText('DSHM 大响应验收', { exact: true }).first().click();
    const history = page.locator('.remote-history-list');
    const editor = page.locator('[data-composer-input] [contenteditable=true], [data-composer-input][contenteditable=true]').first();
    await editor.waitFor();
    const loadOlder = page.getByRole('button', { name: '加载更早的消息', exact: true });
    const canPage = await loadOlder.count() > 0;
    if (canPage) await loadOlder.click();
    const token = 'DSHM_DIAGNOSTICS_OK';
    const prompt = `这是 DSHM 日志验收，只回复 ${token}，不要调用工具。`;
    await editor.fill(prompt);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByText(token, { exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '实时日志', exact: true }).click();
    const sent = await entry(page, 'remote_send_done', native.id);
    const receipt = await entry(page, 'remote_turn_input_received', native.id);
    const finished = await entry(page, 'remote_turn_done', native.id);
    assert.equal(sent.trace, receipt.trace);
    assert.equal(finished.trace, receipt.trace);
    if (canPage) {
      const older = await entry(page, 'history_page_done', native.id);
      assert.ok(older.count > 0);
      evidence.historyPage = older.count;
    }
    evidence.realRemote = { acknowledged: true, turnCompleted: true, correlated: true };
    if (process.argv.includes('--capture-toggle')) {
      const control = page.getByRole('switch', { name: '日志采集', exact: true });
      const ordinary = context.pages().find(candidate => candidate.url().startsWith('https://appassets.androidplatform.net/'));
      assert.ok(ordinary);
      await control.uncheck();
      await ordinary.waitForFunction(() => window.__dshmDiagnostics.enabled === false);
      await control.check();
      await ordinary.waitForFunction(() => window.__dshmDiagnostics.enabled === true);
      evidence.captureSwitch.sharedAcrossWebViews = true;
    }
    await page.screenshot({ path: resolve(output, 'diagnostics-remote-live.png') });
  }
} finally {
  console.log(JSON.stringify(evidence));
  await device.close();
}
