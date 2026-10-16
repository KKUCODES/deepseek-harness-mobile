import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { androidAppWebView } from './android-app-webview.mjs';

const root = resolve(import.meta.dirname, '..');
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.equal(serial, '127.0.0.1:16384');
const adbPath = process.env.DSHM_ADB_PATH;
assert.ok(adbPath);
const pkg = 'dev.dshmobile.validation.toolstyletest';
const output = resolve(root, 'artifacts/ordinary-providers-android', randomUUID());
await mkdir(output, { recursive: true });
const run = promisify(execFile);
const adb = async (...args) => (await run(adbPath, ['-s', serial, ...args], { cwd: root, windowsHide: true, timeout: 120000 })).stdout;
const device = (await _android.devices({ omitDriverInstall: true })).find(device => device.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
const marker = `供应商验收-${Date.now()}`;
const legacyId = `providers-test-${randomUUID()}`;
const report = { startedAt: new Date().toISOString(), packageName: pkg, marker, environment: 'MuMu Android; actual mobile.html and production native bridge. Disposable invalid Key only; no real model credentials.', stages: [] };
let page, providerId, glmId, baseline, defaultBefore;
async function testKey(path, name) {
  const text = (await readFile(resolve(path), 'utf8')).trim();
  if (/^[A-Za-z0-9._-]{8,512}$/.test(text) && name === 'deepseek') return text;
  const values = text.split(/\r?\n/).filter(line => new RegExp(`^\\s*${name}\\s*[:：=]`, 'i').test(line));
  if (values.length !== 1) throw new Error('test_key_label_missing_or_ambiguous');
  const value = values[0].replace(new RegExp(`^\\s*${name}\\s*[:：=]\\s*`, 'i'), '').trim();
  if (!/^[A-Za-z0-9._-]{8,512}$/.test(value)) throw new Error('invalid_test_key_format');
  return value;
}
const readRows = () => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
  try { return await new Promise((resolve, reject) => { const r = db.transaction('chats').objectStore('chats').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject; }); }
  finally { db.close(); }
});
// 从已挂载页面取得真实会话服务；不覆盖全局原生回调或增加生产测试后门。
const call = (op, data = {}) => page.evaluate(async ({ op, data }) => {
  const element = document.querySelector('main');
  let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
  let session;
  while (fiber && !session) {
    let hook = fiber.memoizedState;
    while (hook) { if (typeof hook.memoizedState?.getSnapshot === 'function' && typeof hook.memoizedState?.preferences === 'function') { session = hook.memoizedState; break; } hook = hook.next; }
    fiber = fiber.return;
  }
  if (!session) throw new Error('Actual ordinary session unavailable');
  if (op === 'providers.list') return { providers: session.getSnapshot().providers, default: session.getSnapshot().defaultSelection };
  if (op === 'providers.save') return session.saveProvider(data);
  if (op === 'providers.default') return session.setDefaultSelection(data);
  if (op === 'providers.remove') return session.removeProvider({ id: data.provider, revision: data.revision });
  if (op === 'test.preferences') return session.preferences(data);
  if (op === 'test.turn') return session.getSnapshot().chat?.turns.find(turn => turn.prompt.endsWith(data.answer));
  throw new Error('Unsupported verification operation');
}, { op, data });
async function start() {
  await adb('shell', 'am', 'start', '-W', '-n', `${pkg}/dev.dshmobile.validation.ValidationActivity`);
  page = await (await androidAppWebView(device, pkg)).page();
  page.setDefaultTimeout(15000);
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
}
async function settings() {
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^普通聊天/ }).click();
}
async function providerPage() { await settings(); await page.getByRole('button', { name: /^管理供应商与模型/ }).click(); }
async function leaveProviders() {
  for (const name of ['返回模型服务', '返回普通聊天设置', '返回设置首页', '退出设置']) await page.getByRole('button', { name, exact: true }).click();
}
async function realReply(answer, maxTokens, provider) {
  await call('test.preferences', { requestOptions: { maxTokens, reasoningEffort: 'low' } });
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(`请只回复这段文字，不加其他内容：${answer}`);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const deadline = Date.now() + 100000;
  let actual;
  do {
    actual = await call('test.turn', { answer });
    if (actual && !['sending', 'streaming'].includes(actual.status)) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  } while (Date.now() < deadline);
  report.lastReply = { provider, status: actual?.status, error: actual?.error, finishReason: actual?.finishReason, content: actual?.content?.slice(0, 500), reasoningLength: actual?.reasoning?.length };
  assert.equal(actual?.status, 'completed'); assert.ok(actual.content.includes(answer), 'Expected reply marker in actual model content');
  await page.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: answer }).waitFor();
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor({ timeout: 100000 });
  assert.equal(actual.provider, provider); assert.equal(actual.requestOptions.maxTokens, maxTokens);
}
async function configureKey(value = 'fixture-only-not-a-valid-api-key') {
  if (!/^[A-Za-z0-9._-]{8,512}$/.test(value)) throw new Error('invalid_test_key_format');
  await page.getByRole('button', { name: /^(配置|管理) Key$/ }).click();
  const boundsOf = async selector => {
    await adb('shell', 'uiautomator', 'dump', '/sdcard/dshm-providers-window.xml');
    const xml = await adb('shell', 'cat', '/sdcard/dshm-providers-window.xml');
    assert.ok(xml.includes(pkg) && xml.includes(marker) && xml.includes('API Key'));
    const node = xml.match(new RegExp(`<node[^>]*${selector}[^>]*>`))?.[0];
    const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    assert.ok(bounds, 'Expected own native dialog control');
    return [String(Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2)), String(Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2))];
  };
  await adb('shell', 'input', 'tap', ...await boundsOf('class="android.widget.EditText"'));
  // 输入前定位按钮；密码字段有内容时不转储界面。Key 通过 stdin 传输，不出现在主机命令参数或错误日志。
  const save = await boundsOf('resource-id="android:id/button1"');
  await new Promise((resolve, reject) => {
    const child = spawn(adbPath, ['-s', serial, 'shell', '-T'], { cwd: root, windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => reject(new Error('credential_input_failed')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('credential_input_failed')));
    child.stdin.end(`input text '${value}'\nexit\n`);
  });
  await adb('shell', 'input', 'tap', ...save);
  await page.getByRole('button', { name: '管理 Key', exact: true }).waitFor();
}
try {
  await adb('shell', 'am', 'force-stop', pkg); await start();
  const cleanupReport = process.argv.indexOf('--cleanup-report');
  if (cleanupReport >= 0) {
    const path = resolve(process.argv[cleanupReport + 1]);
    assert.ok(path.startsWith(resolve(root, 'artifacts/ordinary-providers-android') + '\\'));
    const previous = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(previous.packageName, pkg); assert.ok(previous.marker.startsWith('供应商验收-'));
    const catalog = await call('providers.list');
    const owned = catalog.providers.find(provider => provider.name === previous.marker);
    if (owned) await call('providers.remove', { provider: owned.id, revision: owned.revision });
    await page.evaluate(async marker => {
      const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
      const tx = db.transaction('chats', 'readwrite'), store = tx.objectStore('chats');
      store.openCursor().onsuccess = event => { const c = event.target.result; if (!c) return; if (c.value.title === marker && c.value.turns[0]?.content === '旧回复保留') c.delete(); c.continue(); };
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = reject; }); db.close();
    }, previous.marker);
  }
  baseline = await readRows();
  const before = await call('providers.list'); defaultBefore = before.default;
  report.originalConfigured = before.providers.find(provider => provider.id === 'deepseek').configured;
  await page.evaluate(async ({ legacyId, marker }) => {
    const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction('chats', 'readwrite');
    tx.objectStore('chats').put({ id: legacyId, mode: 'ordinary', title: marker, draft: '旧版草稿保留', updatedAt: Date.now(),
      turns: [{ requestId: 'legacy-request', model: 'deepseek-v4-pro', prompt: '旧问题', content: '旧回复保留', reasoning: '', status: 'completed', error: null }] });
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = reject; }); db.close();
  }, { legacyId, marker });
  await page.reload(); await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await providerPage();
  await page.getByRole('button', { name: '添加供应商', exact: true }).click();
  await page.getByLabel('供应商名称', { exact: true }).fill(marker);
  await page.getByLabel('API 地址', { exact: true }).fill('https://api.deepseek.com');
  await page.getByLabel('模型 ID', { exact: true }).fill('deepseek-flash');
  await page.getByLabel('显示名称', { exact: true }).fill('自定义 Flash');
  await page.getByText('兼容设置', { exact: true }).click();
  await page.getByLabel('思考参数').selectOption('thinking');
  await page.getByRole('button', { name: '添加模型', exact: true }).click();
  const secondModel = page.locator('fieldset.provider-model').nth(1);
  await secondModel.getByLabel('模型 ID', { exact: true }).fill('test/second-model');
  await secondModel.getByLabel('显示名称', { exact: true }).fill('待编辑模型');
  await writeFile(resolve(output, 'provider-editor.png'), await device.screenshot());
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(marker) }).waitFor();
  let catalog = await call('providers.list');
  const provider = catalog.providers.find(provider => provider.name === marker); providerId = provider.id;
  assert.equal(provider.models[0].id, 'deepseek-flash');
  assert.equal(provider.models.length, 2);
  await page.getByRole('button', { name: new RegExp(marker) }).click();
  await secondModel.getByLabel('显示名称', { exact: true }).fill('已编辑模型');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(marker) }).click();
  assert.equal(await secondModel.getByLabel('显示名称', { exact: true }).inputValue(), '已编辑模型');
  await secondModel.getByRole('button', { name: '移除模型', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(marker) }).click();
  const edited = (await call('providers.list')).providers.find(provider => provider.id === providerId);
  assert.equal(edited.models.length, 1);
  report.stages.push('actual form: add two models, edit model label, persist and remove model');
  await configureKey();
  assert.equal(await page.getByLabel('API 地址', { exact: true }).isDisabled(), true);
  await assert.rejects(call('providers.save', { id: providerId, revision: edited.revision, name: marker, baseURL: 'https://other.example.com/v1', models: edited.models }), /provider_endpoint_locked/);
  report.stages.push('actual provider form save; native password dialog; endpoint lock');
  await page.getByRole('button', { name: '返回模型服务', exact: true }).click();
  await page.getByRole('button', { name: '返回普通聊天设置', exact: true }).click();
  await page.getByRole('button', { name: /^默认模型/ }).click();
  await page.getByRole('button', { name: /^自定义 Flash/ }).click();
  await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await page.getByRole('button', { name: '退出设置', exact: true }).click();
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(`${marker} 无效测试凭据应拒绝，不调用真实模型`);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByText('Key 无效或已失效，请重新配置。', { exact: true }).waitFor({ timeout: 100000 });
  const sent = (await readRows()).find(row => row.turns.some(turn => turn.prompt.includes(marker)));
  assert.equal(sent.provider, providerId); assert.equal(sent.turns.at(-1).provider, providerId);
  assert.equal(sent.turns.at(-1).error, 'http_401');
  report.stages.push('real HTTPS Chat Completions request with disposable invalid Key rejected as HTTP 401; no paid model reply');
  if (process.env.DSHM_DEEPSEEK_TEST_KEY_FILE) {
    await providerPage(); await page.getByRole('button', { name: new RegExp(marker) }).click();
    await configureKey(await testKey(process.env.DSHM_DEEPSEEK_TEST_KEY_FILE, 'deepseek'));
    await leaveProviders();
    const answer = `DSHM_PROVIDER_OK_${Date.now()}`;
    await realReply(answer, 128, providerId);
    report.realReplyReceived = true;
    report.environment = 'MuMu Android; actual ordinary UI, custom provider, native encrypted Key and official DeepSeek HTTPS Chat Completions. User-authorized external test Key; never logged or exported.';
    report.stages.push('user-authorized DeepSeek Key: real streamed reply, exact answer marker and completed terminal state under custom provider');
    await writeFile(resolve(output, 'real-custom-reply.png'), await device.screenshot());
  }
  if (process.env.DSHM_GLM_TEST_KEY_FILE || process.argv.includes('--check-glm-form')) {
    await providerPage(); await page.getByRole('button', { name: '添加供应商', exact: true }).click();
    await page.getByLabel('API 地址', { exact: true }).fill('https://open.bigmodel.cn/api/paas/v4');
    await page.getByLabel('供应商名称', { exact: true }).fill(`${marker}-GLM`);
    await page.getByLabel('模型 ID', { exact: true }).fill('glm-5.3');
    await page.getByLabel('显示名称', { exact: true }).fill('GLM 官方验收');
    await page.getByText('兼容设置', { exact: true }).click();
    await page.getByLabel('思考参数').selectOption('reasoning_effort');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`${marker}-GLM`) }).waitFor();
    glmId = (await call('providers.list')).providers.find(provider => provider.name === `${marker}-GLM`).id;
    await page.getByRole('button', { name: new RegExp(`${marker}-GLM`) }).click();
    await configureKey(process.env.DSHM_GLM_TEST_KEY_FILE ? await testKey(process.env.DSHM_GLM_TEST_KEY_FILE, 'glm') : undefined);
    await leaveProviders();
    report.stages.push('generic add-provider form saves official GLM base URL, model and reasoning_effort; native Key dialog works');
    if (process.env.DSHM_GLM_TEST_KEY_FILE) {
      await page.getByRole('button', { name: '新聊天', exact: true }).click();
      await page.getByRole('textbox', { name: '消息', exact: true }).fill('GLM 验收');
      await page.getByRole('button', { name: /^选择模型，当前/ }).click();
      await page.getByRole('button', { name: /^GLM 官方验收/ }).click();
      await call('test.preferences', { thinking: true, requestOptions: { reasoningEffort: 'low' } });
      await realReply(`DSHM_GLM_OK_${Date.now()}`, 2048, glmId);
      await writeFile(resolve(output, 'real-glm-reply.png'), await device.screenshot());
      report.stages.push('generic provider form and native Key: real official GLM streamed response with reasoning_effort; independent provider/model persisted');
      report.glmReplyReceived = true;
      if (process.env.DSHM_DEEPSEEK_TEST_KEY_FILE) {
        await page.getByRole('textbox', { name: '消息', exact: true }).fill('切回 DeepSeek');
        await page.getByRole('button', { name: /^选择模型，当前/ }).click();
        await page.getByRole('button', { name: /^自定义 Flash/ }).click();
        await realReply(`DSHM_SWITCH_BACK_OK_${Date.now()}`, 128, providerId);
        report.stages.push('same chat switched from GLM back to DeepSeek; independent encrypted Keys still work');
      }
      report.environment = 'MuMu Android; actual ordinary UI and native encrypted Keys, real official DeepSeek and GLM HTTPS streams. User-authorized external test credentials; never logged or exported.';
    }
  }
  await adb('shell', 'am', 'force-stop', pkg); await start();
  catalog = await call('providers.list'); assert.equal(catalog.default.provider, providerId);
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('默认模型保留');
  await page.getByRole('button', { name: /选择模型，当前 自定义 Flash/ }).waitFor();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: `${marker} 草稿`, exact: true }).click();
  await page.getByText('旧回复保留', { exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '旧版草稿保留');
  report.stages.push('process restart preserves provider default and legacy model/content/draft');
  await providerPage(); await page.getByRole('button', { name: new RegExp(`${marker}(?!-GLM)`) }).click();
  await writeFile(resolve(output, 'provider-configured.png'), await device.screenshot());
  await page.getByRole('button', { name: '删除供应商', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('button', { name: '添加供应商', exact: true }).waitFor();
  assert.equal((await call('providers.list')).providers.some(provider => provider.id === providerId), false);
  assert.equal((await readRows()).find(row => row.id === sent.id).turns[0].error, 'http_401');
  for (const name of ['返回普通聊天设置', '返回设置首页', '退出设置']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: `${marker} 无效测试凭据应拒绝，不调用真实模型`, exact: true }).click();
  await page.getByRole('status').filter({ hasText: '原供应商或模型已移除，请重新选择模型。' }).waitFor();
  report.stages.push('UI delete removes only provider and Key; retained chat opens with explicit missing-provider prompt');
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally {
  try {
    if (page) {
      await adb('shell', 'am', 'force-stop', pkg); await start();
      const catalog = await call('providers.list');
      for (const id of [providerId, glmId]) {
        const current = catalog.providers.find(provider => provider.id === id);
        if (current) await call('providers.remove', { provider: current.id, revision: current.revision });
      }
      if (defaultBefore) await call('providers.default', defaultBefore);
      const rows = await readRows();
      const own = rows.filter(row => row.id === legacyId || providerId && row.provider === providerId || glmId && row.provider === glmId || row.turns.some(turn => turn.prompt?.includes(marker)));
      await page.evaluate(async ids => {
        const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
        const tx = db.transaction('chats', 'readwrite'); ids.forEach(id => tx.objectStore('chats').delete(id));
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = reject; }); db.close();
      }, own.map(row => row.id));
      const remaining = await readRows();
      for (const row of baseline ?? []) assert.deepEqual(remaining.find(value => value.id === row.id), row);
      report.cleanup = { ownChatsRemoved: own.length, originalRowsUnchanged: true, originalKeyStateUnchanged: (await call('providers.list')).providers[0].configured === report.originalConfigured };
    }
  } catch (error) { report.cleanupError = error.message; report.passed = false; process.exitCode = 1; }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await adb('shell', 'rm', '-f', '/sdcard/dshm-providers-window.xml');
  console.log(JSON.stringify({ output, ...report }));
  await device.close();
}
