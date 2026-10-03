import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 测试端点仅提供明确的无认证模型列表，生产App、网关、DSH与解析器均不替换。
const phase = process.argv[2] ?? 'blocked';
const verifyProtocol = process.argv.includes('--protocol');
const verifyKey = process.argv.includes('--key');
const verifyCards = process.argv.includes('--cards');
const verifyDirectory = process.argv.includes('--directory-regression');
assert.ok(!verifyCards || verifyKey, 'Card refresh verification uses the isolated credential lifecycle');
assert.ok(!(verifyKey && verifyProtocol));
assert.ok(!verifyDirectory || (!verifyKey && !verifyProtocol && !verifyCards));
const artifactPrefix = verifyDirectory ? 'provider-directory-own-management' : verifyCards ? 'provider-card-state' : verifyKey ? 'provider-key-http' : verifyProtocol ? 'provider-protocol' : 'model-http-discovery';
assert.ok(['run', 'cleanup', 'blocked'].includes(phase));
if (phase !== 'blocked') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = `artifacts/${artifactPrefix}-live-seed.json`;
const report = { at: new Date().toISOString(), phase, stage: 'connect', checks: [], requests: [], errors: [], resources: [] };
let server, mode = 'fail', held, seed, page, main, dialog, directory, picker, models;
let testKey, nativeOpen = false;
const button = (root, name) => root.getByRole('button', { name, exact: true });
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const listing = { data: [{ id: 'initial-model', name: 'Initial' },
  { id: 'dshm-http-model', name: 'DSHM HTTP 发现模型', context_window: 128000, max_tokens: 8000 }] };
async function waitFor(predicate, message) {
  const end = Date.now() + 8000;
  while (!predicate() && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(predicate(), message);
}
async function openSettings() {
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
}
async function openDirectory() {
  directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
  await button(directory, '新增模型提供方').waitFor();
}
async function selectRoute() {
  await picker.locator(`option[value="${seed.provider}"]`).waitFor({ state: 'attached' });
  await picker.selectOption(seed.provider);
  const form = directory.locator('.remote-provider-form');
  await form.getByLabel('提供方名称', { exact: true }).waitFor();
  assert.equal(await form.getByLabel('提供方名称', { exact: true }).inputValue(), seed.name);
  models = form.getByRole('region', { name: '编辑模型清单', exact: true });
}
async function openModels() {
  await button(models, '编辑模型清单').click();
  await models.getByRole('textbox', { name: '模型 ID 1', exact: true }).waitFor();
}
async function verifyCard(root, configured, keyConfigured) {
  const card = root.locator(`[data-testid="live-provider-card"][data-provider="${seed.provider}"][data-configured="${configured}"][data-key="${keyConfigured}"]`);
  await card.waitFor();
  assert.equal(await card.getAttribute('data-session'), 'none');
  assert.equal(await card.getAttribute('data-namespace'), 'llm-pi-ai');
  assert.equal(await card.getAttribute('data-path'), JSON.stringify(['providers', seed.provider]));
  return card;
}
async function nativeKey(action) {
  const key = directory.getByRole('region', { name: '电脑提供方 Key', exact: true });
  await button(key, '管理电脑 Key').click(); nativeOpen = true;
  const nodes = async () => {
    await device.shell('uiautomator dump /data/local/tmp/dshm-key-http.xml');
    const xml = (await device.shell('cat /data/local/tmp/dshm-key-http.xml')).toString();
    const rows = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
      .filter(node => node.package === 'dev.dshmobile.validation');
    assert.ok(rows.some(node => node.text?.includes(seed.provider)), 'Only the newly created provider may receive a test credential');
    return rows;
  };
  const tap = async label => {
    const rows = (await nodes()).filter(node => node.text?.toLocaleLowerCase() === label.toLocaleLowerCase() && node.class === 'android.widget.Button');
    assert.equal(rows.length, 1, `Expected native button: ${label}`);
    const [x1, y1, x2, y2] = rows[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
  };
  assert.ok((await nodes()).some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  if (action === 'set') {
    const inputs = (await nodes()).filter(node => node.class === 'android.widget.EditText' && node.password === 'true');
    assert.equal(inputs.length, 1); assert.match(testKey, /^dshmtest[a-f0-9]{32}$/);
    const [x1, y1, x2, y2] = inputs[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
    // 只输入本进程生成的字母数字测试值；不读取或通过页面传递用户密钥。
    await device.shell(`input text ${testKey}`);
    await tap('保存到电脑');
  } else {
    await tap('移除电脑 Key'); await tap('确认移除');
  }
  await key.getByText(action === 'set' ? '已配置' : '尚未配置', { exact: true }).waitFor();
  nativeOpen = false; seed.keyConfigured = action === 'set'; await persist();
  if (verifyCards && phase === 'run') {
    await verifyCard(directory, true, action === 'set');
    report.checks.push(`Card credential state updated without reopening or manual refresh: ${action}`);
  }
  // 只检查这枚生成的测试值，不遍历用户凭据存储。
  assert.equal((await page.locator('body').innerText()).includes(testKey), false);
}
async function cleanup() {
  assert.match(seed?.provider ?? '', /^dshm-http-discovery-[a-f0-9]{8}$/);
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  await openSettings(); await openDirectory(); await selectRoute();
  if (verifyKey && seed.keyEnabled) {
    const key = directory.getByRole('region', { name: '电脑提供方 Key', exact: true });
    await button(key, '重新读取 Key 状态').click();
    await key.getByText(/^(已配置|尚未配置)$/).waitFor();
    if (await key.getByText('已配置', { exact: true }).count()) await nativeKey('unset');
  }
  const removal = directory.getByRole('region', { name: '移除提供方', exact: true });
  await button(removal, '移除提供方').click();
  await removal.getByText(`(${seed.provider})`, { exact: true }).waitFor();
  await button(removal, '确认移除').click();
  await picker.locator(`option[value="${seed.provider}"]`).waitFor({ state: 'detached' });
  seed.cleaned = true; await persist(); report.cleaned = true;
}
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click();
    const opened = first.context().waitForEvent('page'); await button(ordinary, 'Remote').click(); await opened;
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  if (await button(page, '关闭窗口').isVisible()) await button(page, '关闭窗口').click();
  const editor = main.getByRole('textbox', { name: '消息', exact: true }), draft = await editor.textContent();
  if (phase === 'blocked') {
    await openSettings();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    report.checks.push('Management withdrawn; settings denied and chat retained');
  } else {
    const previous = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (phase === 'cleanup') { seed = previous; report.stage = 'cleanup'; await cleanup(); }
    else {
      assert.ok(!previous || previous.cleaned, 'Previous route needs explicit cleanup');
      server = createServer((req, res) => {
        const event = { method: req.method, path: req.url, mode, authorizationPresent: !!(req.headers.authorization || req.headers['x-api-key']),
          anthropicVersionPresent: !!req.headers['anthropic-version'], closed: false };
        if (verifyKey) event.testAuthorizationMatches = req.headers.authorization === `Bearer ${testKey}`;
        report.requests.push(event);
        res.on('close', () => { event.closed = true; });
        if (req.method !== 'GET' || !['/v1/models', '/v1/models?limit=1000'].includes(req.url)) { res.writeHead(404).end(); return; }
        if (verifyKey && !event.testAuthorizationMatches) { res.writeHead(401).end(); return; }
        if (mode === 'hold') { held = { res, event }; return; }
        if (mode === 'fail') { res.writeHead(503).end('DSHM_UPSTREAM_BODY_NOT_FOR_UI'); return; }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(listing));
      });
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      const port = server.address().port;
      if (verifyKey) testKey = `dshmtest${randomUUID().replaceAll('-', '')}`;
      seed = { provider: `dshm-http-discovery-${randomUUID().slice(0, 8)}`, name: 'DSHM HTTP 目录验收', port, cleaned: false, at: report.at };
      await persist(); await openSettings(); await openDirectory(); report.stage = 'create';
      const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
      await button(creation, '新增模型提供方').click();
      await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
      await creation.getByRole('textbox', { name: '提供方标识', exact: true }).fill(seed.provider);
      await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
      await creation.getByRole('textbox', { name: '服务地址', exact: true }).fill(`http://127.0.0.1:${port}/v1`);
      await creation.getByRole('textbox', { name: '模型 ID（每行一个）', exact: true }).fill('initial-model');
      await creation.getByRole('textbox', { name: '显示名称（可选）', exact: true }).fill(seed.name);
      await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
      if (verifyCards) assert.equal(await creation.getByTestId('live-provider-card').count(), 0, 'Unsaved custom routes have no original directory row');
      await button(creation, '核对提供方').click(); await button(creation, '确认新增').click();
      await creation.getByRole('status').filter({ hasText: '已保存' }).waitFor();
      if (verifyCards) {
        await verifyCard(creation, true, false);
        report.checks.push('Custom draft has no card; saved custom provider renders original configured directory owner');
      }
      await button(creation, '查看提供方设置').click();
      if (verifyCards) {
        await verifyCard(directory, true, false);
        await button(dialog, '关闭窗口').click(); await openSettings(); await openDirectory(); await selectRoute();
        await verifyCard(directory, true, false);
        report.checks.push('Existing provider entry retains the same original card owner after reopening settings');
      }
      models = directory.getByRole('region', { name: '编辑模型清单', exact: true }); await openModels();
      if (verifyKey) {
        report.stage = 'native-key-save'; mode = 'success';
        const setup = directory.getByRole('region', { name: '启用提供方 API Key', exact: true });
        await button(setup, '启用 API Key').click();
        seed.keyEnabled = true; await persist();
        await button(setup, '确认启用 API Key').click();
        await nativeKey('set');
        await button(models, '获取可用模型').click();
        await models.getByRole('group', { name: '可用模型', exact: true }).waitFor();
        assert.equal(report.requests.length, 1); assert.equal(report.requests[0].testAuthorizationMatches, true);
        report.checks.push('Native test credential saved to the isolated computer provider and used by its real HTTP discovery request');
        report.stage = 'native-key-remove'; await nativeKey('unset');
        await button(models, '获取可用模型').click();
        await models.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
        assert.ok(report.requests.slice(1).every(item => !item.authorizationPresent));
        report.checks.push('Native removal returns unconfigured state; discovery cannot reuse the removed credential');
        seed.keyEnabled = false; await persist();
        if (verifyCards) {
          const form = directory.locator('.remote-provider-form');
          await button(form, '重新读取设置').click();
          const name = form.getByRole('textbox', { name: '提供方名称', exact: true }); await name.waitFor();
          seed.name = 'DSHM 卡片更新验收'; await persist(); await name.fill(seed.name);
          await button(form, '保存到电脑').click();
          const card = await verifyCard(directory, true, false);
          await card.getByText(`${seed.name} · 已配置 · 未保存Key`, { exact: true }).waitFor();
          report.checks.push('Saved provider display name reaches the plugin card without reopening or manual refresh');
          await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/provider-card-state-updated-android.png' });
        }
      } else {
      report.stage = 'http-failure';
      await button(models, '获取可用模型').click();
      await models.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
      assert.doesNotMatch(await models.innerText(), /DSHM_UPSTREAM_BODY_NOT_FOR_UI|127\.0\.0\.1/);
      assert.equal(await models.locator('.remote-provider-model-row').count(), 1);
      assert.equal(report.requests.length, 1); report.checks.push('HTTP failure shows sanitized retryable message and preserves model rows');
      report.stage = 'cancel-http'; mode = 'hold';
      await button(models, '获取可用模型').click();
      await waitFor(() => !!held, 'DSH must issue the held HTTP request');
      await button(dialog, '关闭窗口').click();
      await waitFor(() => held.event.closed, 'Closing settings must abort the pending HTTP discovery');
      report.checks.push('Closing the settings page cancels the real pending computer HTTP request');
      mode = 'success'; await openSettings(); await openDirectory(); await selectRoute(); await openModels();
      report.stage = 'retry-adopt'; await button(models, '获取可用模型').click();
      const candidates = models.getByRole('group', { name: '可用模型', exact: true }); await candidates.waitFor();
      assert.equal(await candidates.getByRole('checkbox').count(), 1, 'Existing model ID must not be offered again');
      await candidates.getByRole('checkbox', { name: 'DSHM HTTP 发现模型 · dshm-http-model', exact: true }).check();
      await button(candidates, '加入编辑草稿').click();
      const field = name => models.getByRole('textbox', { name: `${name} 2`, exact: true });
      assert.equal(await field('模型 ID').inputValue(), 'dshm-http-model');
      assert.equal(await field('模型名称').inputValue(), 'DSHM HTTP 发现模型');
      assert.equal(await field('上下文容量（Token）').inputValue(), '128K');
      assert.equal(await field('输出容量（Token）').inputValue(), '8K');
      report.stage = 'save'; await button(models, '保存模型清单').click();
      await models.getByRole('status').getByText('已保存到电脑。', { exact: true }).waitFor();
      await button(models, '重新读取模型清单').click(); await field('模型 ID').waitFor();
      assert.equal(await field('模型 ID').inputValue(), 'dshm-http-model');
      assert.equal(await field('上下文容量（Token）').inputValue(), '128K');
      assert.equal(await models.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(), 'initial-model');
      await button(models, '获取可用模型').click();
      await models.getByText('没有可添加的新模型。', { exact: true }).waitFor();
      report.checks.push('Retry discovers real HTTP metadata, deduplicates existing IDs, saves and rereads on computer');
      assert.equal(report.requests.length, 4);
      assert.ok(report.requests.every(item => item.method === 'GET' && item.path === '/v1/models' && !item.authorizationPresent));
      if (verifyProtocol) {
        report.stage = 'protocol-change';
        const form = directory.locator('.remote-provider-form');
        const protocol = form.getByRole('combobox', { name: '服务协议', exact: true });
        // 模型保存已经推进原设置版本，先重新读取标量表单。
        await button(form, '重新读取设置').click(); await protocol.waitFor();
        assert.equal(await protocol.inputValue(), 'openai-completions');
        await protocol.selectOption('anthropic-messages');
        await button(form, '保存到电脑').click();
        const confirmation = form.getByRole('group', { name: '确认服务协议更改', exact: true });
        await confirmation.waitFor(); await button(confirmation, '取消').click();
        await button(form, '重新读取设置').click(); await protocol.waitFor();
        assert.equal(await protocol.inputValue(), 'openai-completions');
        assert.equal(report.requests.length, 4);
        report.checks.push('Cancel protocol confirmation leaves actual computer protocol unchanged and sends no model/discovery request');
        await protocol.selectOption('anthropic-messages'); await button(form, '保存到电脑').click();
        await button(confirmation, '确认保存协议').click();
        await form.locator(':scope > [role="status"]').getByText('已保存到电脑。', { exact: true }).waitFor();
        await button(form, '重新读取设置').click(); await protocol.waitFor();
        assert.equal(await protocol.inputValue(), 'anthropic-messages');
        await button(models, '获取可用模型').click();
        await models.getByText('没有可添加的新模型。', { exact: true }).waitFor();
        assert.equal(report.requests.length, 5);
        assert.deepEqual(report.requests.slice(-1).map(({method,path,authorizationPresent,anthropicVersionPresent}) =>
          ({method,path,authorizationPresent,anthropicVersionPresent})), [{method:'GET',path:'/v1/models?limit=1000',authorizationPresent:false,anthropicVersionPresent:true}]);
        // Android WebView不支持可靠地拼接超长元素截图，只记录当前可见协议控件。
        await protocol.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `artifacts/${artifactPrefix}-saved-android.png` });
        assert.equal(await field('模型 ID').inputValue(), 'dshm-http-model');
        assert.equal(await field('上下文容量（Token）').inputValue(), '128K');
        report.checks.push('Confirmed protocol saved and reread; real DSH discovery changes URL/header to Anthropic while model rows and capacity remain');
        await protocol.selectOption('openai-completions'); await button(form, '保存到电脑').click();
        await button(confirmation, '确认保存协议').click();
        await form.locator(':scope > [role="status"]').getByText('已保存到电脑。', { exact: true }).waitFor();
        await button(models, '获取可用模型').click();
        await models.getByText('没有可添加的新模型。', { exact: true }).waitFor();
        assert.equal(report.requests.length, 6);
        assert.equal(report.requests[5].path, '/v1/models'); assert.equal(report.requests[5].anthropicVersionPresent, false);
        report.checks.push('Switching back restores OpenAI discovery on the same service address');
      }
      }
      report.stage = 'cleanup'; await cleanup();
    }
  }
  await button(dialog, '关闭窗口').click();
  assert.equal(await editor.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.stage = 'complete';
} catch (error) { report.failure = error.stack; if (seed && !seed.cleaned) report.cleanupRequired = seed.provider; process.exitCode = 1; }
finally {
  if (nativeOpen) await device.shell('input keyevent 4').catch(() => {});
  if (verifyKey) await device.shell('rm -f /data/local/tmp/dshm-key-http.xml').catch(() => {});
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await writeFile(`artifacts/${artifactPrefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
