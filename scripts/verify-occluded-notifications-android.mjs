import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { installReadingProbe, waitReading, removeReadingProbe } from './remote-reading-probe.mjs';

const clickBanner = process.argv.includes('--click');
const prefix = clickBanner ? 'occluded-notification-click' : 'occluded-notifications';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), errors: [], cases: [] };
let page;
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  await installReadingProbe(page);
  const probe = page.getByTestId('live-interactions'); await probe.waitFor();
  const sessionId = await probe.getAttribute('data-session');
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  const logs = async () => (await device.shell('logcat -d -v brief -s DSHMNotifications:D *:S')).toString();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const permissionSheet = page.getByRole('dialog', { name: '会话权限', exact: true });
  if (await permissionSheet.isVisible()) await permissionSheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  report.draft = await editor.evaluate(node => node.textContent === '' ? '' : node.innerText);
  await menu('会话权限');
  await page.getByRole('dialog', { name: '会话权限', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
  for (const kind of ['visible', 'sheet', 'plugin-modal', 'panel']) {
    if (kind === 'sheet') await menu('会话权限');
    if (kind === 'plugin-modal') await probe.getByRole('button', { name: '打开通知验证弹窗', exact: true }).click();
    if (kind === 'panel') await menu('插件面板');
    await waitReading(page, kind === 'visible' ? sessionId : null);
    const before = await logs();
    const id = `${Date.now()}-${kind}`;
    await writeFile('artifacts/original-interactions-host-control.json', JSON.stringify({ id, kind: 'question', sessionId }));
    const until = Date.now() + 15000;
    let notice;
    while (Date.now() < until) {
      notice = (await logs()).slice(before.length).split('\n').filter(line => line.includes('display kind=question')).at(-1);
      if (notice) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(notice, `未收到${kind}的真实通知事件`);
    assert.ok(notice.includes('foreground=RemoteActivity'), notice);
    assert.ok(notice.includes(`sameSession=${kind === 'visible'}`), notice);
    await device.screenshot({ path: `artifacts/occluded-notification-${kind}.png` });
    if (clickBanner && kind !== 'visible') {
      // MuMu的非聚焦PopupWindow不出现在无障碍树；该位置已通过实际横幅截图核验。
      assert.match((await device.shell('wm size')).toString(), /786x1624/);
      await device.shell('input tap 390 133');
      await waitReading(page, sessionId);
      assert.equal(await page.getByRole('dialog', { name: '会话权限', exact: true }).count(), 0);
      assert.equal(await page.getByRole('dialog', { name: '通知验证弹窗', exact: true }).count(), 0);
      assert.equal(await page.getByRole('region', { name: '插件面板', exact: true }).isVisible(), false);
    } else {
      if (kind === 'sheet') await page.getByRole('dialog', { name: '会话权限', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
      if (kind === 'plugin-modal') await page.getByRole('dialog', { name: '通知验证弹窗', exact: true }).getByRole('button', { name: '关闭通知验证弹窗', exact: true }).click();
      if (kind === 'panel') await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    await waitReading(page, sessionId);
    const question = page.locator('[data-question-key]');
    await question.getByRole('button', { name: '放弃整组问题', exact: true }).click();
    await question.waitFor({ state: 'detached' });
    const doneBy = Date.now() + 10000;
    let result;
    while (Date.now() < doneBy) {
      result = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
      if (result.id === id) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result?.id, id); assert.equal(result.error, 'ASK_CANCELLED');
    await editor.waitFor();
    assert.equal(await editor.evaluate(node => node.textContent === '' ? '' : node.innerText), report.draft);
    const notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
    assert.equal(notifications.length, 0);
    report.cases.push({ kind, notice, clicked: clickBanner && kind !== 'visible', returnedToReading: true, hostCancelled: true, systemNotifications: 0 });
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  report.hostResult = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => null);
  await device.screenshot({ path: `artifacts/${prefix}-failure.png` }).catch(() => {});
} finally {
  await unlink('artifacts/original-interactions-host-control.json').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (page) report.reading = await removeReadingProbe(page).catch(error => ({ error: error.message }));
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
