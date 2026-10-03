import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const host = () => readFile('artifacts/model-readiness-host.json', 'utf8').then(JSON.parse);
const save = process.argv.includes('--save');
async function command(action) {
  const { id } = await host(), sequence = randomUUID();
  await writeFile('artifacts/model-readiness-command.json', JSON.stringify({ id, sequence, action }));
  for (let i = 0; i < 100; i++) {
    const state = await host();
    if (state.command === sequence) { assert.equal(state.failed, false, 'Host rejected test precondition or restoration'); return state; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host action timed out; inspect restoration status');
}
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), errors: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
let nativeOpen = false;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/')); assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const initialWelcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await initialWelcome.isVisible()) await button(initialWelcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  await command('missing');
  await button(main, '返回').click();
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  const dialog = page.getByRole('dialog', { name: '添加一个 API Key 开始使用', exact: true });
  await dialog.waitFor(); await dialog.getByText('尚未配置', { exact: true }).waitFor();
  assert.equal(await dialog.locator('input[type=password]').count(), 0);
  await page.screenshot({ path: 'artifacts/model-missing-android.png' });
  await button(dialog, '管理电脑 Key').click(); nativeOpen = true;
  await device.shell('uiautomator dump /data/local/tmp/dshm-onboarding-check.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-onboarding-check.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]]))).filter(node => node.package === 'dev.dshmobile.validation');
  assert.ok(nodes.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  if (save) {
    const field = nodes.find(node => node.class === 'android.widget.EditText' && node.password === 'true');
    const tap = async node => { assert.ok(node); const p = node.bounds.match(/\d+/g).map(Number); await device.shell(`input tap ${Math.floor((p[0]+p[2])/2)} ${Math.floor((p[1]+p[3])/2)}`); };
    await tap(field);
    // 无效的独立测试值只验证真实凭据保存，不会发起模型请求或冒充API鉴权通过。
    await device.shell(`input text dshm-onboarding-test-${randomUUID()}`);
    await device.shell('input keyevent KEYCODE_BACK');
    await device.shell('uiautomator dump /data/local/tmp/dshm-onboarding-save.xml');
    const savedXml = (await device.shell('cat /data/local/tmp/dshm-onboarding-save.xml')).toString();
    const saveNode = [...savedXml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]]))).find(node => node.text === '保存到电脑' && node.class === 'android.widget.Button');
    await tap(saveNode); nativeOpen = false;
    await dialog.waitFor({ state: 'detached' });
    assert.equal((await command('verify-saved')).testCredentialConfigured, true);
    report.nativeSaveVerifiedByHost = true;
    report.savedEventCompletes = true;
  } else {
  const cancel = nodes.filter(node => node.text === '取消' && node.class === 'android.widget.Button'); assert.equal(cancel.length, 1);
  const points = cancel[0].bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`); nativeOpen = false;
  await button(dialog, '稍后配置').click(); await dialog.waitFor({ state: 'detached' });
  report.nativeCancelledAndLater = true;
  }
  const row = main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) });
  await row.click(); await input.waitFor(); assert.equal(await input.textContent(), draft);
  if (!save) {
    await button(main, '返回').click(); await dialog.waitFor();
    await command('restore'); await dialog.waitFor({ state: 'detached' }); report.restoredEventCompletes = true;
    await row.click(); await input.waitFor(); assert.equal(await input.textContent(), draft);
  }
  report.draftPreserved = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; throw error; }
finally {
  if (nativeOpen) await device.shell('input keyevent KEYCODE_BACK').catch(() => {});
  try { report.restored = (await command('restore')).changed === false; }
  finally { await writeFile(`artifacts/model-${save ? 'save' : 'missing'}-android.json`, JSON.stringify(report, null, 2)); await device.close(); }
}
console.log(JSON.stringify(report));
process.exit(0);
