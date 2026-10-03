import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 原生窗口边界专项：使用无效测试快照，只打开空窗口并取消；不尝试保存、移除或授予权限。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), scope: 'Native bridge validation and empty dialog cancellation, not authorized settings save', errors: [] };
let page, installed = false;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url() === 'https://remote.dshm.invalid/assets/web/remote.html');
  assert.ok(page);
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, previous = bridge.onmessage;
    const pending = new Map(), results = new Map();
    bridge.onmessage = event => {
      let response; try { response = JSON.parse(event.data); } catch { return previous?.(event); }
      if (!pending.has(response.id)) return previous?.(event);
      results.set(response.id, response); pending.delete(response.id);
    };
    window.__providerKeyProbe = {
      send(op, data) { const id = crypto.randomUUID(); pending.set(id, true); bridge.postMessage(JSON.stringify({ id, op, data })); return id; },
      results, restore() { bridge.onmessage = previous; delete window.__providerKeyProbe; },
    };
  }); installed = true;
  for (const target of [{ provider: '' }, { provider: 'alpha', ref: 'FORBIDDEN' }, { provider: '__proto__' }, { provider: 1 }, null]) {
    const id = await page.evaluate(target => window.__providerKeyProbe.send('computerKey.configure', { snapshot: crypto.randomUUID(), target }), target);
    await page.waitForFunction(id => window.__providerKeyProbe.results.has(id), id);
    assert.equal(await page.evaluate(id => window.__providerKeyProbe.results.get(id).error, id), 'remote_key_invalid');
  }
  const id = await page.evaluate(() => window.__providerKeyProbe.send('computerKey.configure', { snapshot: crypto.randomUUID(), target: { provider: 'DSHM_NATIVE_DIALOG_TEST' } }));
  await device.shell('uiautomator dump /data/local/tmp/dshm-provider-key-check.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-provider-key-check.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
  assert.ok(nodes.some(node => node.text === '电脑提供方 Key：DSHM_NATIVE_DIALOG_TEST'));
  assert.ok(nodes.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
  const cancel = nodes.filter(node => node.text === '取消' && node.class === 'android.widget.Button');
  assert.equal(cancel.length, 1);
  const points = cancel[0].bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((points[0] + points[2]) / 2)} ${Math.floor((points[1] + points[3]) / 2)}`);
  await page.waitForFunction(id => window.__providerKeyProbe.results.has(id), id);
  assert.deepEqual(await page.evaluate(id => window.__providerKeyProbe.results.get(id).data, id), { cancelled: true });
  report.invalidTargetsRejected = 5; report.emptyPasswordDialog = true; report.cancelled = true;
} catch (error) { report.errors.push(error.message); throw error; }
finally {
  if (installed) {
    await page.evaluate(() => window.__providerKeyProbe.send('computerKey.cancel', {})).catch(() => {});
    await page.evaluate(() => window.__providerKeyProbe.restore()).catch(() => {});
  }
  await device.shell('rm -f /data/local/tmp/dshm-provider-key-check.xml').catch(() => {});
  await writeFile('artifacts/provider-key-native-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
