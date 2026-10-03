import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 专用提供方仅使用本次生成的测试Key；不替换DSH结算或手机通知，不使用用户Key。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const limit = process.argv.includes('--limit');
const blocked = process.argv.includes('--blocked');
const killed = process.argv.includes('--killed');
const cleanupOnly = process.argv.includes('--cleanup');
const previous = cleanupOnly ? JSON.parse(await readFile('artifacts/killed-notification-live.json', 'utf8')) : null;
assert.ok(!(limit && blocked));
assert.ok(!killed || limit);
const expectedNotice = blocked ? '电脑任务受阻，请打开查看' : limit ? '电脑任务达到输出上限' : '电脑任务执行失败';
const id = previous ? previous.provider.slice(-8) : randomUUID().slice(0, 8), provider = `dshm-notice-error-${id}`, title = `DSHM 失败通知 ${id}`;
assert.match(id, /^[a-f0-9]{8}$/);
const report = { at: new Date().toISOString(), provider, title, outcome: blocked ? 'blocked' : limit ? 'max-tokens' : 'error', requests: [], errors: [] };
const marker = `DSHM_BLOCK_NOTICE_${id}`;
const blockControl = 'artifacts/blocked-notice-control.json', blockReport = 'artifacts/blocked-notice-host.json';
const testKey = 'dshmtest' + randomUUID().replaceAll('-', '');
let held, registered = false, created = false, page, main, originalDraft;
const server = createServer((req, res) => {
  report.requests.push({ method: req.method, path: req.url, authenticated: req.headers.authorization === `Bearer ${testKey}` });
  req.resume(); held = res;
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
const persist = () => writeFile(`artifacts/${killed ? 'killed' : blocked ? 'blocked' : limit ? 'limit' : 'error'}-notification-live.json`, JSON.stringify(report, null, 2));
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!await check() && Date.now() < end) await new Promise(r => setTimeout(r, 100));
  assert.ok(await check(), 'Expected live condition within deadline');
}
async function menu(name) { await button(main, 'Remote 选项').click(); await button(main, name).click(); }
async function nativeKey(root, remove = false) {
  const key = root.getByRole('region', { name: '电脑提供方 Key', exact: true });
  await button(key, '管理电脑 Key').click();
  const nodes = async () => {
    await device.shell('uiautomator dump /data/local/tmp/dshm-error-key.xml');
    const xml = (await device.shell('cat /data/local/tmp/dshm-error-key.xml')).toString();
    return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(v => [v[1], v[2]]))).filter(n => n.package === 'dev.dshmobile.validation');
  };
  const tap = async node => { assert.ok(node); const [a,b,c,d] = node.bounds.match(/\d+/g).map(Number); await device.shell(`input tap ${Math.floor((a+c)/2)} ${Math.floor((b+d)/2)}`); };
  const press = async label => { const matches = (await nodes()).filter(n => n.class === 'android.widget.Button' && n.text.toLowerCase() === label.toLowerCase()); assert.equal(matches.length, 1); await tap(matches[0]); };
  const tree = await nodes(); assert.ok(tree.some(n => n.text.includes(provider)));
  if (remove) { await press('移除电脑 Key'); await press('确认移除'); }
  else {
    await tap(tree.find(n => n.class === 'android.widget.EditText' && n.password === 'true'));
    assert.match(testKey, /^dshmtest[a-f0-9]{32}$/); await device.shell(`input text ${testKey}`); await press('保存到电脑');
  }
  await key.getByText(remove ? '尚未配置' : '已配置', { exact: true }).waitFor();
}
async function settings() {
  await menu('电脑设置');
  const panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const directory = panel.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click(); return { panel, directory };
}
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
  if (cleanupOnly) {
    main = page.getByTestId('remote-workspace');
    assert.equal(await main.locator('.remote-heading strong').innerText(), title);
    registered = previous.registered && !previous.providerRemoved;
    created = previous.created && !previous.archived;
    report.testKeySaved = previous.testKeySaved && !previous.testKeyRemoved;
    if (await button(main, '停止生成').isVisible()) await button(main, '停止生成').click();
  } else {
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  main = page.getByTestId('remote-workspace');
  await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  let heading = main.locator('.remote-heading strong');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  if (await heading.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示'); originalDraft = await editor.innerHTML();
  const { panel, directory } = await settings();
  const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
  await button(creation, '新增模型提供方').click();
  await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
  await creation.getByLabel('提供方标识', { exact: true }).fill(provider);
  await creation.getByLabel('显示名称（可选）', { exact: true }).fill(provider);
  await creation.getByLabel('服务地址', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
  await creation.getByLabel('模型 ID 1', { exact: true }).fill(provider);
  await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).check();
  report.registrationAttempted = true; await persist();
  await button(creation, '核对提供方').click(); await button(creation, '确认新增').click();
  await button(creation, '查看提供方设置').waitFor(); registered = true; report.registered = true; await persist();
  await nativeKey(creation); report.testKeySaved = true;
  await button(panel, '关闭窗口').click();
  await menu('新建聊天');
  await button(page.getByRole('dialog', { name: '选择工作区', exact: true }), 'DSH-TEST').click();
  await menu('重命名聊天');
  const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
  await rename.getByRole('textbox', { name: '聊天名称', exact: true }).fill(title);
  await button(rename, '保存名称').click(); await heading.getByText(title, { exact: true }).waitFor();
  created = true; report.created = true; await persist();
  await editor.click(); await main.getByRole('button', { name: /^选择模型，当前/ }).click();
  await button(page.getByRole('dialog', { name: '选择模型', exact: true }), provider).click();
  await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'hidden' });
  if (blocked) await writeFile(blockControl, JSON.stringify({ marker, release: false }), { flag: 'wx' });
  await editor.fill(blocked ? marker : 'DSHM 专用HTTP失败通知验证，不调用工具。');
  report.sendAttempted = true; await persist(); await button(main, '发送消息').click(); report.sent = true; await persist();
  if (blocked) await until(async () => { const value = await readFile(blockReport, 'utf8').then(JSON.parse).catch(() => null); return value?.marker === marker && value.entered; });
  else {
    await until(() => !!held);
    assert.equal(report.requests[0].path, '/v1/chat/completions'); assert.equal(report.requests[0].authenticated, true);
  }
  await device.shell('input keyevent KEYCODE_HOME');
  if (killed) {
    report.oldPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
    assert.match(report.oldPid, /^\d+$/);
    await device.shell('am force-stop dev.dshmobile.validation');
    report.termination = 'force-stop';
    await until(async () => !(await device.shell('pidof dev.dshmobile.validation')).toString().trim());
    report.processEndedBeforeResponse = true;
  }
  if (blocked) {
    await writeFile(blockControl, JSON.stringify({ marker, release: true }));
    await until(async () => { const value = await readFile(blockReport, 'utf8').then(JSON.parse); return value.marker === marker && value.rejected; });
    assert.equal(report.requests.length, 0); report.preStepRejected = true;
  } else if (limit) {
    const chunk = { id: `dshm-${id}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: provider,
      choices: [{ index: 0, delta: { role: 'assistant', content: 'DSHM_LIMIT_PARTIAL_OUTPUT' }, finish_reason: 'length' }] };
    held.writeHead(200, { 'content-type': 'text/event-stream' }).end(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`);
    report.lengthResponseReleased = true;
  } else {
    held.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { message: 'DSHM isolated endpoint failure', type: 'invalid_request_error' } }));
    report.httpErrorReleased = true;
  }
  const notices = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(s => s.includes('|dev.dshmobile.validation|') && s.includes('dshm.remote.notice.'));
  if (killed) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), '');
    assert.deepEqual(await notices(), []); report.noWakeOrNotification = true;
    await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
    await until(async () => /^\d+$/.test((await device.shell('pidof dev.dshmobile.validation')).toString().trim()));
    report.newPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
    assert.notEqual(report.newPid, report.oldPid);
    const context = (await (await androidAppWebView(device)).page()).context();
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click();
    const opened = context.waitForEvent('page', { predicate: p => p.url().startsWith('https://remote.dshm.invalid/') });
    await button(ordinary, 'Remote').click(); page = await opened;
    page.on('pageerror', () => report.errors.push('page-error'));
    main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
    const welcomeAgain = page.getByRole('dialog', { name: '内测声明', exact: true });
    if (await welcomeAgain.isVisible()) await button(welcomeAgain, '继续').click();
    await main.locator('button.remote-session-row').filter({ has: page.getByText(title, { exact: true }) }).click();
    heading = main.locator('.remote-heading strong');
    assert.deepEqual(await notices(), []); report.noHistoryNotificationReplay = true;
  } else {
  await until(async () => (await notices()).length > 0, 30000);
  await device.shell('cmd statusbar expand-notifications');
  let match;
  await until(async () => {
    await device.shell('uiautomator dump /data/local/tmp/dshm-error-notice.xml');
    const xml = (await device.shell('cat /data/local/tmp/dshm-error-notice.xml')).toString();
    const rows = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(v => [v[1], v[2]])));
    match = rows.find(n => n.package === 'com.android.systemui' && n.text === expectedNotice); return !!match;
  });
  report.notificationText = match.text;
  const [x1, y1, x2, y2] = match.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
  }
  await heading.getByText(title, { exact: true }).waitFor();
  await button(main, '停止生成').waitFor({ state: 'hidden' });
  report.openedCorrectChat = true;
  if (limit) {
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_LIMIT_PARTIAL_OUTPUT' }).waitFor();
    report.partialOutputPreserved = true;
  }
  assert.deepEqual(report.errors, []);
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (blocked) await writeFile(blockControl, JSON.stringify({ marker, release: true }));
  held?.end();
  try {
    await device.shell('cmd statusbar collapse');
    await device.shell('am start -W -n dev.dshmobile.validation/.ValidationActivity');
    if (created) {
      assert.equal(await main.locator('.remote-heading strong').innerText(), title);
      await button(main, '停止生成').waitFor({ state: 'hidden', timeout: 30000 });
      await menu('归档聊天'); report.archived = true;
      await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    }
    if (registered) {
      if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
      const { panel, directory } = await settings();
      const picker = directory.getByRole('combobox', { name: '模型提供方', exact: true }); await picker.selectOption(provider);
      if (report.testKeySaved) { await nativeKey(directory, true); report.testKeyRemoved = true; }
      const removal = directory.getByRole('region', { name: '移除提供方', exact: true });
      await button(removal, '移除提供方').click(); await button(removal, '确认移除').click();
      await picker.locator(`option[value="${provider}"]`).waitFor({ state: 'detached' });
      report.providerRemoved = true; await button(panel, '关闭窗口').click();
    }
    if (originalDraft !== undefined) { assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerHTML(), originalDraft); report.draftPreserved = true; }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (blocked) await unlink(blockControl).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await persist(); console.log(JSON.stringify(report)); await device.close();
}
