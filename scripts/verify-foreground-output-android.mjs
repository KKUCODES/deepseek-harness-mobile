import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// run creates one dedicated session and sends once; resume never resends a model request.
const action = process.argv[2] ?? 'inspect';
const ansi = process.argv.includes('--ansi');
assert.ok(['inspect', 'run', 'observe', 'cleanup'].includes(action));
if (action === 'run') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const artifact = ansi ? 'foreground-ansi' : 'foreground-command';
const seedPath = `artifacts/${artifact}-seed.json`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), action, ansi, errors: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, 'Open the main DSHM Remote first'); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-workspace').waitFor();
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (action === 'inspect') report.text = (await page.locator('body').innerText()).slice(0, 4000);
  else {
    let seed;
    if (action === 'run') {
      try { await readFile(seedPath); throw Error('A test seed already exists; use observe/cleanup, do not resend'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await heading.filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
      assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      const marker = `DSHM_FOREGROUND_${Date.now()}`;
      seed = { original: await heading.innerText(), title: `DSHM 前台实时输出 ${Date.now()}`, marker,
        command: `$PSStyle.OutputRendering = 'Ansi'; Write-Output '${marker}_BEGIN 中文'; Write-Output "\`e[31m${marker}_RED\`e[0m"; Write-Error '${marker}_ERR'; Start-Sleep -Seconds 35; Write-Output '${marker}_END 完成'; exit 7`, stage: 'prepared' };
      if (ansi) {
        seed.title = `DSHM 前台颜色验证 ${Date.now()}`;
        seed.command = `[Console]::WriteLine('${marker}_BEGIN 中文'); [Console]::WriteLine(([char]27) + '[31m${marker}_RED' + ([char]27) + '[0m'); [Console]::Error.WriteLine('${marker}_ERR'); Start-Sleep -Seconds 35; [Console]::WriteLine('${marker}_END 完成'); exit 7`;
      }
      await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
      await menu('新建聊天');
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await menu('重命名聊天');
      await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await page.getByRole('button', { name: '保存名称', exact: true }).click();
      await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是DSHM前台独立输出联调。只调用一次pwsh，command精确为：${seed.command}。run_in_background=false，timeoutMs=60000，description=DSHM_FOREGROUND_OUTPUT。只打印固定样例、等待和退出；不读写文件，不访问网络，不调用其他工具，不重试。Write-Error和退出码7是预期测试，不修复。PSStyle只在此子进程允许ANSI样例，不改全局设置。结束后只回复DSHM_FOREGROUND_DONE。`);
      seed.stage = 'sending'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.stage = 'sent'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    } else {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
    }
    report.title = seed.title;
    await heading.filter({ hasText: seed.title }).waitFor();
    assert.equal(await heading.innerText(), seed.title);
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
      const tool = page.getByRole('region', { name: '聊天内容', exact: true }).locator('details.remote-tool-card').filter({ hasText: seed.marker }).last();
      await tool.waitFor({ timeout: 60000 });
      const approval = page.getByRole('region', { name: '等待审批', exact: true });
      if (await approval.count()) {
        const text = await approval.innerText();
        assert.match(text, /pwsh/); assert.ok(text.includes(seed.marker));
        assert.ok(text.includes('Start-Sleep -Seconds 35')); assert.ok(text.includes('exit 7'));
        await approval.getByRole('button', { name: '允许一次', exact: true }).click();
      }
      if (!await panel.count()) {
        if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
        await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
      }
      await panel.getByRole('group', { name: '命令输出视图', exact: true }).waitFor();
      const output = panel.getByLabel('独立命令输出', { exact: true });
      await output.filter({ hasText: `${seed.marker}_BEGIN 中文` }).waitFor();
      report.earlyText = await output.innerText();
      report.beforeExit = !report.earlyText.includes(`${seed.marker}_END`);
      report.runningObserved = await panel.getByRole('status').filter({ hasText: /^执行中$/ }).count() === 1;
      if (action === 'run') { assert.equal(report.beforeExit, true); assert.equal(report.runningObserved, true); }
      const colored = output.locator('span[style]').filter({ hasText: `${seed.marker}_RED` });
      report.color = await colored.count() ? await colored.evaluate(el => getComputedStyle(el).color) : null;
      if (ansi) {
        const rgb = report.color?.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);
        assert.ok(rgb && rgb[0] > rgb[1] + 50 && rgb[0] > rgb[2] + 50, 'Actual ANSI red must render as red');
        assert.equal(await output.textContent(), report.earlyText);
      }
      await page.screenshot({ path: `artifacts/${artifact}-live-android.png` });
      await panel.getByRole('button', { name: '错误输出', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_ERR` }).waitFor(); report.stderr = true;
      await panel.getByRole('button', { name: '标准输出', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_END 完成` }).waitFor({ timeout: 60000 });
      report.completeText = await output.innerText();
      await panel.getByRole('button', { name: '从头查看', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_END 完成` }).waitFor();
      assert.equal(await output.innerText(), report.completeText); report.history = true;
      await panel.getByRole('button', { name: '复制当前输出', exact: true }).click();
      await panel.getByRole('button', { name: '已复制', exact: true }).waitFor(); report.copied = true;
      await panel.getByRole('button', { name: '执行结果', exact: true }).click();
      await panel.getByRole('status').filter({ hasText: /^执行失败$/ }).waitFor();
      assert.match(await panel.innerText(), /退出码 7/);
      assert.match(await panel.innerText(), new RegExp(`${seed.marker}_BEGIN`));
      assert.match(await panel.innerText(), new RegExp(`${seed.marker}_END`)); report.canonicalResult = true;
      await panel.getByRole('button', { name: '实时输出', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_END 完成` }).waitFor();
      await panel.getByRole('button', { name: '放大窗口', exact: true }).click();
      assert.match(await panel.getAttribute('class'), /is-fullscreen/);
      assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1), false); report.fullscreen = true;
      await page.screenshot({ path: `artifacts/${artifact}-complete-android.png` });
      await panel.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_FOREGROUND_DONE' }).waitFor({ timeout: 60000 });
      await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_END 完成` }).waitFor(); report.reopened = true;
      await panel.getByRole('button', { name: '关闭命令详情', exact: true }).click();
    }
  }
} catch (error) {
  report.errors.push(error.message); process.exitCode = 1;
  if (page) report.failureText = (await page.locator('body').innerText().catch(() => '')).slice(-6000);
} finally {
  await writeFile(`artifacts/${artifact}-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
