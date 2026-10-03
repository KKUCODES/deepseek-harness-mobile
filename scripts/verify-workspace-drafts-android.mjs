import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const deadline = Date.now() + 20000;
  while (!page && Date.now() < deadline) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const heading = main.locator('.remote-heading strong');
  if (await heading.innerText() === 'Remote') await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await input.waitFor();
  if (await heading.innerText() !== seed.original) {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
  }
  assert.equal(await heading.innerText(), seed.original);
  if (cleanup) {
    const previous = JSON.parse(await readFile('artifacts/workspace-drafts-live-android.json', 'utf8'));
    await main.getByTestId('workspace-drafts-prepare').waitFor({ state: 'detached' });
    assert.equal(await input.innerText(), previous.originalDraft);
    await main.getByRole('button', { name: '返回', exact: true }).click();
    assert.equal(await main.getByRole('button', { name: /^DSHM 草稿交接 (source|target)$/ }).count(), 0);
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    report.unloaded = true; report.workspacesRemoved = true;
  } else {
    report.originalDraft = await input.innerText();
    const prepare = main.getByTestId('workspace-drafts-prepare'); await prepare.click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="workspace-drafts-prepare"]')?.dataset.state ?? '{}').status === 'ready');
    report.prepared = JSON.parse(await prepare.getAttribute('data-state'));
    await page.waitForFunction(id => document.querySelector('[data-testid="workspace-drafts-prepare"]')?.dataset.session === id, report.prepared.from);
    assert.equal(await input.innerText(), '');
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.contentEditable === 'true');
    await page.evaluate(() => {
      const hooks = window.__DSH_FILE_UPLOAD__, original = hooks.fetch;
      window.__workspaceDraftUploads = [];
      hooks.fetch = async (...args) => {
        const response = await original(...args);
        const value = await response.clone().json();
        window.__workspaceDraftUploads.push({ sessionId: new URL(String(args[0]), location.href).searchParams.get('sessionId'), receipt: value.value?.receiptId, ok: value.ok });
        return response;
      };
      window.__restoreWorkspaceDraftUpload = () => { hooks.fetch = original; };
    });
    await input.fill('DSHM_WORKSPACE_DRAFT_20260926');
    await main.getByRole('button', { name: '添加附件', exact: true }).click();
    const chooserReady = page.waitForEvent('filechooser');
    await page.getByRole('dialog', { name: '附件', exact: true }).getByRole('button', { name: '选择文件', exact: true }).click();
    const chooser = await chooserReady;
    await chooser.setFiles({ name: 'dshm-workspace-draft.txt', mimeType: 'text/plain', buffer: Buffer.from('DSHM workspace original bytes 20260926') });
    const file = main.locator('.remote-file').filter({ hasText: 'dshm-workspace-draft.txt' });
    await file.getByRole('status').getByText(/已上传/).waitFor();
    await main.locator('.remote-draft-saving').waitFor({ state: 'detached' });
    await main.getByRole('button', { name: '切换工作区', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSHM 草稿交接 target', exact: true }).click();
    await page.waitForFunction(id => document.querySelector('[data-testid="workspace-drafts-prepare"]')?.dataset.session === id, report.prepared.to);
    assert.equal(await input.innerText(), 'DSHM_WORKSPACE_DRAFT_20260926'); await file.getByRole('status').getByText(/已上传/).waitFor();
    report.uploads = await page.evaluate(() => ({ sessions: window.__workspaceDraftUploads.map(item => item.sessionId),
      success: window.__workspaceDraftUploads.every(item => item.ok), distinct: new Set(window.__workspaceDraftUploads.map(item => item.receipt)).size === 2 }));
    assert.deepEqual(report.uploads.sessions, [report.prepared.from, report.prepared.to]); assert.equal(report.uploads.success, true); assert.equal(report.uploads.distinct, true);
    await page.screenshot({ path: 'artifacts/workspace-drafts-live-android.png' });
    await main.getByRole('button', { name: '打开源测试聊天', exact: true }).click();
    await page.waitForFunction(id => document.querySelector('[data-testid="workspace-drafts-prepare"]')?.dataset.session === id, report.prepared.from);
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.dataset.empty === 'true');
    assert.equal(await file.count(), 0); report.sourceCleared = true;
    await main.getByRole('button', { name: '打开目标测试聊天', exact: true }).click();
    await page.waitForFunction(id => document.querySelector('[data-testid="workspace-drafts-prepare"]')?.dataset.session === id, report.prepared.to);
    assert.equal(await input.innerText(), 'DSHM_WORKSPACE_DRAFT_20260926');
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.contentEditable === 'true');
    await input.fill(''); await file.getByRole('button', { name: '移除附件 dshm-workspace-draft.txt', exact: true }).click();
    await main.locator('.remote-draft-saving').waitFor({ state: 'detached' });
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
    assert.equal(await heading.innerText(), seed.original); assert.equal(await input.innerText(), report.originalDraft); report.originalRestored = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/workspace-drafts-failure-android.png' }).catch(() => {});
} finally {
  if (page) await page.evaluate(() => window.__restoreWorkspaceDraftUpload?.()).catch(() => {});
  if (page && report.prepared?.created.length) {
    report.archived = await page.evaluate(async ids => Promise.all(ids.map(async sessionId => {
      const result = await window.__DSH_TRANSPORT__.rpc.call('/api', 'workspace/archiveSession', { args: { request: { sessionId } } }, new AbortController().signal);
      return { sessionId, archived: result.ok && result.value.archivedSessionIds.includes(sessionId) };
    })), report.prepared.created).catch(error => ({ error: error.message }));
    if (!Array.isArray(report.archived) || report.archived.some(item => !item.archived)) process.exitCode = 1;
  }
  await writeFile(`artifacts/workspace-drafts-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
