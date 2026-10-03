import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅在既有专用聊天/工作区写入本次自造文件。start 独占种子，observe 绝不重发模型消息。
const phase = process.argv[2];
assert.ok(['start', 'resume-start', 'observe', 'cleanup'].includes(phase));
if (['start', 'resume-start'].includes(phase)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const run = process.env.DSHM_RESOURCE_RUN ?? 'live';
assert.match(run, /^[a-z0-9-]+$/);
const prefix = `artifacts/file-resource-${run}`;
const seedPath = `${prefix}-seed.json`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase, errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  const surface = page.getByRole('region', { name: '插件面板', exact: true, includeHidden: true });
  const panel = page.getByTestId('live-panel'), output = panel.getByTestId('live-file-resource');
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (['start', 'resume-start'].includes(phase)) {
    const stamp = Date.now();
    const seed = phase === 'resume-start' ? JSON.parse(await readFile(seedPath, 'utf8')) : { path: resolve('../DSH-TEST', `dshm-resource-${stamp}.txt`),
      before: `DSHM_RESOURCE_BEFORE_${stamp}`, after: `DSHM_RESOURCE_AFTER_${stamp}`, draft: await editor.inputValue() };
    assert.equal(dirname(seed.path), resolve('../DSH-TEST'));
    if (phase === 'start') {
      await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
      await writeFile(seed.path, seed.before, { flag: 'wx' });
    } else {
      assert.equal(seed.initial, undefined, '仅恢复尚未建立观察、更未发送请求的准备失败');
      assert.equal(seed.sent, undefined);
      assert.equal(await readFile(seed.path, 'utf8'), seed.before);
    }
    await menu('插件面板');
    const tab = surface.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true });
    if (await tab.count()) await tab.click();
    else await surface.getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.getByRole('textbox', { name: '面板测试文件', exact: true }).fill(seed.path.replaceAll('\\', '/'));
    await panel.getByRole('button', { name: '观察文件资源', exact: true }).click();
    await output.filter({ hasText: '"status":"live"' }).waitFor();
    seed.initial = JSON.parse(await output.textContent());
    assert.ok(seed.initial.value.version);
    await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    await surface.waitFor({ state: 'hidden' });
    // 面板仅收起而未卸载，后续直接观察同一 DOM 节点，不重开资源。
    assert.equal(await output.count(), 1);
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await editor.fill(`这是 DSHM 文件资源实时同步验收。请只用 write 工具将本次专用测试文件 ${seed.path.replaceAll('\\', '/')} 的完整内容替换为 ${seed.after}。允许为此读取这个文件，但不要操作其他文件，不执行命令，不修改权限。按正常流程等待本次单次审批，完成后只回复 DSHM_RESOURCE_UPDATED_${stamp}。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await editor.fill(seed.draft);
    report.sent = true; report.initial = seed.initial;
  } else {
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(dirname(resolve(seed.path)), resolve('../DSH-TEST'));
    if (phase === 'observe') {
      assert.equal(seed.sent, true);
      if (await surface.isVisible()) await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
      const pending = page.getByRole('region', { name: '等待审批', exact: true });
      const deadline = Date.now() + 55000;
      report.approvals = [];
      while (Date.now() < deadline) {
        if (await pending.count()) {
          const text = await pending.innerText();
          // 仅批准当前已核对测试文件的写入，不授予预设或管理权限。
          if (!text.includes(seed.path.replaceAll('\\', '/')) && !text.includes(seed.path)) {
            // 原沙盒升级审批不重复文件名；核对同页仍在运行的原写入卡片。
            assert.match(text, /escalate sandbox to workspace-write/);
            const path = seed.path.replaceAll('\\', '/');
            const writing = await page.getByRole('button', { name: path, exact: true }).last().evaluate(element => {
              for (let node = element.parentElement, i = 0; node && i < 4; node = node.parentElement, i++) {
                if (node.innerText.length < 1000 && /运行中/.test(node.innerText)) return node.innerText;
              }
              return '';
            });
            assert.ok(writing.includes(path)); assert.match(writing, /写入/);
            report.runningWrite = writing;
          }
          assert.match(text, /write|写入|写文件/i);
          report.approvals.push(text);
          await pending.getByRole('button', { name: '允许一次', exact: true }).click();
          await pending.waitFor({ state: 'detached', timeout: 10000 });
        }
        const current = JSON.parse(await output.textContent());
        if (current.status === 'live' && current.value.version !== seed.initial.value.version) {
          report.updated = current; break;
        }
        await page.waitForTimeout(250);
      }
      assert.ok(report.updated, '同一隐藏资源订阅应收到真实工具观察到的新版本');
      assert.equal(await surface.isVisible(), false);
      assert.equal(await readFile(seed.path, 'utf8'), seed.after);
      assert.equal(report.updated.value.bytes, Buffer.byteLength(seed.after), '新版本必须包含最新完整文件大小');
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
      report.sameHiddenSubscriptionUpdated = true;
      await menu('插件面板');
      await surface.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
      assert.equal(JSON.parse(await output.textContent()).value.version, report.updated.value.version);
      await page.screenshot({ path: `${prefix}-android.png` });
      await panel.getByRole('button', { name: '停止文件观察', exact: true }).click();
      await output.waitFor({ state: 'detached' });
      await panel.getByRole('button', { name: '面板预览文件', exact: true }).click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      await preview.locator('pre').waitFor();
      assert.equal(await preview.locator('pre').innerText(), seed.after);
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
      assert.equal(await editor.inputValue(), seed.draft); report.draftPreserved = true;
      await menu('会话权限');
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      assert.equal(await permissions.getByText(/^当前权限：/).innerText(), '当前权限：仅可查看');
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      report.permissionPreserved = true;
    } else {
      assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      assert.equal(await output.count(), 0, '先结束文件观察再清理');
      const content = await readFile(seed.path, 'utf8');
      assert.ok([seed.before, seed.after].includes(content));
      await unlink(seed.path); report.temporaryFileRemoved = true;
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally {
  await writeFile(`${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
