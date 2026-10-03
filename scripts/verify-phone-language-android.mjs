import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const interactions = process.argv.includes('--interactions');
const details = process.argv.includes('--details');
const tasks = process.argv.includes('--tasks');
const settings = process.argv.includes('--settings');
const navigation = process.argv.includes('--navigation');
const notices = process.argv.includes('--native-notices');
const nativeKey = process.argv.includes('--native-key');
const nativeShare = process.argv.includes('--native-share');
if (interactions || notices) assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Real model message requires DSHM_RUN_LIVE=1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const pkg = 'dev.dshmobile.validation', report = { at: new Date().toISOString(), checks: [] };
let original, target, draft;
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
async function ordinary() {
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const deadline = Date.now() + 15000;
  while (!(await device.shell(`pidof ${pkg}`)).toString().trim() && Date.now() < deadline) await pause();
  let page;
  do { page = (await (await androidAppWebView(device)).page()).context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/')); if (!page) await pause(); } while (!page && Date.now() < deadline);
  assert.ok(page);
  await page.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar|退出设置|Close settings|返回设置首页|Back to settings)$/ }).waitFor();
  if (await page.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).count()) {
    await page.getByRole('button', { name: /^(打开侧边抽屉|Open sidebar)$/ }).click();
    await page.getByRole('button', { name: /^(设置|Settings)$/ }).click();
  }
  if (await page.getByRole('button', { name: /^(外观与语言|Appearance and language)/ }).count()) await page.getByRole('button', { name: /^(外观与语言|Appearance and language)/ }).click();
  await page.locator('.settings-font output').waitFor();
  return page;
}
async function change(page, language) {
  await page.getByRole('button', { name: /^(语言|Language)/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: language === 'en' ? 'English' : /^(简体中文|Simplified Chinese)$/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForFunction(lang => document.documentElement.lang === lang, language === 'en' ? 'en' : 'zh-CN');
}
async function openRemote(page) {
  await page.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
  await page.getByRole('button', { name: /^(电脑连接|Computer connection)$/ }).click();
  const deadline = Date.now() + 15000; let remote;
  do { remote = page.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/')); if (!remote) await pause(); } while (!remote && Date.now() < deadline);
  assert.ok(remote); await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  return remote;
}
try {
  let phone = await ordinary(); original = await phone.evaluate(() => document.documentElement.lang); report.original = original;
  await change(phone, 'en'); target = await openRemote(phone);
  if (await target.getByRole('button', { name: 'Close', exact: true }).count()) await target.getByRole('button', { name: 'Close', exact: true }).click();
  if (!await target.getByRole('heading', { name: 'Projects', exact: true }).count()) await target.getByRole('button', { name: 'Back', exact: true }).click();
  await target.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
  const origin = await target.evaluate(() => performance.timeOrigin);
  await device.screenshot({ path: 'artifacts/phone-language-home-en.png' });
  await target.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
  await target.getByRole('article', { name: 'Assistant response', exact: true }).first().waitFor({ timeout: 60000 });
  const input = target.getByRole('textbox', { name: 'Message', exact: true });
  draft = await input.inputValue();
  if (nativeShare) {
    const { verifyNativeShareLanguage } = await import('./verify-native-share-language-android.mjs');
    report.nativeShare = [];
    await verifyNativeShareLanguage(target, device, async language => {
      const phone = await ordinary(); await change(phone, language); await openRemote(phone);
    }, report.nativeShare);
  }
  if (nativeKey) {
    const { verifyNativeKeyLanguage } = await import('./verify-native-key-language-android.mjs');
    report.nativeKey = [];
    await verifyNativeKeyLanguage(target, device, async language => {
      const phone = await ordinary(); await change(phone, language); await openRemote(phone);
    }, report.nativeKey);
  }
  if (notices) {
    const { verifyNativeNoticeLanguage } = await import('./verify-native-notice-language-android.mjs');
    report.notices = [];
    await verifyNativeNoticeLanguage(target, device, { ordinary, change, openRemote }, report.notices);
  }
  if (navigation) {
    const { verifyNavigationLanguage } = await import('./verify-navigation-language-android.mjs');
    report.navigation = [];
    await verifyNavigationLanguage(target, device, async language => {
      const phone = await ordinary(); await change(phone, language); await openRemote(phone);
    }, report.navigation);
  }
  if (settings) {
    report.settings = [];
    await target.getByRole('button', { name: 'Remote options', exact: true }).click();
    await target.getByRole('button', { name: 'Computer settings', exact: true }).click();
    let panel = target.getByRole('dialog', { name: 'Computer settings', exact: true });
    await panel.getByText('Grant this device management access on the computer before viewing or changing its settings.', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('textbox').count(), 0);
    await device.screenshot({ path: 'artifacts/settings-language-denied-en.png' });
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    report.settings.push('Real computer settings entry denies access without management grant; no configuration read or write');
    await target.getByRole('button', { name: 'Remote options', exact: true }).click();
    await target.getByRole('button', { name: 'Computer plugins', exact: true }).click();
    panel = target.getByRole('dialog', { name: 'Computer plugins', exact: true });
    await panel.getByTestId('remote-plugin-list').waitFor();
    await panel.getByText('Provided by phone', { exact: true }).first().waitFor();
    const entries = await panel.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState, checked: row.querySelector('[role=switch]')?.getAttribute('aria-checked') })));
    assert.ok(entries.length > 0);
    await device.screenshot({ path: 'artifacts/settings-language-plugins-en.png' });
    await change(await ordinary(), 'zh'); await openRemote(phone);
    panel = target.getByRole('dialog', { name: '电脑插件', exact: true });
    await panel.getByText('由手机提供', { exact: true }).first().waitFor();
    assert.deepEqual(await panel.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState, checked: row.querySelector('[role=switch]')?.getAttribute('aria-checked') }))), entries);
    await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.settings.push({ check: 'Same real plugin list and auto-fit preferences preserved across language; no plugin or layout changes', entries: entries.length });
    await change(await ordinary(), 'en'); await openRemote(phone);
  }
  if (tasks) {
    report.tasks = [];
    await target.getByRole('button', { name: 'Remote options', exact: true }).click();
    await target.getByRole('button', { name: 'Current goal', exact: true }).click();
    let panel = target.getByRole('dialog', { name: 'Current goal', exact: true });
    await panel.getByRole('button', { name: 'Reload goal', exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Reload goal', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Goal', exact: true }).waitFor();
    await panel.getByRole('textbox', { name: 'Goal', exact: true }).fill('DSHM 未提交的目标编辑');
    await panel.getByRole('spinbutton', { name: 'Maximum turns', exact: true }).fill('7');
    await device.screenshot({ path: 'artifacts/task-language-goal-en.png' });
    await change(await ordinary(), 'zh'); await openRemote(phone);
    panel = target.getByRole('dialog', { name: '当前目标', exact: true });
    assert.equal(await panel.getByRole('textbox', { name: '目标内容', exact: true }).inputValue(), 'DSHM 未提交的目标编辑');
    assert.equal(await panel.getByRole('spinbutton', { name: '最多执行轮次', exact: true }).inputValue(), '7');
    await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.tasks.push('Actual goal read and unsubmitted edit preserved across language; no goal created or changed');
    await change(await ordinary(), 'en'); await openRemote(phone);
    for (const [name, selector, screenshot] of [['Background tasks', '.remote-jobs', 'jobs'], ['Scheduled tasks', null, 'schedules']]) {
      await target.getByRole('button', { name: 'Remote options', exact: true }).click();
      await target.getByRole('button', { name, exact: true }).click();
      panel = target.getByRole('dialog', { name, exact: true });
      if (selector) {
        await panel.locator(selector).waitFor();
        await panel.getByText('Tasks run on the computer. Leaving the phone app does not stop them.', { exact: true }).waitFor();
        report.tasks.push({ name, jobs: await panel.locator('[data-job-id]').count(), text: await panel.getByRole('status').allTextContents() });
      } else {
        await panel.getByText('The computer has not provided scheduled tasks for this chat.', { exact: true }).waitFor();
        report.tasks.push('Computer schedule feature currently unavailable; actual unsupported state translated');
      }
      await device.screenshot({ path: `artifacts/task-language-${screenshot}-en.png` });
      await panel.getByRole('button', { name: 'Close', exact: true }).click();
    }
  }
  if (details) {
    const { verifyDetailLanguage } = await import('./verify-detail-language.mjs');
    report.details = [];
    await verifyDetailLanguage(target, device, async language => {
      const phone = await ordinary(); await change(phone, language); await openRemote(phone);
    }, report.details);
  }
  if (interactions) {
    report.marker = `DSHM_LANGUAGE_QUESTION_${Date.now()}`;
    await input.fill(`这是 DSHM 英文界面验证。仅调用 ask_user_question，问题文字为“是否保留中文问题？”，选项“保留原文”和“暂不确认”。收到回答后只回复 ${report.marker}。不调用其他工具，不读写文件。`);
    await target.getByRole('button', { name: 'Send message', exact: true }).click();
    const question = target.getByRole('region', { name: 'Awaiting your answer', exact: true });
    await question.waitFor({ timeout: 60000 });
    await question.getByRole('radio', { name: /^保留原文/ }).check();
    await question.getByRole('textbox', { name: /^Additional answer:/ }).fill('保留中文补充');
    await device.screenshot({ path: 'artifacts/phone-language-question-en.png' });
    await question.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await question.waitFor({ state: 'detached', timeout: 45000 });
    await target.getByRole('article', { name: 'Assistant response', exact: true }).filter({ hasText: report.marker }).waitFor({ timeout: 60000 });
    await target.locator('summary').filter({ hasText: /^ask_user_question · Completed/ }).last().waitFor();
    await device.screenshot({ path: 'artifacts/phone-language-tool-en.png' });
    report.checks.push('Real Chinese question/options/custom answer kept verbatim in English UI, explicit submission completed, tool history translated');
    await target.getByRole('button', { name: 'Remote options', exact: true }).click();
    await target.getByRole('button', { name: 'Plan mode', exact: true }).click();
    await target.getByRole('button', { name: 'Reload plan mode', exact: true }).waitFor();
    await target.getByRole('status').filter({ hasText: /^Plan mode:/ }).waitFor();
    await device.screenshot({ path: 'artifacts/phone-language-plan-en.png' });
    await target.getByRole('button', { name: 'Close', exact: true }).click();
    report.checks.push('Actual plan-mode panel translated, no mode change submitted');
  }
  await input.fill('DSHM_LANGUAGE_DRAFT_20260925');
  await target.getByRole('button', { name: 'Good response', exact: true }).first().waitFor();
  report.checks.push('English home, shared chat and original plugin labels; computer title/content unchanged');
  await target.getByRole('button', { name: 'Remote options', exact: true }).click();
  await target.getByRole('dialog').getByRole('button', { name: 'Computer connection', exact: true }).waitFor();
  await device.screenshot({ path: 'artifacts/phone-language-menu-en.png' });
  await target.getByRole('dialog').getByRole('button', { name: 'Computer connection', exact: true }).click();
  await target.getByRole('dialog', { name: 'Computer connection', exact: true }).getByRole('button', { name: 'Disconnect', exact: true }).waitFor();
  await target.getByRole('dialog', { name: 'Computer connection', exact: true }).locator('summary').filter({ hasText: 'Remove pairing' }).waitFor();
  report.checks.push('Actual connection menu translated; no disconnect or pairing removal performed');
  await device.screenshot({ path: 'artifacts/phone-language-connection-en.png' });
  await target.getByRole('button', { name: 'Close', exact: true }).click();
  phone = await ordinary(); await change(phone, 'zh'); await openRemote(phone);
  await target.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await target.getByRole('button', { name: '好的回答', exact: true }).first().waitFor();
  assert.equal(await target.evaluate(() => performance.timeOrigin), origin);
  assert.equal(await target.getByRole('textbox', { name: '消息', exact: true }).inputValue(), 'DSHM_LANGUAGE_DRAFT_20260925');
  report.checks.push('Existing Remote page and original plugin switch back to Chinese, draft preserved');
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  try {
    if (target && !target.isClosed()) {
      const detailClose = target.getByRole('button', { name: /^(Close file preview|Close changes preview|Close command details|关闭文件预览|关闭改动预览|关闭命令详情)$/ });
      if (await detailClose.count()) await detailClose.click();
    }
    if (target && !target.isClosed() && await target.getByRole('button', { name: /^(Close|关闭窗口)$/ }).count()) await target.getByRole('button', { name: /^(Close|关闭窗口)$/ }).click();
    if (draft !== undefined && target && !target.isClosed()) await target.locator('textarea').fill(draft);
    if (original) {
      const phone = await ordinary(); await change(phone, original.startsWith('en') ? 'en' : 'zh');
      if (target && !target.isClosed()) {
        await openRemote(phone);
        await target.waitForFunction(lang => document.documentElement.lang === lang, original);
        await ordinary();
      }
      await phone.getByRole('button', { name: /^(返回设置首页|Back to settings)$/ }).click();
      await phone.getByRole('button', { name: /^(退出设置|Close settings)$/ }).click();
      report.restored = true;
    }
  } catch (error) { report.restoreFailure = error.message; process.exitCode = 1; }
  await writeFile(`artifacts/phone-language${interactions ? '-interactions' : details ? '-details' : tasks ? '-tasks' : settings ? '-settings' : navigation ? '-navigation' : notices ? '-native-notices' : nativeKey ? '-native-key' : nativeShare ? '-native-share' : ''}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
