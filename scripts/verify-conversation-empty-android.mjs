import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const preset = process.argv.includes('--preset');
const boundHero = process.argv.includes('--bound-hero');
const prefix = boundHero ? 'bound-hero' : process.argv.includes('--preset-lifetime') ? 'preset-lifetime' : preset ? 'agent-preset-stage' : 'conversation-empty';
const readDraft = input => input.evaluate(node => node.textContent === '' && node.children.length === 1
  && node.firstElementChild?.matches('p') && node.firstElementChild.children.length === 1
  && node.firstElementChild.firstElementChild?.matches('br[data-lexical-managed-linebreak]') ? '' : node.innerText);
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, created: [], errors: [], resources: [] };
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
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const heading = main.locator('.remote-heading strong');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    const target = main.getByRole('button', { name, exact: true });
    if (['查看已归档聊天', '查看最近聊天'].includes(name) && !await target.isVisible()) {
      const other = name === '查看已归档聊天' ? '查看最近聊天' : '查看已归档聊天';
      assert.equal(await main.getByRole('button', { name: other, exact: true }).isVisible(), true);
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).press('Escape');
    } else await target.click();
  };
  if (await heading.innerText() === 'Remote') {
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
  }
  if (cleanup) {
    const previous = JSON.parse(await readFile(`artifacts/${prefix}-live-android.json`, 'utf8'));
    await main.getByTestId('live-empty-session').waitFor({ state: 'detached' });
    assert.equal(await heading.innerText(), seed.original);
    assert.equal(await readDraft(input), previous.originalDraft);
    report.unloaded = true; report.originalRestored = true;
  } else {
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (await heading.innerText() !== seed.original) {
      await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看最近聊天');
      await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
    }
    await heading.getByText(seed.original, { exact: true }).waitFor(); await input.waitFor();
    report.originalDraft = await readDraft(input);
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await input.waitFor(); report.parentDraft = await readDraft(input);
    if (await panel.isVisible()) {
      const childTab = panel.getByRole('button', { name: 'DSHM 恢复子会话', exact: true });
      if (await childTab.isVisible()) await childTab.click();
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    await menu('子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    const entry = panel.getByTestId('live-factory-empty'); await entry.waitFor();
    const before = JSON.parse(await entry.getAttribute('data-before'));
    report.before = before;
    if (preset) {
      const preparation = panel.getByTestId('live-preset-prepare'); await preparation.click();
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="live-preset-prepare"]').dataset.state).status !== 'pending');
      report.preparation = JSON.parse(await preparation.getAttribute('data-state'));
      assert.equal(report.preparation.status, 'ready'); assert.equal(typeof report.preparation.preset, 'string');
      if (report.preparation.created) report.created.push(report.preparation.id);
      assert.equal(await main.getByTestId('live-empty-session').getAttribute('data-main-count'), '1');
      assert.equal(await panel.getByTestId('live-empty-session').getAttribute('data-main-count'), '0');
    }
    await entry.click();
    const empty = panel.getByTestId('remote-empty-conversation'); await empty.waitFor();
    assert.equal(await empty.getByTestId('live-empty-brand').getAttribute('data-size'), '34');
    assert.equal(await empty.getByRole('textbox', { name: '消息', exact: true }).isDisabled(), true);
    assert.equal(await empty.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
    report.noSession = true; report.disabledComposer = true; report.brandSlot = true;
    if (preset) {
      const chip = empty.locator('button[aria-haspopup="menu"]'); await chip.click();
      report.targetPreset = report.preparation.preset === 'minimal' ? 'standard' : 'minimal';
      await page.getByRole('menuitem', { name: report.targetPreset === 'minimal' ? /极简模式|Minimal mode/ : /标准模式|Standard mode/ }).click();
      await empty.getByRole('button', { name: report.targetPreset === 'minimal' ? /^(极简模式|Minimal mode)$/ : /^(标准模式|Standard mode)$/ }).waitFor();
    }
    await page.screenshot({ path: `artifacts/${prefix}-hero-android.png` });
    await empty.getByRole('button', { name: '选择工作区', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '选择工作区', exact: true }); await picker.waitFor();
    assert.equal(await picker.getByRole('button', { name: /创建工作区|添加工作区/ }).count(), 0);
    await picker.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    const probe = main.getByTestId('live-empty-session'); await probe.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [data-testid="live-empty-session"]')?.dataset.workspace === 'DSH-TEST');
    report.opened = await probe.getAttribute('data-session');
    if (!before.includes(report.opened) && !report.created.includes(report.opened)) report.created.push(report.opened);
    assert.equal(await probe.getAttribute('data-blank'), 'true');
    if (preset) {
      assert.equal(report.opened, report.preparation.id);
      await page.waitForFunction(value => document.querySelector('[data-testid="remote-workspace"] [data-testid="live-empty-session"]')?.dataset.preset === value, report.targetPreset);
      assert.equal(await probe.getAttribute('data-main-count'), '1');
      report.presetApplied = true;
      const restored = await page.evaluate(async ({ id, preset }) => window.__DSH_TRANSPORT__.rpc.call('/api', 'agentPresets/select',
        { args: { agentId: id, agentPreset: preset } }, new AbortController().signal), report.preparation);
      assert.equal(restored.ok, true); assert.equal(restored.value, report.preparation.preset);
      await page.waitForFunction(value => document.querySelector('[data-testid="remote-workspace"] [data-testid="live-empty-session"]')?.dataset.preset === value, report.preparation.preset);
      report.presetRestored = true;
    }
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.getAttribute('contenteditable') === 'true');
    assert.equal(await input.isEditable(), true);
    if (boundHero) {
      const hero = main.getByTestId('remote-bound-hero');
      await hero.getByTestId('live-empty-brand').waitFor();
      const draft = await readDraft(input);
      try {
        await input.fill(`${draft} DSHM_HERO_DRAFT`);
        await hero.getByRole('button', { name: '切换工作区', exact: true }).click();
        const customPicker = page.getByTestId('live-hero-workspaces');
        await customPicker.waitFor(); assert.ok(await customPicker.getAttribute('data-selected'));
        await customPicker.getByRole('button', { name: '取消选择', exact: true }).click();
        await customPicker.waitFor({ state: 'detached' });
        assert.equal(await readDraft(input), `${draft} DSHM_HERO_DRAFT`);
        report.boundHero = { brand: true, workspacePlugin: true, cancelPreservesDraft: true };
      } finally {
        if (draft) await input.fill(draft);
        else { await input.press('ControlOrMeta+A'); await input.press('Backspace'); }
        await page.waitForFunction(text => {
          const node = document.querySelector('[data-testid="remote-workspace"] [role="textbox"]');
          return node && (text === '' ? node.textContent === '' : node.innerText === text);
        }, draft);
      }
      report.boundDraftRestored = await readDraft(input) === draft;
      assert.equal(report.boundDraftRestored, true);
      const geometry = await input.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: innerHeight,
        scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
      assert.ok(geometry.bottom <= geometry.viewport); assert.equal(geometry.scroll, geometry.width);
      report.geometry = geometry;
    }
    report.workspaceOpened = true; report.blankReused = !report.created.length;
    await page.screenshot({ path: `artifacts/${prefix}-opened-android.png` });
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await input.waitFor();
    assert.equal(await readDraft(input), report.parentDraft);
    if (!await panel.isVisible()) await menu('插件面板');
    const childTab = panel.getByRole('button', { name: 'DSHM 恢复子会话', exact: true });
    if (await childTab.isVisible()) await childTab.click();
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu('查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
    assert.equal(await readDraft(input), report.originalDraft); report.originalRestored = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: `artifacts/${prefix}-failure-android.png` }).catch(() => {});
} finally {
  if (page && preset && report.preparation?.status === 'ready' && !report.presetRestored) {
    const restored = await page.evaluate(async ({ id, preset }) => window.__DSH_TRANSPORT__.rpc.call('/api', 'agentPresets/select',
      { args: { agentId: id, agentPreset: preset } }, new AbortController().signal), report.preparation).catch(error => ({ error: error.message }));
    report.presetRestored = restored.ok === true && restored.value === report.preparation.preset;
    if (!report.presetRestored) { report.restoreFailure = restored; process.exitCode = 1; }
  }
  if (page && report.created.length) {
    report.archived = await page.evaluate(async ids => {
      const results = [];
      for (const sessionId of ids) {
        const result = await window.__DSH_TRANSPORT__.rpc.call('/api', 'workspace/archiveSession', { args: { request: { sessionId } } }, new AbortController().signal);
        results.push({ sessionId, archived: result.ok && result.value.archivedSessionIds.includes(sessionId) });
      }
      return results;
    }, report.created).catch(error => ({ failure: error.message }));
    if (!Array.isArray(report.archived) || report.archived.some(item => !item.archived)) process.exitCode = 1;
  }
  await writeFile(`artifacts/${prefix}-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
