import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chooseDownload, pickerNodes, tapPickerNode } from './android-picker-test.mjs';
import { pdfFixture } from '../../deepseek-harness/packages/client/ui-sidebar-documentpreview/tests/pdf-fixture.ts';
import { androidAppWebView } from './android-app-webview.mjs';

// 只操作本应用和专用联调会话；发送必须显式打开，默认仅检查真实历史。
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') {
    report.errors.push(message.text());
    (report.consoleLocations ??= []).push({ text: message.text().split('\n')[0], ...message.location() });
  } });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await page.getByTestId('remote-workspace').waitFor();
  const title = 'DSHM Remote 联调提示';
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) {
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  }
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  if (process.argv.includes('--manage') && (await heading.innerText()).startsWith('DSHM 会话管理联调 ')) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    await heading.filter({ hasText: title }).waitFor();
  }
  const resumeBlank = process.argv.includes('--manage') && (await heading.innerText()) === 'DSH-TEST';
  if (!resumeBlank) await page.locator('.remote-heading').filter({ hasText: title }).waitFor();
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  if (!resumeBlank) await history.getByRole('article', { name: '模型回复' }).first().waitFor();
  if (process.argv.includes('--search') || process.argv.includes('--search-disabled')) {
    const { verifyRemoteSearch } = await import('./verify-remote-search.mjs');
    report.search = await verifyRemoteSearch(page, history, process.argv.includes('--search-disabled'));
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
    await writeFile(`artifacts/remote-search${process.argv.includes('--search-disabled') ? '-disabled' : ''}-android.json`, JSON.stringify({ at: report.at, search: report.search, errors: report.errors, resources: report.resources }, null, 2));
  }
  if (process.argv.includes('--permissions')) {
    const { verifyRemotePermissions } = await import('./verify-remote-permissions.mjs');
    report.permissions = await verifyRemotePermissions(page);
  }
  if (process.argv.includes('--workspace-access')) {
    const originalDraft = await page.getByRole('textbox', { name: '发送消息' }).count() ? await page.getByRole('textbox', { name: '发送消息' }).inputValue() : null;
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '管理工作区', exact: true }).click();
    const manager = page.getByTestId('remote-workspace-manager');
    await page.getByRole('heading', { name: '管理工作区', exact: true }).waitFor();
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await manager.getByRole('button').count(), 0);
    await page.screenshot({ path: 'artifacts/remote-workspace-access-android.png' });
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    if (originalDraft !== null) assert.equal(await page.getByRole('textbox', { name: '发送消息' }).inputValue(), originalDraft);
    report.workspaceAccess = { supportedHost: true, managementRequired: true, noWriteControls: true, readOnly: true };
    await writeFile('artifacts/remote-workspace-access-android.json', JSON.stringify({ at: report.at, ...report.workspaceAccess, errors: report.errors, resources: report.resources }, null, 2));
  }
  if (process.argv.includes('--goals')) {
    const { verifyRemoteGoals } = await import('./verify-remote-goals.mjs');
    report.goals = await verifyRemoteGoals(page);
  }
  if (process.argv.includes('--schedules') || process.argv.includes('--schedules-live')) {
    const { verifyRemoteSchedules } = await import('./verify-remote-schedules.mjs');
    report.schedules = await verifyRemoteSchedules(page, process.argv.includes('--schedules-live'));
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
    await writeFile('artifacts/remote-schedules-result.json', JSON.stringify({ at: report.at, ...report.schedules }, null, 2));
  }
  if (process.argv.includes('--jobs') || process.argv.includes('--jobs-live') || process.argv.includes('--jobs-stop')) {
    const { verifyRemoteJobs } = await import('./verify-remote-jobs.mjs');
    report.jobs = await verifyRemoteJobs(page, process.argv.includes('--jobs-live') || process.argv.includes('--jobs-stop'), process.argv.includes('--jobs-stop'), process.argv.includes('--jobs-output'));
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
    await writeFile('artifacts/remote-jobs-result.json', JSON.stringify({ at: report.at, ...report.jobs }, null, 2));
  }
  if (process.argv.includes('--agent-presets')) {
    const { verifyRemoteAgentPresets } = await import('./verify-remote-agent-presets.mjs');
    report.agentPresets = await verifyRemoteAgentPresets(page);
  }
  if (process.argv.includes('--models')) {
    const { verifyRemoteModels } = await import('./verify-remote-models.mjs');
    report.models = await verifyRemoteModels(page);
  }
  if (process.argv.includes('--skills')) {
    const { verifyRemoteSkills } = await import('./verify-remote-skills.mjs');
    report.skills = await verifyRemoteSkills(page, history);
  }
  if (process.argv.includes('--plugins')) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByTestId('remote-plugin-list').waitFor({ timeout: 60000 });
    report.plugins = await page.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState })));
    assert.ok(report.plugins.some(item => item.id === '@deepseek-ai/dsh-client-modules' && item.state === 'active'));
    const row = page.locator('[data-plugin-id="@dsh-mobile/plugin"]');
    const toggle = row.getByRole('switch');
    const original = await toggle.getAttribute('aria-checked');
    const hadOverride = await row.getByRole('button', { name: '恢复插件默认' }).count();
    await toggle.click(); assert.notEqual(await toggle.getAttribute('aria-checked'), original);
    if (hadOverride) await toggle.click(); else await row.getByRole('button', { name: '恢复插件默认' }).click();
    assert.equal(await toggle.getAttribute('aria-checked'), original);
    const stylesBefore = await page.locator('style[data-plugin]').count();
    await page.screenshot({ path: 'artifacts/remote-plugins-android.png' });
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑连接', exact: true }).click();
    await page.getByRole('button', { name: '断开连接', exact: true }).click();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor();
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    await history.getByRole('article', { name: '模型回复' }).first().waitFor();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    await page.getByTestId('remote-plugin-list').waitFor({ timeout: 60000 });
    const reconnected = await page.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState })));
    assert.deepEqual(reconnected, report.plugins);
    assert.equal(await page.locator('style[data-plugin]').count(), stylesBefore);
    assert.equal(await page.locator('script[data-dshm-generation]').count(), 0);
    report.pluginReconnect = { statesPreserved: true, noDuplicateStyles: true, userToggleRestored: true };
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  }
  if (process.argv.includes('--turn-fork')) {
    const { verifyTurnFork } = await import('./verify-turn-fork.mjs');
    report.turnFork = await verifyTurnFork(page, history);
  }
  if (process.argv.includes('--fork-availability')) {
    const { verifyForkAvailability } = await import('./verify-turn-fork.mjs');
    report.forkAvailability = await verifyForkAvailability(history);
  }
  if (process.argv.includes('--commands-live') || process.argv.includes('--commands-resume')) {
    const { verifyCommands } = await import('./verify-commands.mjs');
    report.commands = await verifyCommands(page, device, history);
  }
  if (process.argv.includes('--changes') || process.argv.includes('--changes-resume')) {
    const { verifyChanges } = await import('./verify-changes.mjs');
    report.changes = await verifyChanges(page, history);
  }
  if (process.argv.includes('--changes-expired')) {
    const { verifyExpiredChanges } = await import('./verify-changes.mjs');
    report.expiredChanges = await verifyExpiredChanges(page, history);
  }
  if (process.argv.includes('--inline-images')) {
    const { verifyInlineImages } = await import('./verify-inline-images.mjs');
    report.inlineImages = await verifyInlineImages(page, device, history);
  }
  if (process.argv.includes('--office-attachment')) {
    const { verifyOfficeAttachment } = await import('./verify-office-attachment.mjs');
    report.officeAttachment = await verifyOfficeAttachment(page, device, history);
  }
  if (process.argv.includes('--html-attachment')) {
    const { verifyHtmlAttachment } = await import('./verify-html-attachment.mjs');
    report.htmlAttachment = await verifyHtmlAttachment(page, device, history);
  }
  if (process.argv.includes('--image-input-rejection')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const filename = 'dshm-image-input.png', input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('图片能力拒绝验证，不应开始模型生成。');
    assert.equal((await page.locator('.model').innerText()).trim(), 'DeepSeek-V4-Pro');
    const before = await history.getByRole('article', { name: '模型回复' }).count();
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '从相册选择', exact: true }).click();
    await chooseDownload(device, filename);
    const pending = page.getByLabel('待发送附件', { exact: true });
    await pending.getByText(/待发送图片/).waitFor();
    assert.equal(await pending.locator('.remote-file').count(), 1, '单次选择只添加一张图片');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.locator('.remote-error').filter({ hasText: /image|图片/i }).waitFor({ timeout: 90000 });
    assert.equal(await history.getByRole('article', { name: '模型回复' }).count(), before);
    assert.equal(await pending.locator('.remote-file').count(), 1);
    report.imageRejection = { message: await page.locator('.remote-error').innerText(), retainedDraft: await input.inputValue() };
    await pending.getByRole('button', { name: `移除附件 ${filename}`, exact: true }).click();
    await input.fill('');
  }
  if (process.argv.includes('--image-input')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const filename = 'dshm-image-input.png', input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('');
    const previousModel = (await page.locator('.model').innerText()).trim();
    await page.locator('.model').click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    const count = await history.getByRole('article', { name: '模型回复' }).count();
    try {
      await page.getByRole('button', { name: '添加附件', exact: true }).click();
      await page.getByRole('button', { name: '从相册选择', exact: true }).click();
      await chooseDownload(device, filename);
      await page.getByLabel('待发送附件', { exact: true }).getByText(/待发送图片/).waitFor();
      assert.equal(await page.getByLabel('待发送附件', { exact: true }).locator('.remote-file').count(), 1, '单次选择只添加一张图片');
      await input.fill('只看本条消息的附件图片，说明顶部三个色块从左到右的颜色，不参考历史图片，不调用任何工具。');
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await page.getByLabel('待发送附件', { exact: true }).waitFor({ state: 'detached', timeout: 90000 });
      const response = history.getByRole('article', { name: '模型回复' }).nth(count);
      await response.waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: '发送消息', exact: true }).waitFor({ timeout: 90000 });
      const reply = await response.innerText();
      assert.match(reply, /蓝[\s\S]*红[\s\S]*绿/);
      await history.getByRole('button', { name: `查看附件 ${filename}`, exact: true }).last().click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      await page.waitForFunction(() => { const image = document.querySelector('.remote-file-preview img'); return image?.complete && image.naturalWidth === 1024; });
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      await page.screenshot({ path: 'artifacts/remote-image-input-android.png' });
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      report.imageInput = { filename, reply, sourceBytes: (await readFile(resolve('artifacts', filename))).length, albumPicker: true, historicalImagePreview: true };
    } finally {
      if (await page.getByRole('dialog', { name: '文件预览', exact: true }).count()) await page.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await input.fill(''); await page.locator('.model').click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: previousModel, exact: true }).click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
    }
  }
  if (process.argv.includes('--attachment-image')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const modelDialog = page.getByRole('dialog', { name: '选择模型', exact: true });
    if (await modelDialog.count()) await modelDialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const { attachmentImageFixture } = await import('./attachment-image-fixture.mjs');
    const path = resolve('artifacts', `dshm-attachment-image-${Date.now()}.png`).replaceAll('\\', '/');
    await writeFile(path, attachmentImageFixture());
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('');
    const previousModel = await page.locator('.model').innerText();
    await page.locator('.model').click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    try {
      await input.fill(`这是 DSHM 图片附件验证。只调用 read_image 读取 ${path}，然后简短说明图片上方从左到右的三种颜色。不修改文件，不运行命令，不调用其他工具。`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      const tool = history.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^read_image · 已完成/ }) }).last();
      await tool.waitFor({ timeout: 90000 });
      await tool.locator('summary').click();
      const card = tool.getByRole('button', { name: /^查看附件 / }).first();
      await card.click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      const img = preview.locator('img'); await img.waitFor();
      await page.waitForFunction(() => { const image = document.querySelector('.remote-file-preview img'); return image?.complete && image.naturalWidth > 0; });
      const dimensions = await img.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
      assert.equal(dimensions.width, 1024); assert.equal(dimensions.height, 1024);
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      await page.screenshot({ path: 'artifacts/remote-attachment-image-android.png' });
      const blob = await img.getAttribute('src');
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      const revoked = await page.evaluate(url => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(false); image.onerror = () => resolve(true); image.src = url; }), blob);
      assert.equal(revoked, true);
      await page.getByRole('button', { name: '发送消息', exact: true }).waitFor({ timeout: 60000 });
      report.attachmentImage = { path, dimensions, originalSessionImage: true, blobRevoked: revoked, reply: await history.getByRole('article', { name: '模型回复' }).last().innerText() };
    } finally {
      // 仅恢复本次验证前的模型，不修改会话的其他配置。
      if (await page.getByRole('dialog', { name: '文件预览', exact: true }).count()) await page.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await input.fill(''); await page.locator('.model').click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: previousModel.trim(), exact: true }).click();
    }
  }
  if (process.argv.includes('--attachment')) {
    const filename = 'dshm-shared-upload-20260924.txt';
    const expected = await readFile(resolve('artifacts', filename));
    const card = history.getByRole('button', { name: `查看附件 ${filename}`, exact: true }).first();
    for (let pageIndex = 0; pageIndex < 10 && !await card.count(); pageIndex++) {
      const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
      if (!await older.count()) break;
      await older.click();
      await page.waitForFunction(() => { const button = [...document.querySelectorAll('button')].find(element => element.textContent === '加载更早的消息'); return !button || !button.disabled; });
    }
    await card.click();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await preview.locator('pre').waitFor();
    assert.equal(await preview.locator('pre').textContent(), expected.toString('utf8'));
    await preview.getByText('聊天中的原始附件', { exact: true }).waitFor();
    await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
    await page.screenshot({ path: 'artifacts/remote-attachment-text-android.png' });
    const savedFiles = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0')
      .filter(path => path.startsWith(`/sdcard/Download/${filename}`)).map(path => path.slice('/sdcard/Download/'.length));
    const beforeSave = new Set(await savedFiles());
    await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await preview.getByText('请选择保存位置…', { exact: true }).waitFor();
    let nodes = await pickerNodes(device);
    assert.equal(nodes.find(node => node.class === 'android.widget.EditText')?.text, filename);
    if (!nodes.some(node => node.text === '下载')) {
      await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
      await tapPickerNode(device, node => node.text === '下载');
    }
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    nodes = await pickerNodes(device);
    if (nodes.some(node => node.text === '替换')) await tapPickerNode(device, node => node.text === '替换');
    await preview.getByText('已保存到所选位置。', { exact: true }).waitFor();
    const created = (await savedFiles()).filter(name => !beforeSave.has(name));
    assert.equal(created.length, 1); assert.match(created[0], /^[\w.() -]+$/);
    const sha256 = createHash('sha256').update(expected).digest('hex');
    assert.equal((await device.shell(`sha256sum '/sdcard/Download/${created[0]}'`)).toString().split(/\s/)[0], sha256);
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    report.attachment = { filename, savedName: created[0], bytes: expected.length, sha256, historicalCard: true, fullscreen: true, saved: true };
  }
  if (process.argv.includes('--office')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Office test requires DSHM_RUN_LIVE=1');
    const { realOfficeBytes } = await (await import('./office-fixture.mjs')).loadOfficeFixture();
    const stem = `dshm-office-${Date.now()}`, extensions = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'];
    const files = [];
    for (const extension of extensions) {
      const path = resolve('artifacts', `${stem}.${extension}`).replaceAll('\\', '/');
      await writeFile(path, realOfficeBytes(extension, 'DSHM Missing Font 20260924')); files.push({ path, extension });
    }
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 Office 文件预览验证，不调用工具。只原样输出以下 Markdown 链接：\n' + files.map(file => `[Office ${file.extension}](${file.path})`).join('\n'));
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const reply = history.getByRole('article', { name: '模型回复' }).last();
    await reply.getByRole('button', { name: 'Office ppt', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    report.office = [];
    for (const file of files) {
      await reply.getByRole('button', { name: `Office ${file.extension}`, exact: true }).click();
      await preview.locator('.textLayer').getByText(/Office preview/).first().waitFor({ timeout: 120000 });
      const text = await preview.locator('.textLayer').allTextContents();
      assert.ok(text.join('').includes('Office preview')); assert.ok(text.join('').includes('中文文档'));
      const canvas = preview.locator('canvas').first(); await canvas.waitFor();
      assert.ok(await canvas.evaluate(element => element.width > 0 && element.height > 0));
      const notice = await preview.getByRole('status').allTextContents();
      if (file.extension === 'docx') assert.match(notice.join(' '), /DSHM Missing Font 20260924/);
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      await page.screenshot({ path: `artifacts/remote-office-${file.extension}-android.png` });
      report.office.push({ extension: file.extension, text, notice, rendered: true });
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      assert.equal(page.workers().length, 0);
    }
    await writeFile(files[0].path, 'invalid docx');
    await reply.getByRole('button', { name: 'Office docx', exact: true }).click();
    await preview.getByRole('alert').waitFor({ timeout: 90000 }); assert.equal(await preview.locator('canvas').count(), 0);
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await unlink(files[0].path);
    await reply.getByRole('button', { name: 'Office docx', exact: true }).click();
    await preview.getByText('文件已被删除或移动。', { exact: true }).waitFor();
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await writeFile(files[0].path, realOfficeBytes('docx', 'DSHM Missing Font 20260924'));
    report.officeFailures = { corruptRejected: true, removedRejected: true, noStalePdf: true };
  }
  if (process.argv.includes('--html')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'HTML test requires DSHM_RUN_LIVE=1');
    const stem = `dshm-html-${Date.now()}`, path = resolve('artifacts', `${stem}.html`).replaceAll('\\', '/');
    const cssPath = resolve('artifacts', `${stem}.css`), scriptPath = resolve('artifacts', `${stem}.js`);
    const source = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./${stem}.css"><h1>DSHM Remote HTML</h1><p id="status">等待脚本</p><button id="count">计数 0</button><input type="file" aria-label="文档选择文件"><script src="./${stem}.js"></script>`;
    const css = 'body{font-family:sans-serif;padding:20px;background:#f3f6ff;color:#182746}h1{font-size:24px}button{padding:12px 18px;border:0;border-radius:12px;background:#315bc7;color:white}input{display:block;margin-top:20px}';
    await writeFile(path, source); await writeFile(cssPath, css);
    await writeFile(scriptPath, `let count=0;document.querySelector('#status').textContent='本地脚本已加载';document.querySelector('#count').onclick=()=>{document.querySelector('#count').textContent='计数 '+(++count)};`);
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是 HTML 预览验证，不调用工具。只原样输出这个 Markdown 链接：[HTML 验证文件](${path})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const link = history.getByRole('article', { name: '模型回复' }).getByRole('button', { name: 'HTML 验证文件', exact: true }).last();
    await link.waitFor({ timeout: 60000 }); await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await link.click();
    const frame = page.frameLocator('iframe[title="HTML 文件预览"]');
    await frame.getByText('本地脚本已加载', { exact: true }).waitFor({ timeout: 30000 });
    await frame.getByRole('button', { name: '计数 0', exact: true }).click();
    await frame.getByRole('button', { name: '计数 1', exact: true }).waitFor();
    const isolation = await frame.locator('body').evaluate(async element => {
      const result = { origin: self.origin, bridge: typeof window.DSHMRemote, ordinary: typeof window.DSHMOrdinary, background: getComputedStyle(element).backgroundColor };
      try { void parent.document.body; result.parentBlocked = false; } catch { result.parentBlocked = true; }
      try { localStorage.setItem('dshm-html-probe', 'test'); result.storageBlocked = false; } catch { result.storageBlocked = true; }
      try { await fetch('https://remote.dshm.invalid/assets/web/remote.html'); result.fetchBlocked = false; } catch { result.fetchBlocked = true; }
      return result;
    });
    assert.equal(isolation.origin, 'null'); assert.equal(isolation.bridge, 'undefined'); assert.equal(isolation.ordinary, 'undefined');
    assert.ok(isolation.parentBlocked && isolation.storageBlocked && isolation.fetchBlocked);
    assert.equal(isolation.background, 'rgb(243, 246, 255)');
    await frame.getByRole('button', { name: '文档选择文件', exact: true }).click();
    const activity = (await device.shell('dumpsys activity activities')).toString();
    assert.match(activity.match(/topResumedActivity=.*$/m)?.[0] ?? '', /dev\.dshmobile\.validation\/\.RemoteActivity/);
    const oldUrl = await preview.locator('iframe').getAttribute('src');
    await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
    await page.screenshot({ path: 'artifacts/remote-html-android.png' });
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('iframe').length === 0);
    const blocked = page.waitForResponse(response => response.url() === oldUrl && response.status() === 403);
    await page.evaluate(url => { const node = document.createElement('iframe'); node.id = 'closed-html-probe'; node.sandbox = 'allow-scripts'; node.src = url; document.body.append(node); }, oldUrl);
    await blocked;
    await page.evaluate(() => document.getElementById('closed-html-probe').remove());
    assert.equal((await device.shell('run-as dev.dshmobile.validation ls cache/remote-html')).toString().trim(), '');
    await writeFile(path, source.replace('DSHM Remote HTML', 'DSHM HTML 最新版'));
    await link.click(); await frame.getByRole('heading', { name: 'DSHM HTML 最新版', exact: true }).waitFor();
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await unlink(cssPath);
    await link.click(); await preview.getByRole('alert').waitFor(); assert.equal(await preview.locator('iframe').count(), 0);
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await writeFile(cssPath, css);
    report.html = { isolation, localScriptAndStyle: true, interactive: true, pickerRejected: true, closeInvalidatesUrl: true,
      stagingEmpty: true, refreshedLatest: true, missingDependencyRejected: true };
  }
  if (process.argv.includes('--share')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Share test requires DSHM_RUN_LIVE=1');
    const name = `dshm-share-${Date.now()}.bin`, path = resolve('artifacts', name).replaceAll('\\', '/');
    await writeFile(path, 'DSHM_SHARE_OLD_PREVIEW');
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是完整文件分享验证，不调用工具。只原样输出这个 Markdown 链接：[分享验证文件](${path})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const link = history.getByRole('article', { name: '模型回复' }).getByRole('button', { name: '分享验证文件', exact: true }).last();
    await link.waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await link.click(); await preview.getByText('DSHM_SHARE_OLD_PREVIEW', { exact: true }).waitFor();
    const bytes = Buffer.alloc(3 * 1024 * 1024 + 19); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    await writeFile(path, bytes);
    const chooser = async () => {
      await device.shell('uiautomator dump /data/local/tmp/dshm-share-test.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-share-test.xml')).toString();
      return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
        .filter(node => ['android', 'com.android.intentresolver'].includes(node.package) && node.text === 'DSHM 分享验收');
    };
    await device.shell('run-as dev.dshmobile.validation.test rm -f files/remote-share-result.json');
    await preview.getByRole('button', { name: '分享完整文件', exact: true }).click();
    let nodes = [];
    for (let attempt = 0; attempt < 10 && !nodes.length; attempt++) nodes = await chooser();
    assert.equal(nodes.length, 1, 'Expected independent test receiver in actual Android sharesheet');
    const bounds = nodes[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((bounds[0] + bounds[2]) / 2)} ${Math.floor((bounds[1] + bounds[3]) / 2)}`);
    let received;
    for (let attempt = 0; attempt < 20; attempt++) {
      const raw = (await device.shell('run-as dev.dshmobile.validation.test cat files/remote-share-result.json')).toString();
      try { received = JSON.parse(raw); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    assert.ok(received, 'Independent receiver must read actual content URI');
    assert.equal(received.error, undefined);
    assert.equal(received.bytes, bytes.length); assert.equal(received.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(received.name, name); assert.equal(received.scheme, 'content');
    assert.equal(received.writeRejected, true); assert.equal(received.unrelatedRejected, true);
    assert.notEqual(received.uid, Number((await device.shell('run-as dev.dshmobile.validation id -u')).toString().trim()));
    await preview.getByText('已打开系统分享面板。', { exact: true }).waitFor();
    // 系统面板取消只保留“已打开”，不能显示“已发送/已分享”。
    await preview.getByRole('button', { name: '分享完整文件', exact: true }).click();
    nodes = [];
    for (let attempt = 0; attempt < 10 && !nodes.length; attempt++) nodes = await chooser();
    assert.equal(nodes.length, 1);
    await device.shell('input keyevent 4');
    await preview.getByText('已打开系统分享面板。', { exact: true }).waitFor();
    assert.equal(await preview.getByText(/已发送|已分享/).count(), 0);
    await writeFile(path, Buffer.alloc(32 * 1024 * 1024, 19));
    await preview.getByRole('button', { name: '分享完整文件', exact: true }).click();
    await preview.getByRole('button', { name: '取消分享', exact: true }).click();
    await preview.getByText('已取消分享。', { exact: true }).waitFor();
    assert.equal((await device.shell('run-as dev.dshmobile.validation ls cache/remote-downloads')).toString().trim(), '');
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    // 只清理本次独立测试产生的两个分享快照，保留用户的任何其他分享。
    const paths = (await device.shell(`run-as dev.dshmobile.validation find cache/remote-shares -type f -name ${name}`)).toString().trim().split(/\r?\n/).filter(Boolean);
    for (const value of paths) {
      assert.match(value, new RegExp(`^cache/remote-shares/[0-9a-f-]{36}/${name.replaceAll('.', '\\.')}\\s*$`));
      await device.shell(`run-as dev.dshmobile.validation rm ${value}`);
      await device.shell(`run-as dev.dshmobile.validation rmdir ${value.slice(0, value.lastIndexOf('/'))}`);
    }
    report.share = { ...received, latestCompleteFile: true, independentReceiver: true, systemCancelNotReportedSent: true, prepareCancelCleaned: true };
  }
  if (process.argv.includes('--pdf')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'PDF test requires DSHM_RUN_LIVE=1');
    const path = resolve('artifacts', `dshm-pdf-${Date.now()}.pdf`).replaceAll('\\', '/');
    await writeFile(path, pdfFixture());
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是 PDF 预览验证，不调用工具。只原样输出这个 Markdown 链接：[PDF 验证文件](${path})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const link = history.getByRole('article', { name: '模型回复' }).getByRole('button', { name: 'PDF 验证文件', exact: true }).last();
    await link.waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await page.evaluate(() => {
      window.__dshmOriginalWorker = window.Worker;
      const workers = window.__dshmPdfWorkers = new Set();
      window.Worker = class extends window.__dshmOriginalWorker {
        constructor(...args) { super(...args); workers.add(this); }
        terminate() { workers.delete(this); return super.terminate(); }
      };
    });
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    try {
      await link.click();
      for (const number of [1, 2]) {
        const canvas = preview.getByRole('img', { name: `PDF 第 ${number} 页`, exact: true });
        await canvas.waitFor({ state: 'visible', timeout: 30000 });
        const pixel = await canvas.evaluate(element => [...element.getContext('2d').getImageData(element.width / 2, element.height / 2, 1, 1).data]);
        assert.ok(number === 1 ? pixel[0] > pixel[2] : pixel[2] > pixel[0]);
      }
      assert.equal(await preview.locator('[data-pdf-text]').filter({ hasText: 'Selectable PDF text' }).count(), 2);
      const selection = await preview.locator('[data-pdf-text]').first().evaluate(layer => {
        const span = [...layer.querySelectorAll('span')].find(item => item.textContent === 'Selectable PDF text');
        const range = document.createRange(); range.selectNodeContents(span);
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        const rect = range.getBoundingClientRect(), canvas = layer.parentElement.querySelector('canvas').getBoundingClientRect();
        const result = { text: selection.toString(), width: rect.width, height: rect.height,
          withinPage: rect.left >= canvas.left - 1 && rect.right <= canvas.right + 1 && rect.top >= canvas.top - 1 && rect.bottom <= canvas.bottom + 1 };
        selection.removeAllRanges(); return result;
      });
      assert.equal(selection.text, 'Selectable PDF text');
      assert.ok(selection.width > 0 && selection.height > 0 && selection.withinPage);
      assert.equal(await page.evaluate(() => window.__dshmPdfWorkers.size), 1);
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      await page.screenshot({ path: 'artifacts/remote-pdf-android.png' });
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await page.waitForFunction(() => window.__dshmPdfWorkers.size === 0);
      await writeFile(path, 'damaged PDF');
      await link.click();
      await preview.getByRole('alert').filter({ hasText: '无法显示 PDF' }).waitFor();
      assert.equal(await preview.locator('canvas:visible').count(), 0);
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await page.waitForFunction(() => window.__dshmPdfWorkers.size === 0);
      await writeFile(path, pdfFixture());
      await page.evaluate(() => { window.Worker = class { constructor() { throw new Error('DSHM_WORKER_FAILURE_TEST'); } }; });
      await link.click();
      await preview.getByRole('alert').filter({ hasText: '无法显示 PDF' }).waitFor();
      assert.equal(await preview.locator('canvas:visible').count(), 0);
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      report.pdf = { twoPagesRendered: true, selectableText: true, selectionBounds: selection, realWorker: true, workerReleased: true, corruptFileRejected: true, workerFailureDoesNotFallback: true };
    } finally {
      if (await preview.count()) await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      await page.evaluate(() => { window.Worker = window.__dshmOriginalWorker; delete window.__dshmOriginalWorker; delete window.__dshmPdfWorkers; });
    }
  }
  if (process.argv.includes('--image')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Image test requires DSHM_RUN_LIVE=1');
    const stem = `dshm-image-${Date.now()}`;
    const svgPath = resolve('artifacts', `${stem}.svg`).replaceAll('\\', '/');
    const pngPath = resolve('artifacts', `${stem}.png`).replaceAll('\\', '/');
    await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#315bc7"/><circle cx="320" cy="160" r="70" fill="#fff"/><text x="320" y="280" text-anchor="middle" fill="white" font-size="28">DSHM Remote Image</text><script>parent.document.documentElement.dataset.remoteSvgExecuted="yes"</script></svg>');
    await writeFile(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是图片预览验证，不调用工具。只原样输出下面两个 Markdown 链接：\n[SVG 图片](${svgPath})\n[PNG 图片](${pngPath})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const reply = history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'SVG 图片' }).last();
    await reply.getByRole('button', { name: 'PNG 图片', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    for (const [label, width] of [['SVG 图片', 640], ['PNG 图片', 1]]) {
      await reply.getByRole('button', { name: label, exact: true }).click();
      const img = preview.locator('img');
      await img.waitFor({ state: 'visible' });
      assert.equal(await img.evaluate(element => element.naturalWidth), width);
      const url = await img.getAttribute('src');
      assert.ok(url.startsWith('blob:https://remote.dshm.invalid/'));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.remoteSvgExecuted), undefined);
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      const bounds = await preview.evaluate(element => ({ height: element.getBoundingClientRect().height, viewport: innerHeight, width: element.getBoundingClientRect().width, viewportWidth: innerWidth }));
      assert.ok(Math.abs(bounds.height - bounds.viewport) <= 1);
      assert.ok(Math.abs(bounds.width - bounds.viewportWidth) <= 1);
      if (width === 640) await page.screenshot({ path: 'artifacts/remote-image-fullscreen-android.png' });
      await preview.getByRole('button', { name: '缩小窗口', exact: true }).click();
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      // 用允许 blob: 的图片通道验证撤销；fetch 会被 connect-src 拒绝，不能证明 URL 已释放。
      assert.equal(await page.evaluate(value => new Promise(resolve => {
        const probe = new Image(); probe.onload = () => resolve(false); probe.onerror = () => resolve(true); probe.src = value;
      }), url), true);
    }
    await writeFile(pngPath, 'damaged image');
    await reply.getByRole('button', { name: 'PNG 图片', exact: true }).click();
    await preview.getByRole('alert').filter({ hasText: '无法显示这张图片' }).waitFor();
    assert.equal(await preview.locator('img:visible').count(), 0);
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    report.images = { svg: true, png: true, fullScreen: true, svgScriptInactive: true, closedUrlsRevoked: true, corruptImageRejected: true };
  }
  if (process.argv.includes('--download')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Download test requires DSHM_RUN_LIVE=1');
    const filename = `dshm-download-${Date.now()}.bin`;
    const path = resolve('artifacts', filename).replaceAll('\\', '/');
    await writeFile(path, 'DSHM OLD PREVIEW\n');
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是下载界面验证，不调用工具。只原样输出这个 Markdown 链接：[下载验证文件](${path})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const link = history.getByRole('article', { name: '模型回复' }).getByRole('button', { name: '下载验证文件', exact: true }).last();
    await link.waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await link.click();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await preview.locator('pre').filter({ hasText: 'DSHM OLD PREVIEW' }).waitFor();
    const bytes = Buffer.alloc(3 * 1024 * 1024 + 19);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    await writeFile(path, bytes);
    await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await preview.getByText('请选择保存位置…', { exact: true }).waitFor();
    let nodes = await pickerNodes(device);
    assert.equal(nodes.find(node => node.class === 'android.widget.EditText')?.text, filename);
    if (!nodes.some(node => node.text === '下载')) {
      await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
      await tapPickerNode(device, node => node.text === '下载');
    }
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    await preview.getByText('已保存到所选位置。', { exact: true }).waitFor();
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal((await device.shell(`sha256sum /sdcard/Download/${filename}`)).toString().split(/\s/)[0], hash);
    await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await preview.getByText('请选择保存位置…', { exact: true }).waitFor();
    await device.shell('input keyevent KEYCODE_BACK');
    await preview.getByText('已取消下载。', { exact: true }).waitFor();
    await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await preview.getByRole('button', { name: '取消下载', exact: true }).click();
    await preview.getByText('已取消下载。', { exact: true }).waitFor();
    assert.equal((await device.shell('run-as dev.dshmobile.validation ls cache/remote-downloads')).toString().trim(), '');
    report.download = { filename, bytes: bytes.length, sha256: hash, latestNotPreview: true, systemPickerCanceled: true, transferCanceled: true, stagingEmpty: true };
    await page.screenshot({ path: 'artifacts/remote-download-android.png' });
    if (process.argv.includes('--download-offline')) {
      // 仅停止调用者当场核对过的本项目测试网关，验证后恢复同一入口；不修改设备权限。
      const gatewayPid = Number(process.env.DSHM_VERIFIED_GATEWAY_PID);
      assert.ok(Number.isSafeInteger(gatewayPid) && gatewayPid > 0);
      await writeFile(path, Buffer.alloc(32 * 1024 * 1024, 71));
      await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
      await preview.getByRole('status').filter({ hasText: /^正在下载 · [1-9]/ }).waitFor();
      process.kill(gatewayPid);
      try {
        await page.getByTestId('remote-state').filter({ hasText: '连接已断开' }).waitFor();
        assert.equal(await page.getByRole('dialog', { name: '文件预览', exact: true }).count(), 0);
        assert.equal((await device.shell('run-as dev.dshmobile.validation ls cache/remote-downloads')).toString().trim(), '');
        report.download.offlineClearsTransfer = true;
      } finally {
        const gateway = spawn(process.execPath, ['--env-file=.env.local', 'packages/gateway/dist/main.js'], { cwd: resolve('../backend'), windowsHide: true, detached: true, stdio: 'ignore' });
        await new Promise((resolve, reject) => { gateway.once('spawn', resolve); gateway.once('error', reject); });
        gateway.unref(); report.gatewayPid = gateway.pid;
        await writeFile(path, bytes);
      }
      for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch('http://127.0.0.1:8787/v1/server-info', { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      // 网关监听恢复不代表电脑已重连；旧 HTTP 连接也可能在首次访问时失效。
      // 这里只重试用户的连接操作，绝不恢复下载或重发聊天消息。
      report.download.reconnectAttempts = [];
      const reconnectDeadline = Date.now() + 45000;
      while (!await page.getByTestId('remote-workspace').count()) {
        assert.ok(Date.now() < reconnectDeadline, 'Remote did not reconnect after gateway restart');
        await page.getByRole('button', { name: '重新连接', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"]')
          || (document.querySelector('[data-testid="remote-page"] [role="alert"]')
            && ![...document.querySelectorAll('button')].find(button => button.textContent === '重新连接')?.disabled));
        if (!await page.getByTestId('remote-workspace').count()) {
          report.download.reconnectAttempts.push(await page.getByTestId('remote-page').getByRole('alert').innerText());
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else report.download.reconnectAttempts.push('connected');
      }
      await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
      await history.getByRole('article', { name: '模型回复' }).first().waitFor();
      report.download.reconnectedWithoutResume = true;
      assert.equal(await page.getByRole('button', { name: '取消下载', exact: true }).count(), 0);
    } else await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  }
  if (process.argv.includes('--file-rich')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'File link test requires DSHM_RUN_LIVE=1');
    const textPath = resolve('artifacts/dshm-file-preview-live.txt').replaceAll('\\', '/');
    const markdownPath = resolve('artifacts/dshm-file-preview-live.md').replaceAll('\\', '/');
    const original = `${'a'.repeat(65535)}中文跨块\n完整末尾\n`;
    await writeFile(textPath, original);
    await writeFile(markdownPath, '# DSHM 文件预览\n\n**真实 Markdown**\n\n- 第一项\n- 第二项\n');
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是文件链接界面验证，不调用工具。请原样输出下面两个 Markdown 链接，不添加其他文字：\n[跨分片文本](${textPath})\n[Markdown 文件](${markdownPath})`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const reply = history.getByRole('article', { name: '模型回复' }).filter({ hasText: '跨分片文本' }).last();
    const textLink = reply.getByRole('button', { name: '跨分片文本', exact: true });
    await textLink.waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await textLink.click();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await preview.locator('pre').filter({ hasText: '完整末尾' }).waitFor();
    assert.equal(await preview.locator('pre').textContent(), original);
    await writeFile(textPath, 'DSHM 最新内容 第二版\n');
    await preview.getByRole('button', { name: '重新读取', exact: true }).click();
    await preview.locator('pre').filter({ hasText: 'DSHM 最新内容 第二版' }).waitFor();
    await unlink(textPath);
    await preview.getByRole('button', { name: '重新读取', exact: true }).click();
    await preview.getByRole('alert').filter({ hasText: '文件已被删除或移动' }).waitFor();
    assert.equal(await preview.locator('pre').count(), 0);
    await writeFile(textPath, 'DSHM 最新内容 第二版\n');
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await reply.getByRole('button', { name: 'Markdown 文件', exact: true }).click();
    await preview.getByRole('heading', { name: 'DSHM 文件预览', exact: true }).waitFor();
    await preview.getByRole('button', { name: '源码', exact: true }).click();
    await preview.locator('pre').filter({ hasText: '**真实 Markdown**' }).waitFor();
    report.fileLinkPreview = { crossChunkChinese: true, latestRefresh: true, deletedClearsOldContent: true, markdownAndSource: true };
    await page.screenshot({ path: 'artifacts/remote-markdown-preview-android.png' });
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  }
  if (process.argv.includes('--file')) {
    const link = history.locator('.remote-file-link').filter({ hasText: 'dshm-approval-test-20260923.txt' }).last();
    const card = history.locator('details.remote-tool-card').filter({ has: page.locator('.remote-file-link').filter({ hasText: 'dshm-approval-test-20260923.txt' }) }).last();
    await card.locator('summary').first().click();
    await link.click();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await preview.locator('pre').filter({ hasText: 'DSHM_APPROVAL_OK' }).waitFor();
    const text = await preview.locator('pre').innerText();
    assert.equal(text.trim(), 'DSHM_APPROVAL_OK');
    await preview.getByRole('button', { name: '重新读取', exact: true }).click();
    await preview.locator('pre').filter({ hasText: 'DSHM_APPROVAL_OK' }).waitFor();
    assert.equal(await preview.locator('pre').innerText(), text);
    report.filePreview = { path: 'dshm-approval-test-20260923.txt', contentMatches: true, refreshed: true };
    await page.screenshot({ path: 'artifacts/remote-file-preview-android.png' });
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await preview.waitFor({ state: 'detached' });
  }
  if (process.argv.includes('--manage')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Management test requires DSHM_RUN_LIVE=1');
    const options = async name => {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name, exact: true }).click();
    };
    if (!resumeBlank) {
      await options('新建聊天');
      await page.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
      await page.locator('.remote-heading').filter({ hasText: /^DSH-TEST$/ }).waitFor();
    }
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 DSHM 会话管理专用验证，请只回复 DSHM_MANAGEMENT_READY，不调用工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_MANAGEMENT_READY' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    await options('重命名聊天');
    const managedTitle = `DSHM 会话管理联调 ${Date.now()}`;
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(managedTitle);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.locator('.remote-heading').filter({ hasText: managedTitle }).waitFor();
    await options('归档聊天');
    await options('查看已归档聊天');
    await page.getByRole('button', { name: new RegExp(`^${managedTitle}`) }).click();
    await options('取消归档');
    await options('查看最近聊天');
    await page.getByRole('button', { name: new RegExp(`^${managedTitle}`) }).click();
    await options('在新聊天中分支');
    await page.locator('.remote-heading').filter({ hasText: new RegExp(`${managedTitle}.+`) }).waitFor();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_MANAGEMENT_READY' }).waitFor();
    assert.equal(await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_MANAGEMENT_READY' }).count(), 1);
    report.createdRenamedArchivedRestoredForked = { originalTitle: managedTitle, branchTitle: await heading.innerText() };
    await options('归档聊天');
    await page.getByRole('button', { name: new RegExp(`^${managedTitle}`) }).click();
    await options('归档聊天');
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  }
  if (process.argv.includes('--queue')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Queue test requires DSHM_RUN_LIVE=1');
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    await input.fill('这是 DSHM 队列联调。请仅调用 ask_user_question，问“是否继续队列验证？”，选项“继续验证”和“暂不继续”。收到选择后只回复 QUEUE_GATE_READY，不调用其他工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const question = page.getByRole('region', { name: '等待回答', exact: true });
    await question.waitFor({ timeout: 60000 });
    await input.fill('队列测试，请只回复 QUEUE_ORIGINAL，不调用工具。');
    await page.getByRole('button', { name: '加入队列', exact: true }).click();
    const queue = page.getByLabel('待发送队列', { exact: true });
    await queue.getByRole('button', { name: '编辑', exact: true }).click();
    await queue.getByRole('textbox', { name: '编辑排队消息', exact: true }).fill('请只回复 DSHM_SHARED_QUEUE_OK_20260924，不调用工具。');
    await queue.getByRole('button', { name: '保存修改', exact: true }).click();
    await queue.getByText('请只回复 DSHM_SHARED_QUEUE_OK_20260924，不调用工具。', { exact: true }).waitFor();
    await input.fill('这条待取消消息不应该执行。');
    await page.getByRole('button', { name: '加入队列', exact: true }).click();
    const cancelled = queue.locator('.remote-queue-row').filter({ hasText: '这条待取消消息不应该执行。' });
    await cancelled.getByRole('button', { name: '取消排队', exact: true }).click();
    await cancelled.waitFor({ state: 'detached' });
    await question.getByRole('radio', { name: /^继续验证/ }).check();
    await question.getByRole('button', { name: '提交回答', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_SHARED_QUEUE_OK_20260924' }).last().waitFor({ timeout: 60000 });
    await queue.waitFor({ state: 'detached' });
    assert.equal((await history.innerText()).includes('这条待取消消息不应该执行。'), false);
    report.queueEditedCancelledAndExecuted = true;
  }
  if (process.argv.includes('--question')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Question test requires DSHM_RUN_LIVE=1');
    const marker = `DSHM_CORE_QUESTION_${Date.now()}`;
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '', '不覆盖用户草稿');
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是 DSHM 自有页面提问联调。请仅调用 ask_user_question，问“是否继续新版聊天验证？”，选项“继续验证”和“暂不继续”。收到我的选择后只回复 ${marker}，不调用其他工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const question = page.getByRole('region', { name: '等待回答', exact: true });
    await question.waitFor({ timeout: 60000 });
    await page.getByRole('textbox', { name: '消息', exact: true }).focus();
    await page.getByRole('button', { name: /^选择模型，当前 / }).click();
    const models = page.getByRole('dialog', { name: '选择模型', exact: true });
    await models.getByText('回复进行中，结束后可切换模型。', { exact: true }).waitFor();
    const choices = await models.locator('button[aria-pressed]').all();
    assert.ok(choices.length > 0);
    for (const choice of choices) assert.equal(await choice.isEnabled(), false);
    await models.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.runningModelDisabled = true;
    await question.getByRole('radio', { name: /^继续验证/ }).check();
    await question.getByRole('button', { name: '提交回答', exact: true }).click();
    await question.waitFor({ state: 'detached' });
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).last().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
    report.questionAnswered = { marker, completed: true };
  }
  if (process.argv.includes('--upload')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Uploading requires DSHM_RUN_LIVE=1');
    const filename = 'dshm-shared-upload-20260924.txt';
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
    await chooseDownload(device, filename);
    await page.getByLabel('待发送附件', { exact: true }).getByText(/已上传/).waitFor();
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 DSHM 新版附件联调，请读取附件，只回复文件第一行。不修改文件，不运行命令。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_SHARED_UPLOAD_OK_20260924' }).last().waitFor({ timeout: 60000 });
    await page.getByLabel('待发送附件', { exact: true }).waitFor({ state: 'detached' });
    report.uploadReadBack = true;
  }
  if (process.argv.includes('--send')) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Sending requires DSHM_RUN_LIVE=1');
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 DSHM 自有聊天页面联调，请只回复 DSHM_SHARED_CHAT_OK_20260924，不调用工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_SHARED_CHAT_OK_20260924' }).last().waitFor({ timeout: 60000 });
    report.sentAndReceived = true;
  }
  await history.getByRole('article', { name: '模型回复' }).first().waitFor();
  report.body = await page.locator('body').innerText();
  report.localPage = new URL(page.url()).pathname;
  report.assistantMessages = await history.getByRole('article', { name: '模型回复' }).count();
  report.composerCount = await page.locator('[data-composer-card]').count();
  if (process.argv.includes('--layout')) report.icons = await page.getByTestId('remote-workspace').locator('button.icon-button').evaluateAll(elements => elements.map(button => {
    const svg = button.querySelector('svg'), path = svg?.querySelector('path');
    return { label: button.getAttribute('aria-label'), color: getComputedStyle(button).color, opacity: getComputedStyle(button).opacity,
      svg: svg && { width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, color: getComputedStyle(svg).color, visibility: getComputedStyle(svg).visibility },
      fill: path && getComputedStyle(path).fill, stroke: path && getComputedStyle(path).stroke };
  }));
  assert.equal(report.composerCount, 1);
  assert.equal(await page.locator('iframe').count(), 0);
  if (process.argv.includes('--plugins') || process.argv.includes('--models') || process.argv.includes('--skills') || process.argv.includes('--permissions') || process.argv.includes('--agent-presets') || process.argv.includes('--goals')) { assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); }
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/remote-mobile-android.png' });
  await writeFile('artifacts/remote-mobile-android.json', JSON.stringify(report, null, 2));
  const variant = ['goals', 'agent-presets', 'permissions', 'skills', 'models', 'plugins', 'fork-availability', 'turn-fork', 'commands-live', 'commands-resume', 'changes', 'changes-resume', 'changes-expired', 'inline-images', 'office-attachment', 'html-attachment', 'image-input-rejection', 'image-input', 'attachment-image', 'attachment', 'office', 'html', 'share', 'pdf', 'image', 'download', 'file-rich', 'file', 'manage', 'queue', 'question', 'upload', 'send'].find(name => process.argv.includes(`--${name}`));
  if (variant) await writeFile(`artifacts/remote-mobile-${variant}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  await writeFile('artifacts/remote-mobile-failed-android.json', JSON.stringify({ ...report, failure: error.message }, null, 2));
  console.error(JSON.stringify({ errors: report.errors, resources: report.resources }));
  throw error;
} finally { await device.close(); }
