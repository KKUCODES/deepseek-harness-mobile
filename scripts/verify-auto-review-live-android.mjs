import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2];
const cancelRun = process.argv.includes('--cancel');
const prefix = cancelRun ? 'auto-review-cancel' : 'auto-review-live';
const hostPath = cancelRun ? 'artifacts/auto-review-cancel-host.json' : 'artifacts/auto-review-host.json';
assert.ok(['prepare', 'start', 'observe', 'cleanup', 'unloaded', 'cancel', 'resume', 'resume-observe'].includes(phase));
const seedPath = `artifacts/${prefix}-seed.json`;
if (phase === 'prepare') {
  const marker = `DSHM_AUTO_${randomUUID().replaceAll('-', '')}`;
  const seed = { marker, title: `DSHM 自动审核 ${marker.slice(-8)}`, path: resolve('../DSH-TEST', `${marker}.txt`), attempted: false };
  await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
  await writeFile(seed.path, `BEFORE_${marker}`, { flag: 'wx' });
  console.log(JSON.stringify({ prepared: true, title: seed.title }));
} else {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  assert.equal(dirname(seed.path), resolve('../DSH-TEST')); assert.equal(basename(seed.path), `${seed.marker}.txt`);
  const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
  assert.ok(device); device.setDefaultTimeout(15000);
  const report = { at: new Date().toISOString(), phase, errors: [] };
  const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
  try {
    const page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
    const main = page.getByTestId('remote-workspace'), heading = main.locator('.remote-heading strong');
    const menu = async name => {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name, exact: true }).click();
    };
    const permissions = async () => { await menu('会话权限'); return page.getByRole('dialog', { name: '会话权限', exact: true }); };
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    if (phase === 'unloaded') {
      assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      const existing = page.getByRole('dialog', { name: '会话权限', exact: true });
      const panel = await existing.isVisible() ? existing : await permissions();
      await panel.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Auto review', exact: true }).waitFor({ state: 'hidden' });
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal(await input.textContent(), seed.originalDraft); report.originalRestored = true; report.optionRemoved = true;
    } else if (phase === 'start') {
      assert.equal(seed.attempted, false); assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      seed.originalDraft = await input.textContent(); await persist();
      await menu('新建聊天');
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'hidden' });
      assert.notEqual(await heading.innerText(), 'DSHM Remote 联调提示');
      assert.equal(await main.getByRole('article', { name: '模型回复' }).count(), 0);
      await menu('重命名聊天');
      const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
      await rename.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await rename.getByRole('button', { name: '保存名称', exact: true }).click();
      await heading.getByText(seed.title, { exact: true }).waitFor(); seed.created = true; await persist();
      const panel = await permissions();
      await panel.getByRole('button', { name: '仅可查看', exact: true }).click();
      await panel.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Auto review', exact: true }).click();
      const confirm = panel.getByRole('group', { name: '确认启用 Auto review（实验）？', exact: true });
      assert.equal(await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).isEnabled(), false);
      await confirm.getByRole('checkbox').check();
      await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).click();
      await panel.getByText('当前权限：Auto review', { exact: true }).waitFor();
      seed.autoSelected = true; await persist(); report.confirmationRequired = true;
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await input.fill(cancelRun
        ? `这是DSHM自动审核取消联调。只调用read工具读取专用测试文件 ${seed.path.replaceAll('\\', '/')}，不要使用其他工具或修改任何文件。读取后只回复 DSHM_AUTO_READ_DONE。`
        : `这是DSHM自动审核真实联调。仅用write工具把 ${seed.path.replaceAll('\\', '/')} 内容替换为 AFTER_${seed.marker}。这是专用测试文件，此次允许你写入该文件。不要读取或修改其他文件，不执行命令，不改变权限。如果自动审核拒绝就停止，不重试。完成后只回复 DSHM_AUTO_DONE。`);
      seed.attempted = true; await persist();
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await persist(); report.sent = true;
    } else {
      assert.equal(await heading.innerText(), seed.title); assert.equal(seed.sent, true);
      if (phase === 'cancel') {
        assert.equal(cancelRun, true); assert.equal(seed.cancelAttempted, undefined);
        const deadline = Date.now() + 45000;
        let host;
        do {
          host = await readFile(hostPath, 'utf8').then(JSON.parse);
          if (host.reviews.some(row => row.started && !row.ended)) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        } while (Date.now() < deadline);
        assert.ok(host.reviews.some(row => row.started && !row.ended), '必须观测到真实审核在途，不以普通生成停止代替');
        seed.cancelAttempted = true; await persist();
        await main.getByRole('button', { name: '停止生成', exact: true }).click();
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 20000 });
        const settled = Date.now() + 10000;
        do {
          host = await readFile(hostPath, 'utf8').then(JSON.parse);
          if (host.reviews.some(row => row.aborted && row.ended)) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        } while (Date.now() < settled);
        report.host = host;
        assert.ok(host.reviews.some(row => row.aborted && row.ended));
        assert.equal(host.calls.length, 0, '审核中止后不得进入下游执行');
        assert.equal(await readFile(seed.path, 'utf8'), `BEFORE_${seed.marker}`);
        seed.verified = true; await persist(); report.cancelled = true;
        await page.screenshot({ path: 'artifacts/auto-review-cancel-android.png' });
      } else if (phase === 'resume') {
        assert.equal(cancelRun, true); assert.equal(seed.verified, true); assert.equal(seed.resumeAttempted, undefined);
        assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
        await input.fill('取消验证已完成。这条消息不需要任何工具，请只回复 DSHM_AFTER_CANCEL_OK。');
        seed.resumeAttempted = true; await persist();
        await main.getByRole('button', { name: '发送消息', exact: true }).click(); report.sent = true;
      } else if (phase === 'resume-observe') {
        assert.equal(cancelRun, true); assert.equal(seed.resumeAttempted, true);
        await main.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_AFTER_CANCEL_OK' }).waitFor({ timeout: 45000 });
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
        assert.equal(await readFile(seed.path, 'utf8'), `BEFORE_${seed.marker}`);
        report.host = await readFile(hostPath, 'utf8').then(JSON.parse);
        assert.equal(report.host.calls.length, 0);
        seed.resumed = true; await persist(); report.resumed = true;
      } else if (phase === 'observe') {
        const until = Date.now() + 45000;
        while (Date.now() < until) {
          const host = await readFile(hostPath, 'utf8').then(JSON.parse);
          if (!await main.getByRole('button', { name: '停止生成', exact: true }).count() && host.reviews.some(row => row.finish)) break;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        report.host = await readFile(hostPath, 'utf8').then(JSON.parse);
        report.running = await main.getByRole('button', { name: '停止生成', exact: true }).count() > 0;
        report.actualWrite = (await readFile(seed.path, 'utf8')).trim() === `AFTER_${seed.marker}`;
        report.manualApprovals = await page.locator('[data-approval-key]').count();
        if (!report.running) {
          assert.equal(report.actualWrite, true); assert.equal(report.manualApprovals, 0);
          assert.ok(report.host.reviews.some(row => row.decision === 'allow' && row.finish === 'stop'));
          assert.ok(report.host.calls.some(row => row.name === 'write' && row.preset === 'auto'));
          assert.equal(report.host.current, 'auto');
          seed.verified = true; await persist(); report.verified = true;
          await page.screenshot({ path: 'artifacts/auto-review-live-android.png' });
        }
      } else {
        assert.equal(seed.verified, true); assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
        const panel = await permissions(); await panel.getByRole('button', { name: '仅可查看', exact: true }).click();
        await panel.getByText('当前权限：仅可查看', { exact: true }).waitFor();
        await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
        seed.restored = true; await persist();
        const deadline = Date.now() + 8000;
        let host;
        do { host = await readFile(hostPath, 'utf8').then(JSON.parse); if (host.current === 'read-only') break; await new Promise(resolve => setTimeout(resolve, 200)); } while (Date.now() < deadline);
        assert.equal(host.current, 'read-only'); assert.equal(host.autoSessions, 0); report.host = host;
        await menu('归档聊天');
        await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
        await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
        assert.equal(await input.textContent(), seed.originalDraft);
        assert.equal((await readFile(seed.path, 'utf8')).trim(), `${cancelRun ? 'BEFORE' : 'AFTER'}_${seed.marker}`); await unlink(seed.path);
        seed.cleaned = true; await persist(); report.cleaned = true;
      }
    }
    assert.deepEqual(report.errors, []);
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await writeFile(`artifacts/${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); await device.close();
  }
}
