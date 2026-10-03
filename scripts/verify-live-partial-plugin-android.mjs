import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'verify'; assert.ok(['verify', 'author', 'unloaded'].includes(phase));
const id = '@dsh-mobile/partial-ui-verification';
const seed = JSON.parse(await readFile('artifacts/workspace-desktop-seed.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  assert.equal(await editor.inputValue(), '');
  const card = page.getByTestId('live-partial-card').first();
  const frame = page.locator(`[data-plugin-frame="${id}"]`).first();
  const menu = async () => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  };
  if (phase === 'verify') {
    await card.waitFor({ timeout: 60000 });
    await menu();
    const initialRow = page.locator(`[data-plugin-id="${id}"]`);
    const restore = initialRow.getByRole('button', { name: '恢复插件默认', exact: true });
    if (await restore.count()) await restore.click();
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.waitForFunction(id => {
      const frame = document.querySelector(`[data-plugin-frame="${id}"]`);
      const inner = frame?.firstElementChild;
      return inner && inner.getBoundingClientRect().width <= frame.clientWidth + 1;
    }, id);
    assert.equal(await frame.getAttribute('data-auto-fit'), 'true');
    report.geometry = await frame.evaluate(node => ({ outer: node.clientWidth, inner: node.firstElementChild.offsetWidth, displayed: node.firstElementChild.getBoundingClientRect().width }));
    assert.equal(report.geometry.inner, 720); assert.ok(report.geometry.displayed < 720);
    const counter = card.getByRole('button', { name: /^点击验证 / });
    const count = Number((await counter.innerText()).split(' ').at(-1)); assert.ok(Number.isSafeInteger(count));
    await counter.click();
    await card.getByRole('button', { name: `点击验证 ${count + 1}`, exact: true }).waitFor(); report.scaledClick = true;
    await card.getByRole('textbox', { name: '测试文件路径', exact: true }).fill(seed.path);
    await card.getByRole('button', { name: '预览测试文件', exact: true }).click();
    const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
    await preview.getByText(seed.marker, { exact: true }).waitFor();
    assert.equal(await preview.locator('pre').textContent(), await readFile(seed.path, 'utf8'));
    await preview.getByRole('button', { name: '在电脑打开', exact: true }).click();
    const confirm = preview.getByRole('group', { name: '确认在电脑打开', exact: true });
    await confirm.waitFor(); await confirm.getByRole('button', { name: '取消', exact: true }).click();
    await confirm.waitFor({ state: 'detached' }); report.sharedFilePreview = true;
    await page.screenshot({ path: 'artifacts/live-partial-file-android.png' });
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await menu();
    const row = page.locator(`[data-plugin-id="${id}"]`);
    assert.equal(await row.getAttribute('data-plugin-state'), 'active');
    await row.getByRole('switch').click();
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'false');
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await frame.getAttribute('data-auto-fit'), 'false');
    assert.equal(await frame.evaluate(node => getComputedStyle(node.firstElementChild).transform), 'none');
    assert.ok(Math.abs(await card.evaluate(node => node.getBoundingClientRect().width) - 720) < 1);
    report.userDisabled = true;
    await menu(); await row.getByRole('button', { name: '恢复插件默认', exact: true }).click();
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'true');
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.screenshot({ path: 'artifacts/live-partial-scaled-android.png' });
    report.defaultsRestored = true;
  } else if (phase === 'author') {
    await card.waitFor({ timeout: 60000 });
    await page.waitForFunction(id => document.querySelector(`[data-plugin-frame="${id}"]`)?.dataset.autoFit === 'false', id);
    assert.equal(await frame.evaluate(node => getComputedStyle(node.firstElementChild).transform), 'none');
    report.authorDisabled = true;
    await menu();
    const row = page.locator(`[data-plugin-id="${id}"]`);
    assert.equal(await row.getByRole('button', { name: '恢复插件默认', exact: true }).count(), 0);
    await row.getByRole('switch').click();
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'true');
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.waitForFunction(id => {
      const frame = document.querySelector(`[data-plugin-frame="${id}"]`);
      return frame?.dataset.autoFit === 'true' && frame.firstElementChild.getBoundingClientRect().width <= frame.clientWidth + 1;
    }, id);
    report.userOverridesAuthor = true;
    await menu(); await row.getByRole('button', { name: '恢复插件默认', exact: true }).click();
    assert.equal(await row.getByRole('switch').getAttribute('aria-checked'), 'false');
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await frame.getAttribute('data-auto-fit'), 'false'); report.defaultsRestored = true;
    await page.screenshot({ path: 'artifacts/live-partial-author-android.png' });
  } else {
    await card.waitFor({ state: 'detached', timeout: 60000 });
    await menu(); assert.equal(await page.locator(`[data-plugin-id="${id}"]`).count(), 0);
    await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.removedFromGraphAndUI = true;
  }
  assert.equal(await editor.inputValue(), ''); assert.deepEqual(report.errors, []); report.returned = true;
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-1500); await page.screenshot({ path: `artifacts/live-partial-${phase}-failed.png` }).catch(() => {}); }
} finally {
  await writeFile(`artifacts/live-partial-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
