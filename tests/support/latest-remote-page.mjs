import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { verifyLockedPreset, verifyBlankPreset, verifyPresetDefault, verifyPresetDirectory, verifyPresetManagement, verifyCodingTools, verifyPresetCreator } from './latest-agent-preset-page.mjs';
import { verifyProviderManagement } from './latest-provider-page.mjs';
import { verifyModelCatalogManagement } from './latest-model-catalog-page.mjs';
import { verifyFileRefresh } from './latest-file-page.mjs';

/** 真实 RemoteApp + 真实已认证 socket；浏览器桥仅替代 Android 载体，不替代 Host 或模型。 */
export async function verifyLatestRemotePage({ socket, ready, binding, title, marker, nextModel, shellValue, verifyShell, mutateShellOnDesktop, mutateCordis, preset, verifyPreset, verifyDefault, verifyManagement, verifyCoding, verifyCreator, verifyProvider, verifyCatalog, verifyFiles }) {
  const root = resolve(import.meta.dirname, '../..'), dist = resolve(root, 'artifacts/latest-mobile-dist');
  const evidence = resolve(root, 'artifacts/latest-mobile-runtime');
  await mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.setDefaultTimeout(15000);
  const report = { environment: 'Headless Edge 375x667, Android bridge transport seam; actual latest Host and relay',
    pageErrors: [], consoleErrors: [], resources: [], bridgeCalls: [], fixedSettingsCalls: [], fixedErrors: [], codingToolsResults: [] };
  const resources = new Map();
  const codingRequests = new Set();
  let active = true;
  const receive = raw => {
    const frame = JSON.parse(raw.toString()), resource = resources.get(frame.id);
    if (codingRequests.has(frame.id) && frame.type === 'result') report.codingToolsResults.push(frame.value);
    if (frame.type === 'error') report.fixedErrors.push(frame.code);
    if (resource) {
      if (frame.type === 'event' && frame.value.type === 'headers') resource.headers = frame.value;
      else if (frame.type === 'event' && frame.value.type === 'chunk') {
        resource.chunks.push(Buffer.from(frame.value.data, 'base64'));
        socket.send(JSON.stringify({ type: 'ack', id: frame.id, count: 1 }));
      } else if (frame.type === 'end') resource.resolve({ ...resource.headers, body: Buffer.concat(resource.chunks) });
      else if (frame.type === 'error') resource.reject(Error(frame.code));
    } else if (active) void page.evaluate(frame => window.DSHMRemote?.onmessage?.({ data: JSON.stringify({ event: frame }) }), frame).catch(() => {});
  };
  socket.on('message', receive);
  const readResource = path => new Promise((accept, decline) => {
    const id = randomUUID(), timer = setTimeout(() => { resources.delete(id); socket.send(JSON.stringify({ type: 'cancel', id })); decline(Error('resource_timeout')); }, 30000);
    const finish = action => value => { clearTimeout(timer); resources.delete(id); action(value); };
    resources.set(id, { chunks: [], resolve: finish(accept), reject: finish(decline) });
    socket.send(JSON.stringify({ type: 'request', id, operation: { method: 'remote.resource', path, verb: 'GET' } }));
  });
  try {
    await page.exposeFunction('__dshmBridge', async ({ op, data }) => {
      report.bridgeCalls.push(op);
      if (op === 'appearance.read') return { data: { preference: 'system', fontSize: 14, enabled: true, language: 'zh' } };
      if (op === 'binding.link' || op === 'notifications.take') return { data: {} };
      if (op === 'binding.info') return { data: binding };
      if (op === 'binding.status') return { data: { status: 'active' } };
      if (op === 'socket.connect') return { data: {}, event: ready };
      if (op === 'socket.send') {
        const operation = data.frame.operation;
        if (operation?.method === 'remote.codingToolsRead' || operation?.method?.startsWith('remote.settings'))
          report.fixedSettingsCalls.push({ method: operation.method, namespace: operation.namespace, edits: operation.edits });
        if (operation?.method === 'remote.codingToolsRead' || operation?.namespace === 'ui-settings') codingRequests.add(data.frame.id);
        socket.send(JSON.stringify(data.frame)); return { data: {} };
      }
      if (op === 'notifications.status') return { data: { status: 'disabled' } };
      if (op === 'notifications.context' || op === 'socket.release') return { data: {} };
      throw Error('browser_carrier_operation_unavailable:' + op);
    });
    await page.addInitScript(() => {
      window.DSHMRemote = { postMessage(text) {
        const request = JSON.parse(text);
        window.__dshmBridge(request).then(value => {
          this.onmessage?.({ data: JSON.stringify({ id: request.id, data: value.data }) });
          if (value.event) this.onmessage?.({ data: JSON.stringify({ event: value.event }) });
        }, error => this.onmessage?.({ data: JSON.stringify({ id: request.id, error: error.message }) }));
      } };
    });
    await page.route('https://remote.dshm.invalid/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/plugins/')) {
        const result = await readResource(url.pathname + url.search);
        report.resources.push({ path: url.pathname, status: result.status, bytes: result.body.length });
        return route.fulfill({ status: result.status, headers: result.headers, body: result.body });
      }
      const file = resolve(dist, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(dist + sep)) return route.abort();
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      try { await route.fulfill({ body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404 }); }
    });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', entry => { if (entry.type() === 'error') report.consoleErrors.push(entry.text()); });
    await page.goto('https://remote.dshm.invalid/remote.html');
    await page.getByRole('button').filter({ hasText: title }).click();
    await page.getByText(marker, { exact: true }).waitFor();
    await verifyLockedPreset(page, preset);
    report.historyPresetLocked = true;
    await page.locator('[data-composer-input]').click();
    await page.getByRole('button', { name: /^选择模型，当前 / }).click();
    await page.getByRole('button', { name: nextModel.name, exact: true }).click();
    await page.getByRole('button', { name: '选择模型，当前 ' + nextModel.name, exact: true }).waitFor();
    report.modelChanged = true;
    if (process.env.DSHM_LATEST_FILE_ONLY === '1') {
      report.fileRefresh = await verifyFileRefresh(page, title, verifyFiles);
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.consoleErrors, []);
      Object.assign(report, { passed: true, fileOnly: true, ownPage: true });
      return report;
    }
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    const cordisRegion = page.getByRole('region', { name: '插件面板', exact: true });
    await cordisRegion.getByRole('button', { name: '打开面板', exact: true }).waitFor();
    assert.equal(await cordisRegion.locator('[data-cordis-badge]').count(), 0);
    const cordisReceipt = await mutateCordis('define');
    await cordisRegion.locator('[data-cordis-badge]').click();
    await cordisRegion.locator('[data-cordis-panel]').waitFor();
    const cordisRow = cordisRegion.locator(`[data-cordis-row="${cordisReceipt.pluginId}"]`);
    await cordisRow.getByText('Latest isolated Cordis v1', { exact: true }).waitFor();
    assert.equal(await cordisRow.locator('[data-cordis-switch]').count(), 1);
    await mutateCordis('update');
    await cordisRow.getByText('Latest isolated Cordis v2', { exact: true }).waitFor();
    // 由隔离 Host 调用原 run 产生真实待审批；手动面板运行本身已是用户授权。
    await mutateCordis('request');
    await cordisRow.locator('[data-cordis-approve]').click();
    await cordisRegion.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByTestId('latest-cordis-echo').click();
    await page.getByTestId('latest-cordis-echo').filter({ hasText: 'LATEST_CORDIS_HOST_ECHO_V2' }).waitFor();
    report.cordisApprovalLocalUiAndHostInvoke = true;
    report.cordisRequestSource = 'isolated fixture invoking original Host run; not model inference';
    await mutateCordis('remove');
    await page.getByTestId('latest-cordis-echo').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await cordisRegion.locator('[data-cordis-badge]').waitFor({ state: 'detached' });
    report.cordisDefinitionVersionRemovalPushed = true;
    report.originalCordisPanelOpened = true;
    await cordisRegion.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByRole('button', { name: '插件设置', exact: true }).click();
    await page.getByRole('combobox', { name: '插件配置', exact: true }).waitFor();
    const selector = page.getByRole('combobox', { name: '插件配置', exact: true });
    const timeout = page.locator('#plugin-config-shell-timeout');
    await timeout.waitFor();
    assert.equal(await timeout.isDisabled(), false);
    assert.equal(Number(await timeout.inputValue()), shellValue);
    await timeout.fill(String(shellValue + 1));
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await verifyShell(shellValue + 1, true);
    // 电脑已接受不等于手机表单已处理回执；须等待原保存模型完成再恢复继承。
    await page.getByRole('button', { name: '保存', exact: true }).waitFor();
    await page.getByRole('button', { name: '恢复默认', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await verifyShell(shellValue, false);
    await page.getByRole('button', { name: '保存', exact: true }).waitFor();
    report.settingsSavedAndInheritanceRestored = true;
    await mutateShellOnDesktop(shellValue + 2);
    await page.locator('#plugin-config-shell-timeout:disabled').waitFor();
    await page.getByRole('button', { name: '重新读取设置', exact: true }).click();
    await page.locator('#plugin-config-shell-timeout:not(:disabled)').waitFor();
    assert.equal(Number(await timeout.inputValue()), shellValue + 2);
    await page.getByRole('button', { name: '恢复默认', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await verifyShell(shellValue, false);
    await page.getByRole('button', { name: '保存', exact: true }).waitFor();
    report.desktopSettingChangeInvalidatedMobile = true;
    for (const id of ['agent-loop', 'subagent', 'web-search', 'bash']) {
      await selector.selectOption(id);
      await page.getByRole('button', { name: '重新读取设置', exact: true }).waitFor();
      const field = { 'agent-loop': '#plugin-config-agent-loop-parallel', subagent: '#plugin-config-subagent-depth',
        'web-search': '#plugin-config-web-search-max-uses', bash: '#plugin-config-shell-timeout' }[id];
      await page.locator(field).waitFor();
      assert.equal(await page.locator(field).isDisabled(), false, id + ' real settings form');
    }
    report.pluginSettingsOpened = true;
    await verifyBlankPreset(page, preset, verifyPreset);
    report.blankPresetSelectedAndSynced = true;
    await verifyPresetDefault(page, preset, verifyDefault);
    report.presetDefaultSavedInheritedAndRestored = true;
    await verifyPresetDirectory(page, preset);
    report.presetProfileLocationDisplayed = true;
    await verifyPresetManagement(page, preset, verifyManagement);
    report.presetCopyCancelDelete = true;
    await verifyCodingTools(page, verifyCoding);
    report.codingToolsSavedInheritedAndPushed = true;
    await verifyPresetCreator(page, title, verifyCreator);
    report.presetCreatorHistoryProtectedAndBlankReused = true;
    await verifyProviderManagement(page, verifyProvider);
    report.modelCapabilitiesTemplatesAndProtocolSwitchRestored = true;
    report.providerCreateRenameModelsCancelRemove = true;
    report.modelProbeCancelReadAdoptAndRedirectRejected = true;
    report.existingDiscoverySavedAndDraftTargetsSeparated = true;
    await verifyModelCatalogManagement(page, verifyCatalog);
    report.officialAndBuiltinCatalogSavedAndRestored = true;
    report.officialInputAndBuiltinCapabilitiesRestored = true;
    report.fileRefresh = await verifyFileRefresh(page, title, verifyFiles);
    assert.equal(await page.locator('iframe').count(), 0, 'DSHM 自有会话页面不能嵌入电脑整站');
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, [], '局部插件边界的渲染错误也必须失败');
    Object.assign(report, { passed: true, ownPage: true, sessionOpened: true, originalHistoryRendered: true });
  } catch (error) {
    report.passed = false; report.error = error.message;
    report.pageText = await page.locator('body').innerText().catch(() => 'page_closed');
    report.failureButtons = await page.locator('button').evaluateAll(rows => rows.map(row => ({ text: row.textContent, label: row.getAttribute('aria-label'),
      title: row.title, disabled: row.disabled, hidden: Boolean(row.closest('[inert], [aria-hidden="true"]')) })));
    report.fileDiagnostic = await page.getByTestId('remote-workspace').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model;
        if (!model?.documentPreviews) continue;
        return { renderers: model.documentPreviews.getSnapshot(), layouts: [...model.panelMemory.layouts.values()],
          preview: [...document.querySelectorAll('.remote-document-content')].map(row => row.innerHTML) };
      }
    }).catch(error => ({ error: error.message }));
    // 只读隔离页面现有 React owner 的原 Cordis 日志，诊断被 Loader 收纳的初始化错误。
    report.pluginStartupErrors = await page.getByTestId('remote-workspace').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model;
        if (!model?.ctx?.logger?.buffer) continue;
        return model.ctx.logger.buffer.filter(row => row.type === 'error').map(row => ({ name: row.name,
          args: row.args.map(value => String(value?.stack ?? value).slice(0, 4000)) }));
      }
      return [];
    }).catch(() => []);
    // 面板失败时保留真实模块激活状态，区分接口契约和缺少服务；不读取凭据。
    try {
      const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
      if (await manager.isVisible()) {
        await manager.getByRole('button', { name: '返回', exact: true }).click();
        await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
      }
      const panel = page.getByRole('region', { name: '插件面板', exact: true });
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      report.pluginEntries = await page.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState, text: row.textContent })));
    } catch (diagnosticError) { report.diagnosticError = diagnosticError.message; }
    throw error;
  } finally {
    await page.screenshot({ path: resolve(evidence, 'latest-remote-page.png') }).catch(() => {});
    active = false; socket.off('message', receive);
    for (const resource of resources.values()) resource.reject(Error('browser_test_finished'));
    resources.clear(); await browser.close();
    await writeFile(resolve(evidence, 'latest-remote-page.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
