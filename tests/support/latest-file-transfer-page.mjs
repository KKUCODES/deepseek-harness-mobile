import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 原桥已写入一块后延迟确认，不替换字节或连接结果；让实际断线发生在原下载生命周期内。 */
async function pauseDownload(page, file, hold = true, holdFinished = false) {
  await page.getByTestId('remote-workspace').evaluate((element, { file, hold, holdFinished }) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    let model;
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.model?.client) { model = fiber.memoizedProps.model; break; }
    }
    if (!model || window.__latestFileTransfer) throw Error('file_transfer_observation_unavailable');
    const client = model.client, originalCall = client.call, originalRequest = client.request;
    const state = { held: false, finishedHeld: false, aborts: 0, saves: 0, shares: 0, saveRequested: 0, shareRequested: 0, finished: 0, connections: [] };
    let release;
    const unsubscribe = client.subscribe(frame => {
      if (['ready', 'closed'].includes(frame.type)) state.connections.push({ type: frame.type, reason: frame.reason });
    });
    function request(operation, ...args) {
      const pending = originalRequest.call(this, operation, ...args);
      if (state.downloadId && operation.method === 'remote.rpc' && operation.endpoint === 'workspaceFiles/readBytes'
        && operation.payload?.args?.workspaceFileScopeId === file.sessionId && operation.payload.args.path === file.name)
        state.requestId = pending.id;
      return pending;
    }
    async function call(operation, data, ...args) {
      if (operation === 'file.save' && data?.downloadId === state.downloadId) state.saveRequested++;
      if (operation === 'file.share' && data?.downloadId === state.downloadId) state.shareRequested++;
      const value = await originalCall.call(this, operation, data, ...args);
      if (operation === 'file.begin') state.downloadId = value.downloadId;
      if (data?.downloadId === state.downloadId) {
        if (operation === 'file.abort') state.aborts++;
        if (operation === 'file.save') state.saves++;
        if (operation === 'file.share') state.shares++;
        if (operation === 'file.finish') state.finished++;
        if (holdFinished && operation === 'file.finish') {
          state.finishedHeld = true;
          await new Promise(resolve => { release = resolve; });
        }
        if (hold && operation === 'file.chunk' && !state.held) {
          if (data.offset !== 0 || value.bytes !== 65536) throw Error('file_transfer_requires_real_first_chunk');
          state.nativeBytes = value.bytes; state.held = true;
          await new Promise(resolve => { release = resolve; });
        }
      }
      return value;
    }
    client.request = request; client.call = call;
    window.__latestFileTransfer = { state, release() { release?.(); }, stop() {
      release?.(); unsubscribe();
      if (client.request === request) client.request = originalRequest;
      if (client.call === call) client.call = originalCall;
      delete window.__latestFileTransfer;
    } };
  }, { file, hold, holdFinished });
  return { snapshot: () => page.evaluate(() => ({ ...window.__latestFileTransfer.state })),
    release: () => page.evaluate(() => window.__latestFileTransfer.release()),
    stop: () => page.evaluate(() => window.__latestFileTransfer?.stop()) };
}

/** 实际保存窗口、跨UID只读分享接收与连接失效清理；仅清理本次唯一命名且摘要匹配的副本。 */
export async function verifyLatestFileTransfers(page, device, packageName, verify, capture,
  { pickerLifetime = false, writeDeath = false, shareDeath = false, allFormats = false, formatGroup,
    title, marker, onReopened = () => {} } = {}) {
  assert.equal(packageName, 'dev.dshmobile.validation.latestofficetest');
  const receiver = packageName + '.test', prepared = await verify('file-transfer-prepare');
  let panel = page.getByRole('region', { name: '插件面板', exact: true });
  let actions = panel.locator('.remote-file-preview-actions:visible');
  const report = { sources: [] }, targets = [];
  const uuid = randomUUID(), xmlPath = '/data/local/tmp/dshm-latest-share.xml';
  let systemOpen = false, observer, destinationProbe, shareProbe;
  const paths = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0').filter(Boolean);
  const downloads = async () => (await device.shell(`run-as ${packageName} find cache/remote-downloads -type f`)).toString().trim().split(/\r?\n/).filter(Boolean);
  const digest = async target => (await device.shell(`sha256sum '${target}'`)).toString().trim().split(/\s+/)[0];
  const close = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await actions.waitFor({ state: 'detached' });
  };
  const openWorkspace = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
    await actions.waitFor();
  };
  const exportName = (source, label) => `dshm-latest-export-${uuid}-${label}.${source.name.split('.').at(-1)}`;
  const openPicker = async (source, label, root = '下载') => {
    const name = exportName(source, label);
    assert.match(name, /^dshm-latest-export-[a-z0-9.-]+$/);
    const target = '/sdcard/Download/' + name;
    assert.equal((await paths()).includes(target), false);
    await actions.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await actions.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 }); systemOpen = true;
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === root && node['resource-id'] === 'android:id/title');
    await tapPickerNode(device, node => node['resource-id'] === 'android:id/title' && node.class === 'android.widget.EditText');
    const previous = (await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text;
    assert.ok(previous && previous.length < 200);
    await device.shell('input keyevent KEYCODE_MOVE_END');
    await device.shell(`input keyevent ${Array(previous.length).fill('KEYCODE_DEL').join(' ')}`);
    await device.shell(`input text ${name}`);
    assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, name);
    return { name, target };
  };
  const save = async (source, label) => {
    const { name, target } = await openPicker(source, label);
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    assert.equal((await pickerNodes(device)).some(node => node.text === '替换'), false);
    await actions.getByText('已保存到所选位置。', { exact: true }).waitFor({ timeout: 60000 }); systemOpen = false;
    assert.ok((await paths()).includes(target));
    assert.equal(Number((await device.shell(`stat -c %s '${target}'`)).toString()), source.bytes);
    assert.equal(await digest(target), source.sha256);
    targets.push({ target, sha256: source.sha256 });
    assert.deepEqual(await downloads(), []);
    return { savedName: name, bytes: source.bytes, sha256: source.sha256, actualSystemSave: true };
  };
  const until = async (check, description, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (!await check()) {
      assert.ok(Date.now() < deadline, description);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  const chooser = async () => {
    await device.shell(`uiautomator dump ${xmlPath}`);
    const xml = (await device.shell(`cat ${xmlPath}`)).toString();
    return { xml, nodes: [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]]))) };
  };
  const launchOriginal = async () => {
    await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f 0x10200000 -n ${packageName}/dev.dshmobile.validation.ValidationActivity`);
    const pid = (await device.shell(`pidof ${packageName}`)).toString().trim();
    assert.match(pid, /^[1-9]\d*$/);
    return pid;
  };
  const enterRemote = async () => {
    const context = (await (await androidAppWebView(device, packageName)).page()).context();
    let remote = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) {
      const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
      assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      const opened = context.waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); remote = await opened;
    }
    remote.setDefaultTimeout(20000);
    return remote;
  };
  const restoreSession = async () => {
    page = await enterRemote(); onReopened(page);
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count())
      await page.getByRole('button').filter({ hasText: title }).click();
    await page.getByText(marker, { exact: true }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        if (fiber.memoizedProps?.model?.getSnapshot) return fiber.memoizedProps.model.getSnapshot().selected;
      }
    }), prepared.sessionId);
    panel = page.getByRole('region', { name: '插件面板', exact: true });
    actions = panel.locator('.remote-file-preview-actions:visible');
  };
  const share = async (source, label) => {
    await device.shell(`run-as ${receiver} rm -f files/remote-share-result.json`);
    await actions.getByRole('button', { name: '分享完整文件', exact: true }).click(); systemOpen = true;
    let choice;
    const until = Date.now() + 20000;
    do { choice = await chooser(); } while (!choice.xml.includes('resource-id="android:id/chooser_header"') && Date.now() < until);
    assert.ok(choice.xml.includes('resource-id="android:id/chooser_header"'));
    const nodes = choice.nodes.filter(node => ['android', 'com.android.intentresolver'].includes(node.package)
      && node.text === 'DSHM 新版分享验收');
    assert.equal(nodes.length, 1);
    await capture('share-' + label);
    const [left, top, right, bottom] = nodes[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`);
    let received;
    for (let attempt = 0; attempt < 40; attempt++) {
      const raw = (await device.shell(`run-as ${receiver} cat files/remote-share-result.json`)).toString();
      try { received = JSON.parse(raw); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.ok(received); assert.equal(received.error, undefined);
    assert.equal(received.bytes, source.bytes); assert.equal(received.sha256, source.sha256);
    assert.equal(received.name, source.name); assert.equal(received.authority, packageName + '.remote.files');
    assert.equal(received.scheme, 'content'); assert.equal(received.writeRejected, true);
    assert.equal(received.unrelatedRejected, true);
    assert.notEqual(received.uid, Number((await device.shell(`run-as ${packageName} id -u`)).toString()));
    await actions.getByText('已打开系统分享面板。', { exact: true }).waitFor(); systemOpen = false;
    assert.equal(await actions.getByText(/已发送|已分享/).count(), 0);
    assert.deepEqual(await downloads(), []);
    return { received, actualReadOnlyRecipient: true, noSentClaim: true };
  };
  try {
    if (allFormats) {
      assert.ok(!pickerLifetime && !writeDeath && !shareDeath);
      assert.deepEqual(prepared.formats.map(item => item.extension), ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt']);
      assert.ok(['word-and-xlsx', 'xls-and-slides'].includes(formatGroup));
      // 原生分享保留最多8份已交付快照；每个独立配对只分享6份，不删缓存或修改生命周期。
      const formats = formatGroup === 'word-and-xlsx' ? prepared.formats.slice(0, 3) : prepared.formats.slice(3);
      for (const { extension, workspace, attachment } of formats) {
        await openWorkspace(workspace.name);
        report.sources.push({ source: 'workspace', extension, originalName: workspace.name,
          save: await save(workspace, 'workspace-' + extension), share: await share(workspace, 'workspace-' + extension) });
        await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
        await page.getByRole('button', { name: '查看附件 ' + attachment.name, exact: true }).click();
        await actions.waitFor();
        report.sources.push({ source: 'historical-attachment', extension, attachmentId: attachment.attachmentId,
          originalName: attachment.name, save: await save(attachment, 'attachment-' + extension),
          share: await share(attachment, 'attachment-' + extension) });
        await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
        await capture('format-' + extension + '-complete', { extension, sources: report.sources.slice(-2) });
      }
      assert.equal(report.sources.length, 6);
      assert.equal((await verify('file-transfer-finish')).sourceBytesPreserved, true);
      report.originalSourcesPreserved = true;
      report.scope = 'office-formats-original-save-and-share';
      report.formatGroup = formatGroup;
      report.formats = formats.map(item => item.extension);
      return report;
    }
    if (shareDeath) {
      assert.ok(title && marker && !pickerLifetime && !writeDeath);
      const publishedFiles = async () => (await device.shell(`run-as ${packageName} find cache/remote-shares -type f`)).toString().trim().split(/\r?\n/).filter(Boolean);
      await openWorkspace(prepared.network.name);
      const originalShare = await share(prepared.network, 'before-death');
      const complete = await publishedFiles(); assert.equal(complete.length, 1);
      assert.match(complete[0], /^cache\/remote-shares\/[a-f0-9-]{36}\/dshm-latest-export-network\.bin$/);
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${complete[0]}`)).toString().split(/\s+/)[0], prepared.network.sha256);
      observer = await pauseDownload(page, { sessionId: prepared.sessionId, name: prepared.network.name }, false, true);
      await actions.getByRole('button', { name: '分享完整文件', exact: true }).click();
      await page.waitForFunction(() => window.__latestFileTransfer?.state.finishedHeld);
      const source = await downloads(); assert.equal(source.length, 1);
      assert.match(source[0], /^cache\/remote-downloads\/remote-[a-zA-Z0-9]+\.part$/);
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${source[0]}`)).toString()), prepared.network.bytes);
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${source[0]}`)).toString().split(/\s+/)[0], prepared.network.sha256);
      const directory = 'cache/share-death-probe', backupName = `source-${uuid}.bin`, backup = `${directory}/${backupName}`;
      shareProbe = { directory, backup, fifo: source[0] };
      await device.shell(`run-as ${packageName} mkdir -p ${directory}`);
      // 原下载字节已经完整落盘并核对；FIFO只控制原分享线程的读取进度。
      await device.shell(`run-as ${packageName} mv ${source[0]} ${backup}`);
      await device.shell(`run-as ${packageName} /system/bin/mkfifo ${source[0]}`);
      const config = { source: backupName, fifo: source[0].split('/').at(-1), name: prepared.network.name, expectedBytes: prepared.network.bytes };
      const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
      await device.shell(`printf %s '${encoded}' | base64 -d | run-as ${packageName} tee ${directory}/control.json`);
      await device.shell(`am start -W -n ${packageName}/dev.dshmobile.validation.RemoteShareFeedProbeActivity`);
      await observer.release();
      let ready;
      await until(async () => {
        const raw = (await device.shell(`run-as ${packageName} cat ${directory}/ready.json`)).toString();
        try { ready = JSON.parse(raw); return true; } catch { return false; }
      }, 'Actual share copy never reached its first block');
      assert.equal(ready.bytes, 65536); assert.equal(ready.expectedBytes, prepared.network.bytes);
      assert.equal(ready.providerCanResolvePartial, false);
      assert.match(ready.partial, /^cache\/preparing-remote-shares\/[a-f0-9-]{36}-[a-f0-9-]{36}\/dshm-latest-export-network\.bin$/);
      const prefixHash = (await device.shell(`run-as ${packageName} head -c 65536 ${backup} | sha256sum`)).toString().split(/\s+/)[0];
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${ready.partial}`)).toString().split(/\s+/)[0], prefixHash);
      const copying = await observer.snapshot(); assert.equal(copying.finished, 1); assert.equal(copying.shareRequested, 1); assert.equal(copying.shares, 0);
      assert.deepEqual(await publishedFiles(), complete);
      assert.equal((await chooser()).nodes.some(node => node['resource-id'] === 'android:id/chooser_header'), false);
      const oldPid = (await device.shell(`pidof ${packageName}`)).toString().trim(); assert.equal(oldPid, String(ready.pid));
      await capture('share-copying', { ready, copying, sourceBytes: prepared.network.bytes, sourceSha256: prepared.network.sha256, prefixHash });
      await device.shell(`am force-stop ${packageName}`); observer = undefined;
      assert.equal((await device.shell(`pidof ${packageName}`)).toString().trim(), '');
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${ready.partial}`)).toString()), 65536);
      // FIFO是测试辅助物，不能将其清理记作生产暂存清理；原分享半成品留给真实启动处理。
      assert.match((await device.shell(`run-as ${packageName} stat -c %F ${source[0]}`)).toString().trim(), /^FIFO(?: \(named pipe\))?$/i);
      await device.shell(`run-as ${packageName} rm ${source[0]} ${directory}/control.json`);
      const newPid = await launchOriginal(); assert.notEqual(newPid, oldPid);
      await restoreSession();
      const remaining = (await device.shell(`run-as ${packageName} find cache/preparing-remote-shares -mindepth 1 -print`)).toString().trim();
      assert.equal(remaining, ''); assert.deepEqual(await publishedFiles(), complete);
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${complete[0]}`)).toString().split(/\s+/)[0], prepared.network.sha256);
      assert.deepEqual(await downloads(), []);
      assert.equal((await chooser()).nodes.some(node => node['resource-id'] === 'android:id/chooser_header'), false);
      await capture('share-death-session-restored');
      await openWorkspace(prepared.network.name);
      const retry = await share(prepared.network, 'after-death');
      assert.equal((await publishedFiles()).length, 2);
      report.sharePreparationDeath = { oldPid, newPid, ready, copying, prefixHash, originalShare, retry,
        actualRemoteDownloadVerified: true, actualCopyWithPrivateFifo: true, actualProcessStopped: true,
        partialSurvivedDeath: true, partialNotPublishable: true, startupRemovedUnpublishedPartial: true,
        priorCompleteSnapshotPreserved: true, noAutomaticChooser: true, originalBindingReconnected: true, sameSessionRead: true };
      await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      assert.equal((await verify('file-transfer-finish')).sourceBytesPreserved, true);
      report.originalSourcesPreserved = true;
      return report;
    }
    if (writeDeath) {
      assert.ok(title && marker && !pickerLifetime);
      const directory = 'cache/save-death-probe', document = 'dshm-save-test-' + uuid;
      const config = { document, name: exportName(prepared.network, 'writing'), expectedBytes: prepared.network.bytes };
      destinationProbe = { directory, document };
      await device.shell(`run-as ${packageName} mkdir -p ${directory}`);
      const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
      await device.shell(`printf %s '${encoded}' | base64 -d | run-as ${packageName} tee ${directory}/control.json`);
      const before = (await paths()).sort();
      await openWorkspace(prepared.network.name);
      observer = await pauseDownload(page, { sessionId: prepared.sessionId, name: prepared.network.name }, false);
      await openPicker(prepared.network, 'writing', 'DSHM 写入验收');
      const complete = await downloads(), downloaded = await observer.snapshot();
      assert.equal(downloaded.finished, 1); assert.equal(downloaded.saves, 0); assert.equal(complete.length, 1);
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${complete[0]}`)).toString()), prepared.network.bytes);
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${complete[0]}`)).toString().split(/\s+/)[0], prepared.network.sha256);
      const prefixHash = (await device.shell(`run-as ${packageName} head -c 4096 ${complete[0]} | sha256sum`)).toString().split(/\s+/)[0];
      await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true'); systemOpen = false;
      let ready;
      await until(async () => {
        const raw = (await device.shell(`run-as ${packageName} cat ${directory}/ready.json`)).toString();
        try { ready = JSON.parse(raw); return true; } catch { return false; }
      }, 'Actual system destination never received bytes');
      assert.equal(ready.document, document); assert.equal(ready.bytes, 4096); assert.equal(ready.expectedBytes, prepared.network.bytes);
      const partial = `${directory}/${document}`;
      const journal = async () => (await device.shell(`run-as ${packageName} find no_backup/remote-save-writes -type f`)).toString().trim().split(/\r?\n/).filter(Boolean);
      const pending = await journal(); assert.equal(pending.length, 1);
      assert.match(pending[0], /^no_backup\/remote-save-writes\/[a-f0-9-]{36}\.pending$/);
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${pending[0]}`)).toString()), 1);
      const oldPid = (await device.shell(`pidof ${packageName}`)).toString().trim(); assert.equal(oldPid, String(ready.pid));
      assert.equal(await actions.getByText('已保存到所选位置。', { exact: true }).count(), 0);
      await capture('target-writing');
      await device.shell(`am force-stop ${packageName}`); observer = undefined;
      assert.equal((await device.shell(`pidof ${packageName}`)).toString().trim(), '');
      const checkPartial = async () => {
        assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${partial}`)).toString()), ready.bytes);
        assert.equal((await device.shell(`run-as ${packageName} sha256sum ${partial}`)).toString().split(/\s+/)[0], prefixHash);
        assert.deepEqual((await paths()).sort(), before);
      };
      await checkPartial();
      // 隐藏测试根目录；保留实际目标和生产日志，不能以测试清理替代启动恢复。
      await device.shell(`run-as ${packageName} rm ${directory}/control.json`);
      const newPid = await launchOriginal(); assert.notEqual(newPid, oldPid);
      const warning = async () => {
        const screen = await chooser();
        const own = screen.nodes.filter(node => node.package === packageName);
        assert.ok(own.some(node => node.text === '上次文件保存结果未确认'));
        assert.ok(own.some(node => node.text?.includes('不完整文件')));
        return own;
      };
      await warning(); await capture('write-death-ordinary-warning');
      await device.shell('input keyevent KEYCODE_BACK');
      page = await enterRemote();
      await warning(); await capture('write-death-remote-warning');
      await device.shell('input keyevent KEYCODE_BACK');
      await restoreSession(); await checkPartial();
      assert.deepEqual(await journal(), pending); assert.deepEqual(await downloads(), []);
      await capture('write-death-session-restored');
      await device.shell(`am force-stop ${packageName}`); await launchOriginal();
      const buttons = (await warning()).filter(node => node.text === '知道了'); assert.equal(buttons.length, 1);
      await capture('write-death-unacknowledged');
      const [left, top, right, bottom] = buttons[0].bounds.match(/\d+/g).map(Number);
      await device.shell(`input tap ${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`);
      assert.deepEqual(await journal(), []); await checkPartial();
      await device.shell(`am force-stop ${packageName}`); await launchOriginal();
      assert.equal((await chooser()).nodes.some(node => node.text === '上次文件保存结果未确认'), false);
      await restoreSession(); await checkPartial();
      await openWorkspace(prepared.network.name);
      report.destinationWriteDeath = { oldPid, newPid, ready, sourceBytes: prepared.network.bytes, sourceSha256: prepared.network.sha256,
        prefixHash, actualSystemPicker: true, controlledPrivateDestination: true, actualProcessStopped: true,
        ordinaryAndRemoteWarnings: true, unacknowledgedAcrossRestart: true, acknowledgedAcrossRestart: true,
        partialPreserved: true, startupRemovedDownload: true, originalBindingReconnected: true, sameSessionRead: true,
        noAutomaticSave: true, retry: await save(prepared.network, 'write-death-recovered') };
      await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      assert.equal((await verify('file-transfer-finish')).sourceBytesPreserved, true);
      report.originalSourcesPreserved = true;
      return report;
    }
    if (pickerLifetime) {
      assert.ok(title && marker);
      const before = (await paths()).sort();
      await openWorkspace(prepared.network.name);
      observer = await pauseDownload(page, { sessionId: prepared.sessionId, name: prepared.network.name }, false);
      const canceled = await openPicker(prepared.network, 'canceled-picker');
      const preparedState = await observer.snapshot(), complete = await downloads();
      assert.equal(preparedState.finished, 1); assert.equal(preparedState.saveRequested, 1);
      assert.equal(complete.length, 1); assert.match(complete[0], /^cache\/remote-downloads\/remote-[a-zA-Z0-9]+\.part$/);
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${complete[0]}`)).toString()), prepared.network.bytes);
      assert.equal((await device.shell(`run-as ${packageName} sha256sum ${complete[0]}`)).toString().split(/\s+/)[0], prepared.network.sha256);
      await capture('picker-ready');
      const drop = await verify('file-transfer-drop', { requestId: preparedState.requestId });
      // 系统窗口在前台时WebView可暂停；先核对原生清理与实际Activity退出。
      await until(async () => (await downloads()).length === 0, 'Native picker bytes were not removed');
      await until(async () => !(await device.shell('dumpsys activity activities')).toString()
        .match(/topResumedActivity=[^\r\n]*com\.android\.documentsui/), 'Canceled picker stayed open');
      systemOpen = false;
      await page.getByTestId('remote-workspace').waitFor();
      // 原生关闭系统窗口的取消回复可先于WebView的断线事件到达；两者都不能显示保存成功。
      const interruptedNotice = actions.getByRole('status').filter({ hasText: /^(已取消下载。|下载未完成，请检查连接、文件权限和手机存储后重试。)$/ });
      await interruptedNotice.waitFor();
      await page.waitForFunction(() => window.__latestFileTransfer.state.connections.some(frame => frame.type === 'ready'));
      const disconnected = await observer.snapshot();
      assert.equal(disconnected.saves, 0); assert.equal(disconnected.shares, 0);
      assert.ok(disconnected.connections.some(frame => frame.type === 'closed' && frame.reason === undefined));
      assert.deepEqual((await paths()).sort(), before);
      assert.equal((await paths()).includes(canceled.target), false);
      await capture('picker-canceled'); await observer.stop(); observer = undefined;
      report.pickerDisconnect = { preparedBytes: prepared.network.bytes, preparedState, disconnected, drop,
        actualPickerClosed: true, temporaryRemoved: true, noEmptyDestination: true, notice: await interruptedNotice.innerText(),
        retry: await save(prepared.network, 'picker-recovered') };
      await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();

      const savedBeforeDeath = (await paths()).sort();
      await openWorkspace(prepared.network.name);
      observer = await pauseDownload(page, { sessionId: prepared.sessionId, name: prepared.network.name });
      await actions.getByRole('button', { name: '下载完整文件', exact: true }).click();
      await page.waitForFunction(() => window.__latestFileTransfer?.state.held);
      const held = await observer.snapshot(), partials = await downloads();
      assert.equal(held.nativeBytes, 65536); assert.equal(partials.length, 1);
      assert.match(partials[0], /^cache\/remote-downloads\/remote-[a-zA-Z0-9]+\.part$/);
      const oldPid = (await device.shell(`pidof ${packageName}`)).toString().trim();
      assert.match(oldPid, /^[1-9]\d*$/); await capture('before-process-stop');
      await device.shell(`am force-stop ${packageName}`);
      assert.equal((await device.shell(`pidof ${packageName}`)).toString().trim(), '');
      assert.deepEqual(await downloads(), partials);
      assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${partials[0]}`)).toString()), 65536);
      assert.deepEqual((await paths()).sort(), savedBeforeDeath);
      // 进程已实际不存在；旧内存观察器随进程结束，不能对已关闭页面继续发送取消。
      observer = undefined;
      const newPid = await launchOriginal();
      assert.match(newPid, /^[1-9]\d*$/); assert.notEqual(newPid, oldPid);
      await restoreSession();
      assert.deepEqual(await downloads(), []); assert.deepEqual((await paths()).sort(), savedBeforeDeath);
      assert.equal((await pickerNodes(device)).some(node => node.package === 'com.android.documentsui'), false);
      panel = page.getByRole('region', { name: '插件面板', exact: true });
      actions = panel.locator('.remote-file-preview-actions:visible');
      await capture('after-process-reopen');
      await openWorkspace(prepared.network.name);
      report.processDeath = { oldPid, newPid, bytesBeforeDeath: held.nativeBytes,
        actualProcessStopped: true, partialSurvivedDeath: true, startupRemovedPartial: true,
        originalBindingReconnected: true, sameSessionRead: true, noAutomaticSave: true,
        retry: await save(prepared.network, 'process-recovered') };
      await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      assert.equal((await verify('file-transfer-finish')).sourceBytesPreserved, true);
      report.originalSourcesPreserved = true;
      return report;
    }
    await openWorkspace(prepared.workspace.name);
    report.sources.push({ source: 'workspace', save: await save(prepared.workspace, 'workspace'),
      share: await share(prepared.workspace, 'workspace') });
    await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByRole('button', { name: '查看附件 ' + prepared.attachment.name, exact: true }).click();
    await actions.waitFor();
    report.sources.push({ source: 'historical-attachment', save: await save(prepared.attachment, 'attachment'),
      share: await share(prepared.attachment, 'attachment') });
    await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await openWorkspace(prepared.network.name);
    observer = await pauseDownload(page, { sessionId: prepared.sessionId, name: prepared.network.name });
    await actions.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await page.waitForFunction(() => window.__latestFileTransfer?.state.held);
    const held = await observer.snapshot();
    assert.equal(held.nativeBytes, 65536); assert.match(held.requestId, /^[0-9a-f-]{36}$/);
    const partials = await downloads(); assert.equal(partials.length, 1);
    assert.match(partials[0], /^cache\/remote-downloads\/remote-[a-zA-Z0-9]+\.part$/);
    assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${partials[0]}`)).toString()), held.nativeBytes);
    const drop = await verify('file-transfer-drop', { requestId: held.requestId });
    assert.equal(drop.originalReadSocketDropped, true); assert.equal(drop.onlyMatchedDeviceSocket, true);
    await page.waitForFunction(() => window.__latestFileTransfer.state.connections.some(frame => frame.type === 'closed'));
    await observer.release();
    await actions.getByRole('button', { name: '下载完整文件', exact: true }).waitFor({ state: 'visible' });
    await actions.getByText('下载未完成，请检查连接、文件权限和手机存储后重试。', { exact: true }).waitFor({ timeout: 60000 });
    const failed = await observer.snapshot();
    assert.ok(failed.aborts >= 1); assert.equal(failed.saves, 0); assert.equal(failed.shares, 0);
    assert.deepEqual(await downloads(), []);
    await page.waitForFunction(() => window.__latestFileTransfer.state.connections.some(frame => frame.type === 'ready'),
      undefined, { timeout: 60000 });
    const connections = (await observer.snapshot()).connections;
    assert.ok(connections.some(frame => frame.type === 'closed' && frame.reason === undefined));
    assert.equal(connections.some(frame => frame.reason === 'user_disconnect'), false);
    await capture('disconnected'); await observer.stop(); observer = undefined;
    report.network = { held, failed, drop, connections, partialRemoved: true, noSaveOrShareBeforeComplete: true,
      retry: await save(prepared.network, 'recovered') };
    await close(); await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal((await verify('file-transfer-finish')).sourceBytesPreserved, true);
    report.originalSourcesPreserved = true;
    return report;
  } finally {
    await observer?.stop();
    if (systemOpen) await device.shell('input keyevent KEYCODE_BACK');
    for (const { target, sha256 } of targets) {
      assert.match(target, /^\/sdcard\/Download\/dshm-latest-export-[a-z0-9.-]+$/);
      assert.equal(await digest(target), sha256);
      await device.shell(`rm '${target}'`);
      assert.equal((await paths()).includes(target), false);
    }
    report.testSavedCopiesRemoved = targets.length;
    if (destinationProbe) {
      const { directory, document } = destinationProbe;
      assert.match(document, /^dshm-save-test-[a-f0-9-]{36}$/);
      await device.shell(`run-as ${packageName} rm -f ${directory}/${document} ${directory}/control.json ${directory}/ready.json`);
      report.testDestinationRemoved = true;
    }
    if (shareProbe) {
      const { directory, backup, fifo } = shareProbe;
      assert.match(backup, /^cache\/share-death-probe\/source-[a-f0-9-]{36}\.bin$/);
      assert.match(fifo, /^cache\/remote-downloads\/remote-[a-zA-Z0-9]+\.part$/);
      await device.shell(`run-as ${packageName} rm -f ${backup} ${fifo} ${directory}/control.json ${directory}/ready.json ${directory}/error.json`);
      report.testShareFeedRemoved = true;
    }
    if (!pickerLifetime && !writeDeath) await device.shell(`run-as ${receiver} rm -f files/remote-share-result.json`);
    await device.shell(`rm -f ${xmlPath} /data/local/tmp/dshm-picker-test.xml`);
  }
}
