import assert from 'node:assert/strict';
import { readFile, writeFile, stat, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 使用既有专用测试会话；只改变原核心 bundle 的时间戳触发真实 HMR，不改代码或发模型消息。
const bundle = process.env.DSHM_CORE_BUNDLE;
const networkFailure = process.argv.includes('--network-failure');
const overlappingUpdates = process.argv.includes('--overlapping-updates');
assert.ok(!(networkFailure && overlappingUpdates));
const controlledNetwork = networkFailure || overlappingUpdates;
const artifact = networkFailure ? 'core-rebuild-network-failure' : overlappingUpdates ? 'core-rebuild-overlap' : 'core-rebuild';
const control = async path => {
  const response = await fetch(`http://127.0.0.1:18794/${path}`, { method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(response.ok); return response.json();
};
assert.equal(bundle, 'F:/Program Files/deepseek-harness/packages/api/remotes/lib/client.js');
const seed = JSON.parse(await readFile('artifacts/output-ansi-boundary-seed.json', 'utf8'));
assert.equal(seed.stage, 'archived');
const digest = async () => createHash('sha256').update(await readFile(bundle)).digest('hex');
const original = await stat(bundle), hash = await digest();
const report = { at: new Date().toISOString(), bundle, hash, networkFailure, overlappingUpdates, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
let page, changed = false, draft, selected = false;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = first.context().waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading'); await heading.waitFor();
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (await heading.innerText() === seed.title) {
    const previous = page.getByRole('button', { name: '关闭命令详情', exact: true });
    if (await previous.count()) await previous.click();
    // 专用会话中仅清理上次异常验收遗留的已知草稿。
    const editor = page.getByRole('textbox', { name: '消息', exact: true });
    if (await editor.inputValue() === '核心更新恢复测试草稿，不发送') await editor.fill('');
    await page.getByRole('button', { name: '返回', exact: true }).click();
  }
  if (await heading.innerText() === seed.original) await page.getByRole('button', { name: '返回', exact: true }).click();
  assert.equal(await heading.innerText(), 'Remote');
  if (!await page.getByRole('heading', { name: '已归档', exact: true }).count()) await menu('查看已归档聊天');
  await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
  await heading.filter({ hasText: seed.title }).waitFor(); selected = true;
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  draft = await editor.inputValue();
  await editor.fill('核心更新恢复测试草稿，不发送');
  const tool = page.getByRole('region', { name: '聊天内容', exact: true }).locator('details.remote-tool-card').filter({ hasText: 'DSHM_BOUNDARY_RED' }).last();
  if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
  await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '命令详情', exact: true });
  await panel.getByRole('button', { name: '从头查看', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '65,536 /' }).waitFor();
  await panel.getByRole('button', { name: '放大窗口', exact: true }).click();
  const output = panel.getByLabel('独立命令输出', { exact: true });
  const before = await output.textContent();
  const body = panel.locator('.remote-file-preview-body');
  await body.evaluate(el => { el.scrollTop = 280; });
  report.beforeScroll = await body.evaluate(el => el.scrollTop);
  await page.evaluate(() => {
    const probe = window.__dshmRebuildProbe = { transport: window.__DSH_TRANSPORT__, facade: window.__ModuleLoader__, graphs: [], loaded: [] };
    // 仅旁观真实图版本和成功加载的模块URL，原消息仍原样立即交给客户端。
    probe.originalMessage = window.DSHMRemote.onmessage;
    probe.observeMessage = event => {
      try {
        const graph = JSON.parse(event.data).event?.value;
        const core = graph?.entries?.find(row => row.id === '@deepseek-ai/dsh-api-remotes');
        if (core) probe.graphs.push({ rev: core.rev, urls: [core.url, ...graph.batches.filter(batch => batch.entries.includes(core.id)).map(batch => batch.url)] });
      } catch {}
      return probe.originalMessage(event);
    };
    window.DSHMRemote.onmessage = probe.observeMessage;
    probe.scripts = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof HTMLScriptElement && node.dataset.dshmGeneration) node.addEventListener('load', () => probe.loaded.push(node.src), { once: true });
      }
    });
    probe.scripts.observe(document.head, { childList: true });
  });
  let paused;
  if (controlledNetwork) {
    assert.equal((await control('stats')).devices, 1);
    paused = Promise.withResolvers();
    await page.exposeFunction('dshmTestPauseDuringRebuild', () => control('pause').then(paused.resolve, paused.reject));
    await page.evaluate(overlap => {
      window.__dshmRebuildProbe.observer = new MutationObserver(() => {
        if (!document.querySelector('[data-testid="remote-workspace"]') && (!overlap || document.querySelector('script[data-dshm-generation]'))) {
          window.__dshmRebuildProbe.observer.disconnect();
          void window.dshmTestPauseDuringRebuild();
        }
      });
      window.__dshmRebuildProbe.observer.observe(document.documentElement, { childList: true, subtree: true });
    }, overlappingUpdates);
  }
  assert.equal(await digest(), hash);
  await utimes(bundle, original.atimeMs / 1000, Date.now() / 1000); changed = true;
  if (controlledNetwork) {
    await page.getByTestId('remote-workspace').waitFor({ state: 'detached' });
    await Promise.race([paused.promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('No assembly pause observed')), 10000); timer.unref(); })]);
    const deadline = Date.now() + 5000;
    do {
      report.proxy = await control('stats');
      if (report.proxy.heldBytes > 0) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    assert.ok(report.proxy.heldBytes > 0, 'Actual device responses must be held during assembly');
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    if (networkFailure) { await control('drop'); report.connectionDroppedDuringRebuild = true; }
    else {
      assert.equal(await digest(), hash);
      await utimes(bundle, original.atimeMs / 1000, (Date.now() + 1000) / 1000);
      const bytes = await readFile(bundle), stamp = Buffer.from(String((await stat(bundle)).mtimeMs));
      const revision = createHash('sha1').update('plugin-artifact\0');
      for (const part of [bytes, stamp]) revision.update(`${part.byteLength}:`).update(part);
      report.expectedRevision = revision.digest('hex').slice(0, 12);
      // 原HMR每500ms检查一次。连接仍暂停，第二次更新不能被手机提前消费。
      await new Promise(resolve => setTimeout(resolve, 1100));
      await control('resume'); report.updatedDuringAssembly = true;
    }
  }
  await page.waitForFunction(() => window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__ !== window.__dshmRebuildProbe.transport, { timeout: 30000 });
  report.newTransport = true;
  await panel.getByRole('button', { name: '重新读取', exact: true }).waitFor();
  assert.equal(await output.textContent(), before);
  assert.match(await panel.getAttribute('class'), /is-fullscreen/);
  assert.equal(await panel.getByRole('button', { name: '从头查看', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await editor.inputValue(), '核心更新恢复测试草稿，不发送');
  report.restoredScroll = await body.evaluate(el => el.scrollTop);
  assert.ok(Math.abs(report.beforeScroll - report.restoredScroll) <= 1, 'Command scroll position changed');
  assert.equal(await page.evaluate(() => window.__ModuleLoader__ !== window.__dshmRebuildProbe.facade), true);
  report.facadeReplaced = true; report.draftPreserved = true; report.outputPreserved = true;
  if (overlappingUpdates) {
    await page.waitForFunction(expected => {
      const probe = window.__dshmRebuildProbe;
      const latest = probe.graphs.findLast(graph => graph.rev === expected);
      return latest && latest.urls.some(url => probe.loaded.some(loaded => loaded.endsWith(url)));
    }, report.expectedRevision);
    report.latestVersionLoaded = true;
  }
  await panel.getByRole('button', { name: '重新读取', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '131,072 /' }).waitFor();
  report.continuedOffset = 131072;
  // 恢复原时间戳也经过同一真实重建通道，检查第二次交接。
  await page.evaluate(() => { window.__dshmRebuildProbe.transport = window.__DSH_TRANSPORT__; });
  assert.equal(await digest(), hash);
  await utimes(bundle, original.atimeMs / 1000, original.mtimeMs / 1000); changed = false;
  await page.waitForFunction(() => window.__DSH_TRANSPORT__ && window.__DSH_TRANSPORT__ !== window.__dshmRebuildProbe.transport, { timeout: 30000 });
  await panel.getByRole('button', { name: '重新读取', exact: true }).waitFor();
  await panel.getByRole('status').filter({ hasText: '131,072 /' }).waitFor();
  await panel.getByRole('button', { name: '重新读取', exact: true }).click();
  await output.filter({ hasText: 'DSHM_BOUNDARY_PLAIN' }).waitFor();
  report.secondRebuildContinued = true;
  await page.screenshot({ path: `artifacts/${artifact}-android.png` });
} catch (error) {
  report.errors.push(error.message); process.exitCode = 1;
  if (page) report.failureText = (await page.locator('body').innerText().catch(() => '')).slice(0, 2200);
} finally {
  if (changed) {
    if (await digest() === hash) await utimes(bundle, original.atimeMs / 1000, original.mtimeMs / 1000);
    else { report.errors.push('Concurrent bundle change; timestamp not overwritten'); process.exitCode = 1; }
  }
  report.bytesUnchanged = await digest() === hash;
  report.timestampRestored = Math.abs((await stat(bundle)).mtimeMs - original.mtimeMs) < 1;
  if (page) {
    if (controlledNetwork) await control('resume').catch(error => report.errors.push(error.message));
    await page.evaluate(() => {
      const probe = window.__dshmRebuildProbe;
      probe?.observer?.disconnect(); probe?.scripts?.disconnect();
      if (probe && window.DSHMRemote.onmessage === probe.observeMessage) window.DSHMRemote.onmessage = probe.originalMessage;
      delete window.__dshmRebuildProbe;
      delete window.dshmTestPauseDuringRebuild;
    }).catch(() => {});
    if (controlledNetwork && typeof page.removeExposedBinding === 'function') await page.removeExposedBinding('dshmTestPauseDuringRebuild').catch(() => {});
    if (selected) {
      try {
        const close = page.getByRole('button', { name: '关闭命令详情', exact: true });
        if (await close.count()) await close.click();
        await page.getByRole('textbox', { name: '消息', exact: true }).fill(draft ?? '');
        await page.getByRole('button', { name: '返回', exact: true }).click();
        const archived = page.getByRole('heading', { name: '已归档', exact: true });
        if (await archived.count()) {
          await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
          await page.getByRole('button', { name: '查看最近聊天', exact: true }).click();
        }
        await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
        report.originalChatRestored = true;
      } catch (error) { report.errors.push(`cleanup: ${error.message}`); process.exitCode = 1; }
    }
  }
  await writeFile(`artifacts/${artifact}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
