import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 真实Remote链路到本机HTTP端点；不保存提供方、不调用模型、不读取用户凭据。
const report = { at: new Date().toISOString(), requests: [], errors: [] };
const stored = process.argv.includes('--stored');
const lifecycle = process.argv.includes('--lifecycle');
assert.ok(!stored || !lifecycle);
const cleanupOnly = process.argv.includes('--cleanup');
const provider = cleanupOnly ? JSON.parse(await readFile('artifacts/model-probe-stored-seed.json', 'utf8')).provider : 'dshm-draft-probe-' + randomUUID().slice(0, 8);
assert.match(provider, /^dshm-draft-probe-[a-f0-9]{8}$/);
const testKey = 'dshmtest' + randomUUID().replaceAll('-', '');
let redirect = false, hold = false, heldResponse;
const server = createServer((req, res) => {
  report.requests.push({ path: req.url, authenticated: !!req.headers.authorization || !!req.headers['x-api-key'] });
  if (req.headers.authorization) report.temporaryAuthenticationMatched = req.headers.authorization === `Bearer ${testKey}`;
  if (redirect && req.url !== '/forbidden') { res.writeHead(302, { location: '/forbidden' }).end(); return; }
  if (hold) {
    heldResponse = res;
    res.on('close', () => { report.pendingRequestClosed = true; });
    return;
  }
  res.setHeader('content-type', 'application/json').end(JSON.stringify({ data: [{ id: 'dshm-probe-local', name: 'DSHM local probe' }] }));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
let creation, storedForm, storedPicker, registered = false;
let nativeOpen = false;
async function nativeNodes() {
  await device.shell('uiautomator dump /data/local/tmp/dshm-probe.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-probe.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
}
async function tapNode(node) {
  assert.ok(node);
  const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
}
async function nativeButton(label) {
  await tapNode((await nativeNodes()).find(node => node.class === 'android.widget.Button' && node.text?.toLowerCase() === label.toLowerCase()));
}
async function cleanupStored() {
  if (!registered) return;
  await storedPicker.selectOption(provider);
  assert.equal(await storedForm.getByLabel('提供方名称', { exact: true }).inputValue(), provider);
  const key = storedForm.getByRole('region', { name: '电脑提供方 Key', exact: true });
  await button(key, '重新读取 Key 状态').click();
  await key.getByText(/^(已配置|尚未配置)$/).waitFor();
  if (await key.getByText('已配置', { exact: true }).isVisible()) {
    await button(key, '管理电脑 Key').click(); nativeOpen = true;
    await nativeButton('移除电脑 Key'); await nativeButton('确认移除'); nativeOpen = false;
    await key.getByText('尚未配置', { exact: true }).waitFor();
  }
  const removal = storedForm.getByRole('region', { name: '移除提供方', exact: true });
  await button(removal, '移除提供方').click(); await button(removal, '确认移除').click();
  await storedPicker.locator(`option[value="${provider}"]`).waitFor({ state: 'detached' });
  registered = false; report.cleaned = true;
}
try {
  const ordinary = await (await androidAppWebView(device)).page(), context = ordinary.context();
  if (cleanupOnly) {
    const cancel = (await nativeNodes()).find(node => node.class === 'android.widget.Button' && node.text === '取消');
    if (cancel) await tapNode(cancel);
  }
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const opening = context.waitForEvent('page');
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click(); page = await opening;
  }
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const chat = main.getByRole('textbox', { name: '消息', exact: true }); await chat.waitFor(); const draft = await chat.innerHTML();
  report.bridgeRejected = await page.evaluate(async () => {
    const bridge = window.DSHMRemote, original = bridge.onmessage, pending = new Map();
    bridge.onmessage = function (event) {
      const value = JSON.parse(event.data), done = pending.get(value.id);
      if (done) { pending.delete(value.id); done(value.error); } else original.call(this, event);
    };
    try {
      const operations = [
        { method: 'remote.modelProbePrepare', baseURL: 'http://127.0.0.1:1/v1', api: 'openai-completions', authentication: { mode: 'temporary' } },
        { method: 'remote.modelProbeExecute', snapshot: crypto.randomUUID(), confirmed: true, mode: 'temporary', apiKey: 'synthetic-rejected' },
        { method: 'remote.modelProbeExecute', snapshot: crypto.randomUUID(), confirmed: true, mode: 'none', apiKey: 'synthetic-rejected' },
      ];
      const results = [];
      for (const operation of operations) {
        results.push(await new Promise((resolve, reject) => {
          const id = crypto.randomUUID(), timeout = setTimeout(() => { pending.delete(id); reject(Error('native rejection timeout')); }, 5000);
          pending.set(id, value => { clearTimeout(timeout); resolve(value); });
          bridge.postMessage(JSON.stringify({ id, op: 'socket.send', data: { frame: { type: 'request', id: crypto.randomUUID(), operation } } }));
        }));
      }
      return results;
    } finally { bridge.onmessage = original; }
  });
  assert.deepEqual(report.bridgeRejected, Array(3).fill('unsupported_operation'));
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  const panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const directory = panel.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  if (cleanupOnly) {
    storedPicker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
    await storedPicker.selectOption(provider);
    storedForm = directory.locator('.remote-provider-form:visible'); registered = true;
    await cleanupStored();
  } else {
  creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
  await button(creation, '新增模型提供方').click();
  await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
  await creation.getByLabel('服务地址', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
  const probe = creation.getByRole('region', { name: '从当前地址获取模型', exact: true });
  await button(probe, '从当前地址获取模型').click();
  await probe.getByRole('group', { name: '确认模型请求', exact: true }).waitFor();
  assert.equal(report.requests.length, 0);
  await button(probe, '确认获取模型').click();
  await probe.getByRole('checkbox').check();
  await button(probe, '加入编辑草稿').click();
  assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), 'dshm-probe-local');
  assert.deepEqual(report.requests, [{ path: '/v1/models', authenticated: false }]);
  report.actualDiscovery = true;
  await probe.getByRole('combobox').selectOption('temporary');
  await button(probe, '从当前地址获取模型').click(); nativeOpen = true;
  let tree = await nativeNodes();
  assert.ok(tree.some(node => node.text === '临时 Key 获取模型'));
  assert.ok(tree.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  await nativeButton('取消'); nativeOpen = false;
  await button(probe, '从当前地址获取模型').waitFor({ state: 'visible' });
  assert.equal(report.requests.length, 1, 'Cancel must not send endpoint request');
  assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), 'dshm-probe-local');
  report.nativeCancelPreservedDraft = true;
  await button(probe, '从当前地址获取模型').click(); nativeOpen = true;
  tree = await nativeNodes();
  await tapNode(tree.find(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  assert.match(testKey, /^dshmtest[a-f0-9]{32}$/);
  await device.shell(`input text ${testKey}`);
  await nativeButton('获取模型'); nativeOpen = false;
  await probe.getByText('没有可添加的新模型。', { exact: true }).waitFor();
  assert.equal(report.requests.length, 2);
  assert.equal(report.temporaryAuthenticationMatched, true);
  assert.equal((await page.locator('body').innerText()).includes(testKey), false);
  report.nativeTemporaryDiscovery = true;
  redirect = true;
  await probe.getByRole('combobox').selectOption('none');
  await button(probe, '从当前地址获取模型').click();
  await button(probe, '确认获取模型').click();
  await probe.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
  assert.equal(report.requests.length, 3);
  assert.equal(report.requests.some(row => row.path === '/forbidden'), false);
  assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), 'dshm-probe-local');
  redirect = false;
  await button(probe, '从当前地址获取模型').click();
  await button(probe, '确认获取模型').click();
  await probe.getByText('没有可添加的新模型。', { exact: true }).waitFor();
  assert.equal(report.requests.length, 4);
  report.redirectRejectedAndRetrySucceeded = true;
  if (lifecycle) {
    hold = true;
    await button(probe, '从当前地址获取模型').click();
    await button(probe, '确认获取模型').click();
    const receivedDeadline = Date.now() + 5000;
    while (!heldResponse && Date.now() < receivedDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(heldResponse, 'Actual Host request must reach endpoint before closing');
    await button(panel, '关闭窗口').click(); creation = null;
    const cancelDeadline = Date.now() + 5000;
    while (!report.pendingRequestClosed && Date.now() < cancelDeadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(report.pendingRequestClosed, true, 'Closing settings cancels actual endpoint request');
    heldResponse.end(JSON.stringify({ data: [{ id: 'late-result-must-not-appear' }] })); hold = false;
    await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
    await button(directory, '其他模型提供方').click();
    creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
    await button(creation, '新增模型提供方').click();
    await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
    assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), '');
    assert.equal(await creation.getByText('late-result-must-not-appear', { exact: true }).count(), 0);
    await creation.getByLabel('服务地址', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
    await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
    await button(probe, '从当前地址获取模型').click(); await button(probe, '确认获取模型').click();
    await probe.getByRole('checkbox').check(); await button(probe, '加入编辑草稿').click();
    assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), 'dshm-probe-local');
    assert.equal(report.requests.length, 6);
    report.reopenAfterCancelSucceeded = true;
  }
  if (stored) {
    report.testProvider = provider;
    await writeFile('artifacts/model-probe-stored-seed.json', JSON.stringify({ provider }));
    await creation.getByLabel('提供方标识', { exact: true }).fill(provider);
    await creation.getByLabel('显示名称（可选）', { exact: true }).fill(provider);
    await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).check();
    await button(creation, '核对提供方').click(); await button(creation, '确认新增').click();
    await button(creation, '查看提供方设置').waitFor(); registered = true;
    await button(creation, '查看提供方设置').click(); creation = null;
    storedPicker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
    storedForm = directory.locator('.remote-provider-form:visible');
    const key = storedForm.getByRole('region', { name: '电脑提供方 Key', exact: true });
    await button(key, '管理电脑 Key').click(); nativeOpen = true;
    tree = await nativeNodes();
    assert.ok(tree.some(node => node.text?.includes(provider)));
    await tapNode(tree.find(node => node.class === 'android.widget.EditText' && node.password === 'true'));
    await device.shell(`input text ${testKey}`); await nativeButton('保存到电脑'); nativeOpen = false;
    await key.getByText('已配置', { exact: true }).waitFor();
    await storedForm.getByLabel('新的完整服务地址', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/draft`);
    const editor = storedForm.getByRole('region', { name: '编辑模型清单', exact: true });
    await button(editor, '编辑模型清单').click();
    const existing = editor.getByRole('region', { name: '从当前地址获取模型', exact: true });
    await existing.getByRole('combobox').selectOption('stored');
    await button(existing, '从当前地址获取模型').click();
    await existing.getByText(provider, { exact: true }).waitFor();
    await button(existing, '确认获取模型').click();
    await existing.getByText('没有可添加的新模型。', { exact: true }).waitFor();
    assert.equal(report.requests.length, 5);
    assert.deepEqual(report.requests.at(-1), { path: '/draft/models', authenticated: true });
    assert.equal(report.temporaryAuthenticationMatched, true);
    report.storedDraftDiscovery = true;
    await cleanupStored();
  } else { await button(creation, '取消').click(); creation = null; }
  }
  await button(panel, '关闭窗口').click();
  assert.equal(await chat.innerHTML(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (nativeOpen) try { await nativeButton('取消'); } catch {}
  try { await cleanupStored(); } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  if (creation) try { await button(creation, '取消').click(); } catch {}
  await writeFile(`artifacts/model-probe${cleanupOnly ? '-cleanup' : stored ? '-stored' : lifecycle ? '-lifecycle' : ''}-android.json`, JSON.stringify(report, null, 2));
  heldResponse?.destroy();
  await device.close(); await new Promise(resolve => server.close(resolve));
}
