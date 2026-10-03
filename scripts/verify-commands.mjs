import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

/** 仅专用联调会话执行固定的打印/等待/退出命令；恢复检查只读原记录。 */
export async function verifyCommands(page, device, history) {
  const previous = page.getByRole('dialog', { name: '命令详情', exact: true });
  if (await previous.count()) await previous.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  let fixture;
  const live = process.argv.includes('--commands-live');
  if (live) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    fixture = { marker: `DSHM_COMMAND_${Date.now()}` };
    await writeFile('artifacts/remote-command-fixture.json', JSON.stringify(fixture));
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    assert.equal(await input.inputValue(), '');
    const escape = String.fromCharCode(27);
    await input.fill(`这是只读命令详情联调。只调用一次 pwsh 工具，description 填“验证命令状态和颜色”，command 精确使用：Write-Output "${fixture.marker}"; Write-Output "${escape}[31mRED_OUTPUT${escape}[0m"; Start-Sleep -Seconds 12; exit 7。彩色输出中包含实际 ESC 字符，在工具 JSON 中使用 Unicode 转义保留该字符，不使用 [char] 转换。run_in_background=false，timeoutMs=25000。不修改文件，不读取文件，不重试，退出码7是预期结果。结束后只回复“命令验证结束”。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  } else fixture = JSON.parse(await readFile('artifacts/remote-command-fixture.json', 'utf8'));
  const tool = history.locator('details.remote-tool-card').filter({ hasText: fixture.marker }).last();
  await tool.waitFor({ timeout: 90000 });
  if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
  await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '命令详情', exact: true });
  await panel.waitFor();
  const runningObserved = await panel.getByRole('status').innerText() === '执行中';
  fixture.runningObserved = fixture.runningObserved || runningObserved;
  await writeFile('artifacts/remote-command-fixture.json', JSON.stringify(fixture));
  if (live) assert.equal(runningObserved, true, '打开窗口时应仍在真实执行');
  await panel.getByRole('status').filter({ hasText: '执行失败' }).waitFor({ timeout: 60000 });
  assert.match(await panel.innerText(), /退出码 7/);
  await panel.getByText('完整命令', { exact: true }).click();
  assert.match(await panel.locator('pre.remote-command-source').innerText(), /Start-Sleep -Seconds 12; exit 7/);
  assert.equal(await panel.locator('textarea,input,[contenteditable=true]').count(), 0);
  const colored = panel.locator('[data-terminal] span[style]').filter({ hasText: 'RED_OUTPUT' }).last();
  // 此电脑的受限 PowerShell 可能在输出管道中移除色码；不把无色文本冒充 ANSI 验收。
  const color = await colored.count() ? await colored.evaluate(element => getComputedStyle(element).color) : null;
  await panel.getByRole('button', { name: '复制输出', exact: true }).click();
  await panel.getByRole('button', { name: '已复制', exact: true }).waitFor();
  await panel.getByRole('button', { name: '放大窗口', exact: true }).click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.remote-command-preview.is-fullscreen'), rect = el?.getBoundingClientRect();
    return rect && rect.top >= -1 && Math.abs(rect.height - innerHeight) < 2 && el.scrollWidth === el.clientWidth;
  });
  await page.screenshot({ path: 'artifacts/remote-command-android.png' });
  const text = await panel.innerText();
  await device.shell('input keyevent 4');
  await panel.waitFor({ state: 'detached' });
  assert.match(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), /DSHM Remote 联调提示/);
  await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '执行失败' }).waitFor();
  await panel.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  return { runningObserved, previousRunningObserved: fixture.runningObserved, color, text, copied: true, readonly: true, fullscreen: true, androidBack: true, historyReopen: true };
}
