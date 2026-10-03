import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 真实会话只发送一次；失败后观察或清理，不重发模型请求。
const action = process.argv[2] ?? 'observe';
assert.ok(['run', 'observe', 'cleanup'].includes(action));
if (action === 'run') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = 'artifacts/output-ansi-boundary-seed.json';
const report = { at: new Date().toISOString(), action, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading'); await heading.waitFor();
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  let seed;
  if (action === 'run') {
    try { await readFile(seedPath); throw Error('Existing seed: observe/cleanup only'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    seed = { original: 'DSHM Remote 联调提示', title: `DSHM 颜色分页 ${Date.now()}`, stage: 'prepared',
      command: "[Console]::Write(([char]27) + '[31m'); 1..750 | ForEach-Object { [Console]::WriteLine(('x' * 199)) }; [Console]::WriteLine('DSHM_BOUNDARY_RED'); [Console]::WriteLine(([char]27) + '[0mDSHM_BOUNDARY_PLAIN')" };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是DSHM输出颜色分页验收。只调用一次pwsh，command精确为：${seed.command}。run_in_background=false，timeoutMs=60000，description=DSHM_ANSI_BOUNDARY。只打印固定样例；不读写文件、不访问网络、不调用其他工具、不重试。完成后只回复DSHM_BOUNDARY_DONE。`);
    seed.stage = 'sending'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.stage = 'sent'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
  }
  report.title = seed.title; await heading.filter({ hasText: seed.title }).waitFor();
  const panel = page.getByRole('dialog', { name: '命令详情', exact: true });
  if (action === 'cleanup') {
    if (await panel.count()) await panel.getByRole('button', { name: '关闭命令详情', exact: true }).click();
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await menu('归档聊天');
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
    await heading.filter({ hasText: seed.original }).waitFor();
    seed.stage = 'archived'; await writeFile(seedPath, JSON.stringify(seed, null, 2)); report.restored = true;
  } else {
    const tool = page.getByRole('region', { name: '聊天内容', exact: true }).locator('details.remote-tool-card').filter({ hasText: 'DSHM_BOUNDARY_RED' }).last();
    await tool.waitFor({ timeout: 60000 });
    const approval = page.getByRole('region', { name: '等待审批', exact: true });
    if (await approval.count()) {
      assert.ok((await approval.innerText()).includes(seed.command));
      await approval.getByRole('button', { name: '允许一次', exact: true }).click();
    }
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_BOUNDARY_DONE' }).waitFor({ timeout: 60000 });
    if (!await panel.count()) {
      if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
      await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
    }
    const output = panel.getByLabel('独立命令输出', { exact: true });
    const status = panel.getByRole('status').filter({ hasText: '字节' });
    await output.filter({ hasText: 'DSHM_BOUNDARY_PLAIN' }).waitFor();
    const checkRed = async span => {
      const color = await span.evaluate(el => getComputedStyle(el).color);
      const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);
      assert.ok(rgb && rgb[0] > rgb[1] + 50 && rgb[0] > rgb[2] + 50, `Expected red: ${color}`);
      return color;
    };
    await panel.getByText('当前显示最近的输出。可选择“从头查看”分段读取早期内容。', { exact: true }).waitFor();
    report.trimmedRed = await checkRed(output.locator('span').filter({ hasText: 'DSHM_BOUNDARY_RED' }));
    report.total = await status.innerText();
    assert.ok((await output.textContent()).length <= 128 * 1024);
    await panel.getByRole('button', { name: '从头查看', exact: true }).click();
    await status.filter({ hasText: '65,536 /' }).waitFor();
    await panel.getByRole('button', { name: '读取下一段', exact: true }).click();
    await status.filter({ hasText: '131,072 /' }).waitFor();
    report.secondPageRed = await checkRed(output.locator('span').filter({ hasText: 'xxx' }).first());
    await panel.getByRole('button', { name: '读取下一段', exact: true }).click();
    await output.filter({ hasText: 'DSHM_BOUNDARY_PLAIN' }).waitFor();
    report.thirdPageRed = await checkRed(output.locator('span').filter({ hasText: 'DSHM_BOUNDARY_RED' }));
    const plain = output.locator('span').filter({ hasText: 'DSHM_BOUNDARY_PLAIN' });
    assert.equal(await plain.evaluate(el => el.style.color), ''); report.reset = true;
    await output.evaluate(el => el.lastElementChild.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'artifacts/output-ansi-boundary-android.png' });
  }
} catch (error) {
  report.errors.push(error.message); process.exitCode = 1;
  if (page) report.failureText = (await page.locator('body').innerText().catch(() => '')).slice(-1500);
} finally {
  await writeFile(`artifacts/output-ansi-boundary-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
