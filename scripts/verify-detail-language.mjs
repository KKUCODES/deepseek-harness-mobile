import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 只从专用联调会话读取已存在的真实记录，不发送模型消息、命令或文件写入。
export async function verifyDetailLanguage(page, device, changeLanguage, checks) {
  const command = JSON.parse(await readFile('artifacts/remote-command-fixture.json', 'utf8'));
  const changes = JSON.parse(await readFile('artifacts/remote-changes-fixture.json', 'utf8'));
  const tool = page.locator('details.remote-tool-card').filter({ hasText: command.marker }).last();
  async function loadUntil(locator) {
    for (let count = 0; !await locator.count() && count < 50; count++) {
      const older = page.getByRole('button', { name: 'Load earlier messages', exact: true });
      if (!await older.count()) break;
      await older.click();
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Load earlier messages' && button.disabled));
    }
    await locator.waitFor();
  }
  await loadUntil(tool);
  if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
  await tool.getByRole('button', { name: 'View command details', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Command details', exact: true });
  await dialog.getByRole('status').filter({ hasText: 'Failed' }).waitFor();
  if (await dialog.getByRole('button', { name: 'Result', exact: true }).count()) await dialog.getByRole('button', { name: 'Result', exact: true }).click();
  assert.match(await dialog.innerText(), /Exit code 7/);
  await dialog.getByText('Full command', { exact: true }).click();
  const originalCommand = await dialog.locator('pre.remote-command-source').innerText();
  assert.ok(originalCommand.includes(command.marker));
  await dialog.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await device.screenshot({ path: 'artifacts/detail-language-command-en.png' });
  await changeLanguage('zh');
  dialog = page.getByRole('dialog', { name: '命令详情', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('pre.remote-command-source').innerText(), originalCommand);
  assert.ok((await dialog.getAttribute('class')).includes('is-fullscreen'));
  assert.match(await dialog.innerText(), /退出码 7/);
  await changeLanguage('en');
  await page.getByRole('button', { name: 'Close command details', exact: true }).click();
  checks.push('Real failed command: English status/exit code, original command retained across language changes, fullscreen preserved');

  const edit = page.locator('details.remote-tool-card').filter({ hasText: changes.paths[0].split('/').at(-1) })
    .filter({ has: page.locator('summary').filter({ hasText: /^edit ·/ }) }).last();
  await loadUntil(edit);
  if (await edit.getAttribute('open') === null) await edit.locator(':scope > summary').click();
  await edit.getByRole('button', { name: 'View these changes', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'File preview', exact: true });
  const body = dialog.locator('.remote-file-preview-body');
  await body.getByText('DSHM_DIFF_AFTER', { exact: false }).waitFor();
  assert.match(await body.innerText(), /DSHM_DIFF_BEFORE/);
  await dialog.getByRole('button', { name: 'Latest complete file', exact: true }).click();
  await body.getByText('DSHM_CURRENT_THIRD_VERSION', { exact: false }).waitFor();
  const originalFile = await body.innerText();
  await dialog.getByRole('button', { name: 'Open on computer', exact: true }).click();
  await dialog.getByRole('group', { name: 'Confirm opening on computer', exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await changeLanguage('zh');
  dialog = page.getByRole('dialog', { name: '文件预览', exact: true });
  await dialog.getByRole('button', { name: '下载最新完整文件', exact: true }).waitFor();
  assert.equal(await dialog.locator('.remote-file-preview-body').innerText(), originalFile);
  await changeLanguage('en');
  dialog = page.getByRole('dialog', { name: 'File preview', exact: true });
  await dialog.getByRole('button', { name: 'This change', exact: true }).click();
  await dialog.locator('.remote-file-preview-body').getByText('DSHM_DIFF_AFTER', { exact: false }).waitFor();
  await device.screenshot({ path: 'artifacts/detail-language-diff-en.png' });
  await dialog.getByRole('button', { name: 'Close file preview', exact: true }).click();
  checks.push('Historical tool diff vs latest full file preserved; desktop confirmation opened then canceled; file preview retained across language changes');

  await page.getByRole('button', { name: /^View file changes from turn / }).last().click();
  dialog = page.getByRole('dialog', { name: 'Files changed in this turn', exact: true });
  await dialog.getByRole('alert').filter({ hasText: 'The computer no longer retains this turn' }).waitFor();
  await changeLanguage('zh');
  await page.getByRole('dialog', { name: '本轮文件改动', exact: true }).getByRole('alert').filter({ hasText: '电脑已不再保留这轮改动记录' }).waitFor();
  await changeLanguage('en');
  await page.getByRole('button', { name: 'Close changes preview', exact: true }).click();
  checks.push('Expired real turn snapshot error switches language in the open preview');

  // 旧 PNG 用例最后故意留下损坏文件；用 SVG 核验成功态，用 PNG 核验失败态。
  for (const [name, kind] of [['PDF 验证文件', 'pdf'], ['SVG 图片', 'image'], ['PNG 图片', 'broken-image'], ['HTML 验证文件', 'html']]) {
    const link = page.getByRole('article', { name: 'Assistant response', exact: true }).getByRole('button', { name, exact: true }).last();
    await loadUntil(link); await link.click();
    dialog = page.getByRole('dialog', { name: 'File preview', exact: true });
    if (kind === 'pdf') await dialog.getByRole('img', { name: 'PDF page 1', exact: true }).waitFor();
    if (kind === 'image') await dialog.getByRole('img', { name: /^Image preview:/ }).waitFor();
    if (kind === 'broken-image') await dialog.getByRole('alert').filter({ hasText: 'This image could not be displayed.' }).waitFor();
    if (kind === 'html') {
      await dialog.locator('iframe[title="HTML file preview"]').waitFor();
      const frame = await (await dialog.locator('iframe').elementHandle()).contentFrame();
      assert.deepEqual(await frame.evaluate(() => {
        let parentBlocked = false; try { void parent.document; } catch { parentBlocked = true; }
        return { remoteBridge: typeof window.DSHMRemote, ordinaryBridge: typeof window.DSHMOrdinary, parentBlocked };
      }), { remoteBridge: 'undefined', ordinaryBridge: 'undefined', parentBlocked: true });
      await frame.getByRole('button', { name: '计数 0', exact: true }).click();
      await frame.getByRole('button', { name: '计数 1', exact: true }).waitFor();
    }
    const resource = kind === 'image' ? await dialog.locator('img').getAttribute('src') : kind === 'html' ? await dialog.locator('iframe').getAttribute('src') : null;
    const canvas = kind === 'pdf' ? await dialog.getByRole('img', { name: 'PDF page 1', exact: true }).elementHandle() : null;
    await device.screenshot({ path: `artifacts/detail-language-${kind}-en.png` });
    await changeLanguage('zh');
    dialog = page.getByRole('dialog', { name: '文件预览', exact: true });
    if (kind === 'pdf') await dialog.getByRole('img', { name: 'PDF 第 1 页', exact: true }).waitFor();
    if (kind === 'image') await dialog.getByRole('img', { name: /^图片预览：/ }).waitFor();
    if (kind === 'broken-image') await dialog.getByRole('alert').filter({ hasText: '无法显示这张图片' }).waitFor();
    if (kind === 'html') {
      await dialog.locator('iframe[title="HTML 文件预览"]').waitFor();
      await dialog.frameLocator('iframe').getByRole('button', { name: '计数 1', exact: true }).waitFor();
    }
    if (resource) assert.equal(await dialog.locator(kind === 'image' ? 'img' : 'iframe').getAttribute('src'), resource);
    if (canvas) assert.equal(await canvas.evaluate(element => element.isConnected), true);
    await changeLanguage('en');
    await page.getByRole('button', { name: 'Close file preview', exact: true }).click();
    checks.push(`Real ${kind} preview and accessible labels switch language in place`);
  }
  return checks;
}
