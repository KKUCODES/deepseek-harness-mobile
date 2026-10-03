import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只操作专用聊天和独立标题插件的计数器，不发送消息或修改草稿。
const cleanup = process.argv.includes('--cleanup');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const openedBy = Date.now() + 20000;
  while (!page && Date.now() < openedBy) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true }), draft = await editor.innerText();
  const parts = ['leading', 'actions', 'utilities', 'corner'];
  const labels = { leading: '前置', actions: '操作', utilities: '工具', corner: '角落' };
  const actions = page.getByTestId('live-header-actions'), utilities = page.getByTestId('live-header-utilities');
  if (cleanup) {
    for (const part of parts) await page.getByTestId(`live-header-${part}`).waitFor({ state: 'detached' });
    assert.equal(await page.locator('.remote-header-extensions').evaluate(node => node.clientHeight), 0);
    report.unloadedNoGap = true;
  } else {
    await actions.waitFor(); await utilities.waitFor();
    const session = await actions.getAttribute('data-session'); assert.ok(session);
    assert.equal(await utilities.getAttribute('data-session'), session);
    const beforeActions = Number((await actions.innerText()).match(/\d+$/)[0]);
    const beforeUtilities = Number((await utilities.innerText()).match(/\d+$/)[0]);
    await actions.click(); await utilities.click();
    assert.equal(await actions.innerText(), `标题操作验证 ${beforeActions + 1}`);
    assert.equal(await utilities.innerText(), `标题工具验证 ${beforeUtilities + 1}`);
    for (const part of ['leading', 'corner']) {
      const node = page.getByTestId(`live-header-${part}`);
      await node.waitFor(); assert.equal(await node.getAttribute('data-session'), session);
      const before = Number((await node.innerText()).match(/\d+$/)[0]);
      await node.click(); assert.equal(await node.innerText(), `标题${labels[part]}验证 ${before + 1}`);
    }
    assert.deepEqual(await page.locator('.remote-header-extensions [data-testid]').evaluateAll(nodes => nodes.map(node => node.dataset.testid)), parts.map(part => `live-header-${part}`));
    report.leadingAndCorner = true;
    report.sameSession = true; report.interactive = true;
    report.geometry = await actions.evaluate(node => ({ original: node.offsetWidth, displayed: node.getBoundingClientRect().width, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
    assert.equal(report.geometry.original, 720);
    assert.ok(report.geometry.displayed <= report.geometry.viewport + 0.1);
    assert.ok(report.geometry.pageWidth <= report.geometry.viewport);
    assert.equal(await page.getByRole('button', { name: /^Agent 模式，当前/ }).count(), 1);
    report.ownModePreserved = true;
    await page.screenshot({ path: 'artifacts/header-edges-live-android.png' });
    await page.getByRole('button', { name: '返回', exact: true }).click();
    for (const part of parts) await page.getByTestId(`live-header-${part}`).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await actions.waitFor(); assert.equal(await actions.getAttribute('data-session'), session);
    await actions.click(); assert.equal(await actions.innerText(), '标题操作验证 1');
    for (const part of ['leading', 'corner']) {
      const node = page.getByTestId(`live-header-${part}`);
      assert.equal(await node.getAttribute('data-session'), session);
      await node.click(); assert.equal(await node.innerText(), `标题${labels[part]}验证 1`);
    }
    report.reentered = true;
  }
  assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
  if (page) await page.screenshot({ path: 'artifacts/header-edges-failure-android.png' }).catch(() => {});
  throw error;
} finally {
  await writeFile(`artifacts/header-edges-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
