import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 复用已归档的三层专用测试记录；只读取和导航，不创建会话或发送模型请求。
const cleanup = process.argv.includes('--cleanup');
const prefix = process.env.DSHM_LINEAGE_PREFIX ?? 'lineage';
assert.match(prefix, /^[a-z0-9-]+$/);
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const nested = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-navigate.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const deadline = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
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
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const ancestors = page.getByRole('navigation', { name: '父级会话', exact: true });
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const openChild = async label => {
    await menu('子会话');
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: new RegExp(label) }).click();
  };
  if (!await history.count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await heading.locator('strong').innerText(), seed.original);
  const originalDraft = await editor.innerText();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await menu('查看已归档聊天');
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  const rootDraft = await editor.innerText();
  if (!cleanup) {
    const rootPlugin = heading.getByTestId('live-lineage'); await rootPlugin.waitFor();
    assert.equal(await rootPlugin.getAttribute('data-session'), await rootPlugin.getAttribute('data-lineage'));
    assert.equal(await rootPlugin.getAttribute('data-ancestor'), 'false');
    report.currentOwner = true;
  }
  await openChild('DSHM 恢复子会话');
  await history.getByText('CHILD_NESTED_DONE', { exact: true }).waitFor();
  const childDraft = await editor.innerText();
  await openChild('DSHM 恢复孙会话');
  await history.getByText(seed.marker, { exact: true }).waitFor();
  assert.equal(await editor.count(), 0); report.readOnlyGrandchild = true;
  if (cleanup) {
    await page.getByTestId('live-lineage').waitFor({ state: 'detached' });
    assert.equal(await heading.innerText(), nested.grandchildTitle);
    report.fallbackTitle = true;
  } else {
    const current = heading.getByTestId('live-lineage'); await current.waitFor();
    const ancestor = ancestors.getByTestId('live-lineage'); await ancestor.waitFor();
    assert.equal(await ancestor.getAttribute('data-ancestor'), 'true');
    assert.equal(await ancestor.getAttribute('data-session'), await current.getAttribute('data-session'));
    assert.notEqual(await ancestor.getAttribute('data-lineage'), await current.getAttribute('data-lineage'));
    assert.equal(await ancestor.innerText(), nested.childTitle); report.ancestorOwner = true;
    report.geometry = await current.evaluate(node => ({ original: node.offsetWidth, displayed: node.getBoundingClientRect().width, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }));
    assert.equal(report.geometry.original, 480);
    assert.ok(report.geometry.displayed < 480 && report.geometry.displayed <= report.geometry.viewport);
    assert.ok(report.geometry.pageWidth <= report.geometry.viewport);
  }
  await page.screenshot({ path: `artifacts/${prefix}-${cleanup ? 'fallback' : 'nested'}-android.png` });
  await ancestors.getByRole('button', { name: nested.childTitle, exact: true }).click();
  await editor.waitFor();
  assert.equal(await editor.innerText(), childDraft);
  await ancestors.getByRole('button', { name: seed.chat, exact: true }).click();
  await heading.getByText(seed.chat, { exact: true }).waitFor();
  assert.equal(await editor.innerText(), rootDraft); report.ancestorNavigationAndDrafts = true;
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).waitFor();
  report.stillArchived = true;
  await menu('查看最近聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await editor.innerText(), originalDraft); report.originalRestored = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-4000); await page.screenshot({ path: `artifacts/${prefix}-failure-android.png` }).catch(() => {}); }
  throw error;
} finally {
  await writeFile(`artifacts/${prefix}-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
