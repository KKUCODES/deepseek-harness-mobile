import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const missing = process.argv.includes('--missing');
const innerStop = process.argv.includes('--inner-stop');
const stopping = innerStop || process.argv.includes('--stop');
assert.ok(!(missing && stopping));
const suffix = process.env.DSHM_PTC_RUN_SUFFIX ?? '';
assert.match(suffix, /^[a-z0-9-]*$/);
const phase = process.argv[2], base = (innerStop ? 'artifacts/ptc-inner-stop' : stopping ? 'artifacts/ptc-stop' : missing ? 'artifacts/ptc-missing' : 'artifacts/ptc-runtime') + (suffix ? `-${suffix}` : '');
assert.ok(['prepare', 'start', 'stop', 'stop-observe', 'stop-replay', 'stop-evidence', 'observe', 'replay', 'resume', 'resume-observe', 'cleanup'].includes(phase));
const assertMissing = async path => assert.rejects(readFile(path), { code: 'ENOENT' });
const seedPath = `${base}-seed.json`;
if (phase === 'prepare') {
  const id = randomBytes(8).toString('hex');
  const seed = { title: `DSHM PTC ${id}`, path: resolve('../DSH-TEST', `ptc-${id}.txt`),
    content: `DSHM_PTC_RESULT_${randomBytes(18).toString('hex')}`, attempted: false };
  await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
  if (missing || stopping) await assertMissing(seed.path);
  else await writeFile(seed.path, seed.content, { flag: 'wx' });
  console.log(JSON.stringify({ prepared: true, title: seed.title }));
} else {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  assert.equal(dirname(seed.path), resolve('../DSH-TEST'));
  const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
  const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === (process.env.DSHM_ANDROID_SERIAL ?? '127.0.0.1:16448'));
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), phase, errors: [] };
  try {
    const context = (await (await androidAppWebView(device)).page()).context();
    let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) {
      const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
      await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
      const until = Date.now() + 20000;
      while (!(page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'))) && Date.now() < until) await new Promise(r => setTimeout(r, 200));
    }
    assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
    const main = page.getByTestId('remote-workspace'), heading = main.locator('.remote-heading strong');
    if (await page.getByRole('button', { name: '重新连接', exact: true }).isVisible()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await main.waitFor({ timeout: 60000 });
    const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
    if (await welcome.isVisible()) await welcome.getByRole('button', { name: '继续', exact: true }).click();
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    const menu = async name => {
      const item = main.getByRole('button', { name, exact: true });
      if (!await item.isVisible()) await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await item.click();
    };
    if (phase === 'start') {
      assert.equal(seed.attempted, false);
      if (!await heading.getByText('DSHM Remote 联调提示', { exact: true }).isVisible())
        await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      seed.originalDraft = await input.textContent(); await persist();
      await menu('新建聊天');
      const workspace = page.getByRole('dialog', { name: '选择工作区', exact: true });
      await workspace.getByRole('button', { name: 'DSH-TEST', exact: true }).click(); await workspace.waitFor({ state: 'hidden' });
      await menu('重命名聊天');
      const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
      await rename.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await rename.getByRole('button', { name: '保存名称', exact: true }).click();
      await heading.getByText(seed.title, { exact: true }).waitFor(); seed.created = true; await persist();
      await menu('会话权限');
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
      await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await menu('Agent 模式');
      const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
      const mode = modes.getByRole('button', { name: 'PTC 模式', exact: true });
      await mode.click(); await mode.and(modes.locator('[aria-pressed="true"]')).waitFor();
      await modes.getByRole('button', { name: '关闭窗口', exact: true }).click();
      // 随机内容不放入提示词，必须从电脑文件经实际工具结果获得。
      await input.fill(innerStop
        ? '这是PTC内部工具取消验证。只调用一次run_code，在程序内await调用已提供的dshm_ptc_wait工具，不传参数；调用前输出DSHM_PTC_WAITING，返回后输出DSHM_PTC_UNEXPECTED_FINISH。不要直接调用工具，不读写文件、不执行Shell、不联网、不重试。等待我从手机停止。'
        : stopping
        ? '这是PTC停止联调。只调用一次run_code，程序严格为 console.log("DSHM_PTC_WAITING"); await new Promise(resolve => setTimeout(resolve, 90000)); console.log("DSHM_PTC_UNEXPECTED_FINISH");。不要调用任何其他工具，不读写文件、不执行Shell、不联网、不重试。等待我从手机停止。'
        : missing
        ? `这是PTC失败联调。请只调用一次run_code，在程序内通过已提供的read工具读取 ${seed.path.replaceAll('\\', '/')}。这个专用测试文件故意不存在。不要捕获或隐藏错误，不要创建文件，不要读取其他文件、执行Shell或联网。失败后停止，不重试，最后回复 DSHM_PTC_EXPECTED_FAILURE。`
        : `这是PTC只读联调。请只调用一次run_code，在程序内通过已提供的read工具读取 ${seed.path.replaceAll('\\', '/')} 并输出读取结果。不要读取其他文件、不执行Shell、不修改文件、不联网。最后只回复文件里的完整校验行。若执行失败，停止并说明，不重试。`);
      seed.attempted = true; await persist();
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await persist(); report.sent = true;
    } else if (phase === 'stop' || phase === 'stop-observe' || phase === 'stop-replay' || phase === 'stop-evidence') {
      assert.equal(stopping, true); assert.equal(seed.sent, true); assert.equal(await heading.innerText(), seed.title);
      if (phase === 'stop-replay') {
        assert.equal(seed.verified, true);
        await main.getByRole('button', { name: '返回', exact: true }).click();
        await main.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
        await heading.getByText(seed.title, { exact: true }).waitFor();
        report.reentered = true;
      }
      const row = main.locator('[data-tool="run_code"]');
      if (phase === 'stop') {
        assert.equal(seed.stopAttempted, undefined);
        await main.locator('[data-tool="run_code"][data-state="running"]').waitFor({ timeout: 45000 });
        await row.click();
        // 源码也含标记，不能把源码可见当作日志；留出进程启动时间，最终从Captured output核对。
        if (innerStop) {
          const until = Date.now() + 45000;
          let host;
          do {
            host = JSON.parse(await readFile('artifacts/ptc-inner-wait-host.json', 'utf8'));
            if (host.calls.some(call => call.inner && call.started && !call.aborted && !call.completed)) break;
            await new Promise(resolve => setTimeout(resolve, 200));
          } while (Date.now() < until);
          assert.equal(host.calls.length, 1); assert.equal(host.calls[0].inner, true);
          assert.equal(host.calls[0].aborted, false); assert.equal(host.calls[0].completed, false);
          report.innerActuallyRunning = true;
        } else await new Promise(resolve => setTimeout(resolve, 4000));
        seed.stopAttempted = true; await persist();
        await main.getByRole('button', { name: '停止生成', exact: true }).click(); report.stopSent = true;
      } else {
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 45000 });
        const collapsed = main.locator('button[data-turn-process][aria-expanded="false"]');
        while (await collapsed.count()) await collapsed.first().click();
        await row.waitFor(); report.state = await row.getAttribute('data-state');
        if (phase === 'stop-evidence') {
          await main.getByRole('button', { name: '工具详情', exact: true }).first().click();
          const details = page.getByRole('dialog', { name: '工具详情', exact: true });
          const text = await details.innerText(), output = text.slice(text.indexOf('Captured output:'));
          assert.match(text, /code run failed \(abort\)/);
          assert.match(output, /DSHM_PTC_WAITING/);
          assert.ok(!output.includes('DSHM_PTC_UNEXPECTED_FINISH'));
          report.runtimeAbort = true; report.partialOutputRetained = true; report.displayMismatch = report.state !== 'stopped';
          seed.stopRecorded = true; await persist();
          await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
        } else {
        await page.screenshot({ path: `${base}-${phase}-android.png` });
        assert.equal(report.state, 'stopped');
        if (innerStop) {
          const parent = main.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="run_code"]') }).first();
          const nested = parent.locator('[data-tool="dshm_ptc_wait"]'); await nested.waitFor();
          assert.equal(await nested.getAttribute('data-state'), 'stopped');
          const host = JSON.parse(await readFile('artifacts/ptc-inner-wait-host.json', 'utf8'));
          assert.equal(host.calls.length, 1); assert.equal(host.calls[0].aborted, true); assert.equal(host.calls[0].completed, false);
          report.innerStopped = true; report.abortReachedHost = true;
        }
        seed.verified = true; await persist(); report.stopped = true;
        }
      }
    } else if (phase === 'resume' || phase === 'resume-observe') {
      assert.ok(missing || stopping); assert.ok(seed.verified || stopping && seed.stopRecorded); assert.equal(await heading.innerText(), seed.title);
      if (phase === 'resume') {
        assert.equal(seed.resumeAttempted, undefined);
        await input.fill('失败记录已确认。本条不要调用任何工具，只回复 DSHM_PTC_AFTER_FAILURE_OK。');
        seed.resumeAttempted = true; await persist();
        await main.getByRole('button', { name: '发送消息', exact: true }).click(); report.sent = true;
      } else {
        await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_PTC_AFTER_FAILURE_OK' }).waitFor({ timeout: 45000 });
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
        seed.resumed = true; await persist(); report.replyReceived = true;
      }
    } else if (phase === 'observe' || phase === 'replay') {
      assert.equal(seed.sent, true); assert.equal(await heading.innerText(), seed.title);
      if (phase === 'replay') {
        assert.equal(seed.verified, true);
        await main.getByRole('button', { name: '返回', exact: true }).click();
        await main.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
        await heading.getByText(seed.title, { exact: true }).waitFor();
        report.reentered = true;
      }
      const response = main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: missing ? 'DSHM_PTC_EXPECTED_FAILURE' : seed.content });
      const until = Date.now() + 45000;
      while (Date.now() < until) {
        if (await response.count() && await main.getByRole('button', { name: '停止生成', exact: true }).count() === 0) break;
        await new Promise(r => setTimeout(r, 300));
      }
      if (!await response.count() || await main.getByRole('button', { name: '停止生成', exact: true }).count()) {
        report.pending = await main.getByRole('button', { name: '停止生成', exact: true }).count() > 0;
        if (!report.pending) { await page.screenshot({ path: `${base}-failure.png` }); throw Error('PTC ended without the expected file receipt'); }
      } else {
        const collapsed = main.locator('button[data-turn-process][aria-expanded="false"]');
        while (await collapsed.count()) await collapsed.first().click();
        const parent = main.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="run_code"]') }).first();
        await parent.waitFor();
        const state = missing ? 'error' : 'ok';
        const read = parent.locator(`[data-tool="read"][data-state="${state}"]`); await read.waitFor();
        assert.equal(await read.count(), 1);
        assert.equal(await parent.locator(`[data-tool="run_code"][data-state="${state}"]`).count(), 1);
        assert.equal(await main.locator('[data-tool="run_code"]').count(), 1);
        if (missing) {
          await assertMissing(seed.path);
          assert.match(await parent.innerText(), /ENOENT|not found|不存在|no such file/i);
          report.nestedFailure = true; report.noRetry = true; report.fileStillMissing = true;
        } else {
          assert.equal(await readFile(seed.path, 'utf8'), seed.content);
          report.receiptMatched = true; report.nestedSuccess = true; report.fileUnchanged = true;
        }
        report.innerReadVisible = true; report.outerProgramVisible = true;
        seed.verified = true; await persist();
        await page.screenshot({ path: `${base}-${phase}-android.png` });
      }
    } else {
      assert.ok(seed.verified || stopping && seed.stopRecorded); if (missing || stopping) assert.equal(seed.resumed, true);
      assert.equal(await heading.innerText(), seed.title);
      await menu('归档聊天'); seed.archived = true; await persist();
      await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      assert.equal(await input.textContent(), seed.originalDraft);
      if (missing || stopping) { await assertMissing(seed.path); report.fileStillMissing = true; }
      else { assert.equal(await readFile(seed.path, 'utf8'), seed.content); await unlink(seed.path); report.fileRemoved = true; }
      seed.cleaned = true; await persist(); report.draftPreserved = true;
    }
    assert.deepEqual(report.errors, []);
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await writeFile(`${base}-${phase}-android.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report)); await device.close();
  }
}
