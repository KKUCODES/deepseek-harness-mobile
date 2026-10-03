import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'verify';
assert.ok(['reproduce', 'verify', 'system', 'prepare-cold', 'check-cold', 'restore-cold'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const pkg = 'dev.dshmobile.validation', report = { at: new Date().toISOString(), phase, checks: [] };
let original, retainForCold = false;
let systemMode;
let systemDraft;
const pages = async () => {
  const deadline = Date.now() + 15000;
  while (true) {
    try {
      const values = (await (await androidAppWebView(device)).page()).context().pages();
      // Playwright默认模拟浅色；系统专项必须解除覆盖，读取真实WebView/Android信号。
      if (phase === 'system') for (const page of values) await page.emulateMedia({ colorScheme: null });
      return values;
    } catch (error) {
      if (phase !== 'system' || Date.now() >= deadline || !/closed|disconnected/i.test(error.message)) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};
const openOrdinary = async () => {
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const deadline = Date.now() + 15000;
  while (!(await device.shell(`pidof ${pkg}`)).toString().trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  let page;
  while (!(page = (await pages()).find(page => page.url().startsWith('https://appassets.androidplatform.net/'))) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(page);
  await page.getByRole('button', { name: /^(打开侧边抽屉|退出设置|返回设置首页)$/ }).waitFor();
  if (await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).count()) {
    await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
  }
  if (await page.getByRole('button', { name: /^外观与语言/ }).count()) await page.getByRole('button', { name: /^外观与语言/ }).click();
  await page.locator('.settings-font output').waitFor();
  return page;
};
const ordinary = async () => {
  const deadline = Date.now() + 15000;
  while (true) {
    try { return await openOrdinary(); }
    catch (error) {
      if (phase !== 'system' || Date.now() >= deadline || !/closed|disconnected/i.test(error.message)) throw error;
    }
  }
};
const preference = async page => (await page.getByRole('button', { name: /^主题/ }).innerText()).replace('主题', '').trim();
const font = async page => Number.parseInt(await page.locator('.settings-font output').innerText());
const change = async (page, theme, size) => {
  await page.getByRole('button', { name: /^主题/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: theme, exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  while (await font(page) !== size) {
    const previous = await font(page);
    await page.getByRole('button', { name: previous < size ? '增大字号' : '减小字号', exact: true }).click();
    await page.locator('.settings-font output').filter({ hasText: `${previous + (previous < size ? 1 : -1)} px` }).waitFor();
  }
};
const remote = async page => {
  await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await page.getByRole('button', { name: '电脑连接', exact: true }).click();
  let target; const deadline = Date.now() + 15000;
  while (!(target = (await pages()).find(page => page.url().startsWith('https://remote.dshm.invalid/'))) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(target); await target.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  return target;
};
const style = page => page.evaluate(() => ({ dark: document.body.hasAttribute('data-ds-dark-theme'), source: document.documentElement.getAttribute('data-ds-theme-source'),
  font: getComputedStyle(document.body).getPropertyValue('--dsh-content-font-size').trim(), background: getComputedStyle(document.body).backgroundColor,
  color: getComputedStyle(document.body).color, origin: performance.timeOrigin }));
const waitStyle = async (page, dark, size) => {
  const deadline = Date.now() + 8000; let value;
  do { value = await style(page); if (value.dark === dark && value.font === `${size}px`) return value; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < deadline);
  assert.equal(value.dark, dark); assert.equal(value.font, `${size}px`); return value;
};
try {
  if (phase === 'system') {
    const mode = (await device.shell('cmd uimode night')).toString().trim();
    systemMode = mode.match(/^Night mode: (yes|no|auto|custom)$/)?.[1];
    assert.ok(systemMode, '读取真实Android夜间模式后才能修改');
    report.originalSystemMode = systemMode;
    let page = await ordinary(); original = { preference: await preference(page), font: await font(page) }; report.original = original;
    await change(page, '跟随系统', original.font);
    let target = await remote(page);
    const heading = target.getByTestId('remote-workspace').locator('.remote-heading');
    if (await heading.innerText() === 'Remote') await target.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await target.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    await target.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复' }).first().waitFor();
    const title = await target.getByTestId('remote-workspace').locator('.remote-heading').innerText();
    const editor = target.getByRole('textbox', { name: '消息', exact: true });
    const originalDraft = await editor.innerText();
    const draft = `${originalDraft}\nDSHM_SYSTEM_THEME_DRAFT_${Date.now()}`;
    systemDraft = { title, original: originalDraft, probe: draft };
    await writeFile('artifacts/phone-system-draft-seed.json', JSON.stringify(systemDraft));
    await editor.fill(draft); report.nonemptyDraftProbe = true;
    const remoteOrigin = (await style(target)).origin;
    for (const mode of ['yes', 'no']) {
      const result = (await device.shell(`cmd uimode night ${mode}`)).toString().trim();
      assert.equal(result, `Night mode: ${mode}`);
      // 系统配置变化可以重建Activity；重新取得实际页面，不向WebView伪造媒体查询。
      page = await ordinary(); target = await remote(page);
      const sample = { stage: `system-${mode}`, ordinary: await style(page), remote: await style(target),
        media: await target.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches) };
      report.checks.push(sample);
      await device.screenshot({ path: `artifacts/phone-appearance-system-${mode}.png` });
      await waitStyle(page, mode === 'yes', original.font);
      await waitStyle(target, mode === 'yes', original.font);
      assert.equal((await style(target)).origin, remoteOrigin, '系统配色变化不得重建Remote页面');
      await target.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: title }).waitFor();
      assert.equal(await target.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
      // 显式偏好必须压过系统，两个方向都检查，随后回到跟随系统继续。
      page = await ordinary(); await change(page, mode === 'yes' ? '浅色' : '深色', original.font);
      target = await remote(page);
      await waitStyle(page, mode !== 'yes', original.font); await waitStyle(target, mode !== 'yes', original.font);
      page = await ordinary(); await change(page, '跟随系统', original.font); target = await remote(page);
    }
    report.draftPreserved = true;
    report.explicitOverrides = true; report.remotePagePreserved = true;
  } else if (phase === 'restore-cold') {
    original = JSON.parse(await readFile('artifacts/phone-appearance-prepare-cold-android.json', 'utf8')).original;
  } else if (phase === 'check-cold') {
    original = JSON.parse(await readFile('artifacts/phone-appearance-prepare-cold-android.json', 'utf8')).original;
    const target = await (await androidAppWebView(device)).page();
    assert.ok(target.url().startsWith('https://remote.dshm.invalid/'));
    assert.equal((await pages()).length, 1, '冷启动不能靠普通聊天重新补写外观');
    await target.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_APPEARANCE_COLD_20260925' }).waitFor({ timeout: 60000 });
    report.checks.push({ stage: 'notification-cold-remote', ...await waitStyle(target, true, 17) });
    assert.equal(await target.locator('.messages').evaluate(node => getComputedStyle(node).fontSize), '17px');
    await device.screenshot({ path: 'artifacts/phone-appearance-cold-chat.png' });
  } else {
  let page = await ordinary(); original = { preference: await preference(page), font: await font(page) }; report.original = original;
  await change(page, '深色', 17);
  const phoneStyle = await waitStyle(page, true, 17);
  if (phase === 'prepare-cold') {
    await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
    await page.getByRole('button', { name: '退出设置', exact: true }).click();
    await device.shell('input keyevent KEYCODE_HOME');
    retainForCold = true;
  } else {
  let target = await remote(page);
  if (phase === 'reproduce') {
    report.ordinary = phoneStyle; report.remote = await style(target);
    report.mismatch = report.remote.dark !== phoneStyle.dark || report.remote.font !== phoneStyle.font;
    assert.equal(report.mismatch, true);
    await device.screenshot({ path: 'artifacts/phone-appearance-before.png' });
  } else {
    const first = await waitStyle(target, true, 17); report.checks.push({ stage: 'dark-home', ...first });
    await target.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await target.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    await target.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_BASELINE_RESOLVED_20260925' }).waitFor({ timeout: 60000 });
    assert.equal(await target.locator('.messages').evaluate(node => getComputedStyle(node).fontSize), '17px');
    await device.screenshot({ path: 'artifacts/phone-appearance-dark-chat.png' });
    await target.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    report.dialog = await target.getByRole('dialog').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }));
    await device.screenshot({ path: 'artifacts/phone-appearance-dark-menu.png' });
    await target.getByRole('button', { name: '关闭窗口', exact: true }).click();
    page = await ordinary(); await change(page, '浅色', 12); target = await remote(page);
    const light = await waitStyle(target, false, 12); assert.equal(light.origin, first.origin); report.checks.push({ stage: 'light-reused-remote', ...light });
    page = await ordinary(); await change(page, '深色', 17); target = await remote(page); await waitStyle(target, true, 17);
    // 冷启动另由真实通知 PendingIntent 进入；RemoteActivity 保持不对外导出。
  }
  }
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (systemMode) {
    try { assert.equal((await device.shell(`cmd uimode night ${systemMode}`)).toString().trim(), `Night mode: ${systemMode}`); report.systemRestored = true; }
    catch (error) { report.systemRestoreFailure = error.message; process.exitCode = 1; }
  }
  if (original && !retainForCold) {
    try {
      const page = await ordinary(); await change(page, original.preference, original.font);
      if (systemDraft) {
        const target = await remote(page);
        if (await target.getByTestId('remote-workspace').locator('.remote-heading').innerText() === 'Remote')
          await target.locator('.remote-session-row').filter({ hasText: systemDraft.title }).click();
        await target.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: systemDraft.title }).waitFor();
        const editor = target.getByRole('textbox', { name: '消息', exact: true });
        assert.equal(await editor.innerText(), systemDraft.probe, '不覆盖意外变化的草稿');
        await editor.fill(systemDraft.original); report.draftRestored = true;
        await writeFile('artifacts/phone-system-draft-seed.json', JSON.stringify({ restored: true }));
        await ordinary();
      }
      if (['verify', 'check-cold', 'restore-cold'].includes(phase)) {
        const target = await remote(page);
        const expected = await style(page);
        report.restoredRemote = await waitStyle(target, expected.dark, original.font);
        assert.equal(report.restoredRemote.source, expected.source);
        await ordinary();
      }
      await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
      await page.getByRole('button', { name: '退出设置', exact: true }).click();
      report.restored = true;
    } catch (error) { report.restoreFailure = error.message; process.exitCode = 1; }
  }
  await writeFile(`artifacts/phone-appearance-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
