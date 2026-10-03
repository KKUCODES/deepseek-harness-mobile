import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
const device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const button = name => page.getByRole('button', { name, exact: true });
  if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
  assert.equal(await button('停止生成').count(), 0);
  await page.getByLabel('新聊天', { exact: true }).click();
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  await editor.fill(''); await editor.focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '/总', selectionStart: 2, selectionEnd: 2 });
  assert.equal(await editor.inputValue(), '/总');
  assert.equal(await page.locator('[data-trigger-menu]').count(), 0);
  await cdp.send('Input.insertText', { text: '/总' });
  await page.getByRole('option', { name: '总结', exact: true }).click();
  assert.equal(await editor.inputValue(), '请总结下面的内容：');
  await editor.fill('DSHM_IME_TEST'); await editor.press('Enter');
  assert.equal(await editor.inputValue(), 'DSHM_IME_TEST\n');
  await cdp.detach();
  const boundaries = await page.evaluate(async () => {
    const bridge = window.DSHMOrdinary; const previous = bridge.onmessage;
    const call = (op, data) => new Promise((resolve, reject) => {
      const id = crypto.randomUUID(); const timeout = setTimeout(() => reject(new Error('bridge_timeout')), 3000);
      bridge.onmessage = event => { const reply = JSON.parse(event.data); if (reply.id === id) { clearTimeout(timeout); resolve(reply); } else previous?.(event); };
      bridge.postMessage(JSON.stringify({ id, op, data }));
    });
    try {
      const basic = { requestId: crypto.randomUUID(), model: 'deepseek-flash', messages: [{ role: 'user', content: 'must not send' }] };
      const failures = [];
      for (const data of [{ ...basic, url: 'https://example.com' }, { ...basic, requestOptions: { maxTokens: '512' } }, { ...basic, requestOptions: { topP: 0.8 } }, { ...basic, messages: [{ role: 'system', content: 'test' }] }, { ...basic, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }] }] }]) failures.push((await call('request.open', data)).error);
      return { failures, noKeyRead: (await call('key.read', {})).error, noClipboardRead: (await call('clipboard.read', {})).error, unsafeLink: (await call('links.open', { url: 'file:///etc/passwd' })).error, noRemoteBridge: typeof window.DSHMRemote === 'undefined' };
    } finally { bridge.onmessage = previous; }
  });
  assert.deepEqual(boundaries.failures, ['invalid_request', 'invalid_preferences', 'invalid_preferences', 'invalid_message', 'invalid_image']);
  assert.equal(boundaries.noKeyRead, 'unsupported_operation'); assert.equal(boundaries.noClipboardRead, 'unsupported_operation'); assert.equal(boundaries.unsafeLink, 'invalid_link'); assert.equal(boundaries.noRemoteBridge, true);
  // 只进入独立 Remote 容器检查来源和能力，不配对、不连接远端或读取任何远端任务。
  await button('打开侧边抽屉').click(); await button('Remote').click();
  let remote;
  for (let i = 0; i < 30; i++) {
    remote = page.context().pages().find(candidate => candidate.url().includes('remote.dshm.invalid'));
    if (remote) break; await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(remote);
  assert.deepEqual(await remote.evaluate(() => ({ origin: location.origin, ordinary: typeof window.DSHMOrdinary })), { origin: 'https://remote.dshm.invalid', ordinary: 'undefined' });
  await remote.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  const result = { passed: true, boundaries, modeIsolation: true, ime: 'CDP composition in actual product WebView; not physical keyboard', enterAddsNewline: true };
  await writeFile('artifacts/ordinary-boundaries-android.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await device.close(); }
