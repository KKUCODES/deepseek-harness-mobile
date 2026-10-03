import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 专用会话内创建两份独立样例；恢复检查不重发模型消息。 */
export async function verifyChanges(page, history) {
  const manifest = resolve('artifacts/remote-changes-fixture.json');
  let fixture;
  if (process.argv.includes('--changes-resume')) fixture = JSON.parse(await readFile(manifest, 'utf8'));
  else {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const stamp = Date.now();
    fixture = { marker: `DSHM_DIFF_DONE_${stamp}`, approvals: 0, paths: ['a', 'b'].map(suffix => resolve(`artifacts/dshm-changes-${stamp}-${suffix}.txt`).replaceAll('\\', '/')),
      before: '保留第一行\nDSHM_DIFF_BEFORE\n保留最后一行\n', after: '保留第一行\nDSHM_DIFF_AFTER\n保留最后一行\n', latest: 'DSHM_CURRENT_THIRD_VERSION\n当前完整文件\n' };
    for (const path of fixture.paths) await writeFile(path, fixture.before);
    await writeFile(manifest, JSON.stringify(fixture, null, 2));
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    assert.equal(await input.inputValue(), '', '不覆盖用户草稿');
    await input.fill(`这是文件差异联调，只处理以下两个独立测试文件：${fixture.paths.join(' 和 ')}。分别用 read 读取，再用 edit 将 DSHM_DIFF_BEFORE 替换成 DSHM_DIFF_AFTER，保留其他内容。如权限不足，请为 edit 请求单次批准。不执行命令，不修改其他文件。完成后只回复 ${fixture.marker}。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  const done = history.getByRole('article', { name: '模型回复' }).filter({ hasText: fixture.marker ?? 'DSHM_DIFF_DONE' }).last();
  const deadline = Date.now() + 180000;
  while (!await done.count() && Date.now() < deadline) {
    const approval = page.getByRole('region', { name: '等待审批' });
    if (await approval.count()) {
      const text = await approval.first().innerText();
      assert.match(text, /edit/);
      await approval.first().getByRole('button', { name: '允许一次', exact: true }).click();
      fixture.approvals = (fixture.approvals ?? 0) + 1;
      await writeFile(manifest, JSON.stringify(fixture, null, 2));
    }
    await page.waitForTimeout(500);
  }
  await done.waitFor({ timeout: 1000 });
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  if (!process.argv.includes('--changes-resume')) for (const path of fixture.paths) assert.equal(await readFile(path, 'utf8'), fixture.after);
  const tools = history.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^edit · 已完成/ }) });
  const tool = tools.filter({ hasText: fixture.paths[0].split('/').at(-1) }).last();
  if (await tool.getAttribute('open') === null) await tool.locator('summary').click();
  await tool.getByRole('button', { name: '查看本次修改', exact: true }).click();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  const body = preview.locator('.remote-file-preview-body');
  assert.match(await body.innerText(), /DSHM_DIFF_BEFORE/); assert.match(await body.innerText(), /DSHM_DIFF_AFTER/);
  assert.equal(await preview.getByRole('button', { name: '重新读取', exact: true }).count(), 0);
  await writeFile(fixture.paths[0], fixture.latest);
  await preview.getByRole('button', { name: '最新完整文件', exact: true }).click();
  await body.getByText('DSHM_CURRENT_THIRD_VERSION', { exact: false }).waitFor();
  await preview.getByRole('button', { name: '本次修改', exact: true }).click();
  assert.doesNotMatch(await body.innerText(), /DSHM_CURRENT_THIRD_VERSION/);
  await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
  await page.screenshot({ path: 'artifacts/remote-tool-diff-android.png' });
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();

  const changes = history.getByRole('button', { name: /^查看第 \d+ 轮文件改动$/ }).last();
  await changes.waitFor(); await changes.click();
  const recorded = page.getByRole('dialog', { name: '本轮文件改动', exact: true });
  const selector = recorded.getByRole('combobox', { name: '选择改动文件', exact: true });
  await selector.waitFor();
  const options = await selector.locator('option').allTextContents();
  assert.equal(options.length, 2);
  for (const path of fixture.paths) assert.ok(options.some(option => option.includes(path.split('/').at(-1))));
  await recorded.locator('[data-diff-line="add"]').filter({ hasText: 'DSHM_DIFF_AFTER' }).waitFor();
  await recorded.locator('[data-diff-line="del"]').filter({ hasText: 'DSHM_DIFF_BEFORE' }).waitFor();
  await selector.selectOption('1');
  await recorded.locator('[data-diff-line="add"]').filter({ hasText: 'DSHM_DIFF_AFTER' }).waitFor();
  await recorded.getByRole('button', { name: '放大窗口', exact: true }).click();
  await page.waitForFunction(() => {
    const box = document.querySelector('.remote-file-preview.is-fullscreen'), rect = box?.getBoundingClientRect();
    return rect && Math.abs(rect.height - innerHeight) < 2 && Math.abs(rect.top) < 2;
  });
  for (const button of await recorded.locator('header button').all()) assert.equal(await button.evaluate(element => {
    const rect = element.getBoundingClientRect(); return rect.width >= 40 && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0;
  }), true);
  await page.screenshot({ path: 'artifacts/remote-turn-diff-android.png' });
  assert.equal(await recorded.evaluate(element => element.scrollWidth > element.clientWidth), false);
  await recorded.getByRole('button', { name: '关闭改动预览', exact: true }).click();

  // 删除最新文件后，原改动快照仍可读；不能用历史内容掩盖当前读取失败。
  await unlink(fixture.paths[1]).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await changes.click(); await selector.waitFor(); await selector.selectOption('1');
  await recorded.locator('[data-diff-line="add"]').filter({ hasText: 'DSHM_DIFF_AFTER' }).waitFor();
  await recorded.getByRole('button', { name: '查看最新完整文件', exact: true }).click();
  await preview.getByRole('alert').waitFor();
  assert.doesNotMatch(await body.innerText(), /DSHM_DIFF_AFTER/);
  const missing = await preview.getByRole('alert').innerText();
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  return { approvals: fixture.approvals ?? '首轮未记录计数', files: fixture.paths, toolDiff: true, currentVersionDistinct: true, recordedFiles: options, deletedCurrentFile: missing, recordedSnapshotPreserved: true };
}

/** 重启真实 DSH 后，整轮快照缺失要明确提示，工具日志的差异仍然保留。 */
export async function verifyExpiredChanges(page, history) {
  const fixture = JSON.parse(await readFile('artifacts/remote-changes-fixture.json', 'utf8'));
  await history.getByRole('button', { name: /^查看第 \d+ 轮文件改动$/ }).last().click();
  const recorded = page.getByRole('dialog', { name: '本轮文件改动', exact: true });
  await recorded.getByRole('alert').filter({ hasText: '电脑已不再保留这轮改动记录' }).waitFor();
  assert.equal(await recorded.locator('[data-diff-line]').count(), 0);
  await recorded.getByRole('button', { name: '关闭改动预览', exact: true }).click();
  const tool = history.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^edit · 已完成/ }), hasText: fixture.paths[0].split('/').at(-1) }).last();
  if (await tool.getAttribute('open') === null) await tool.locator('summary').click();
  await tool.getByRole('button', { name: '查看本次修改', exact: true }).click();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
  assert.match(await preview.locator('.remote-file-preview-body').innerText(), /DSHM_DIFF_BEFORE/);
  assert.match(await preview.locator('.remote-file-preview-body').innerText(), /DSHM_DIFF_AFTER/);
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  return { expiredSnapshotReported: true, durableToolDiffPreserved: true };
}
