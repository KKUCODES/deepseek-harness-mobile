import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 失败验收后的定向收尾：只允许恢复报告所属测试会话及完全匹配的临时草稿。
const source = await readFile('artifacts/original-interactions-timeout-android.json', 'utf8').then(JSON.parse);
assert.equal(source.nextRequestIndependent, true);
assert.equal(source.timeouts.length, 2);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const read = () => input.evaluate(node => node.textContent === '' ? '' : node.innerText);
  const current = await read();
  assert.ok(current === source.draft || current === `${source.draft}DSHM_TIMEOUT_DRAFT`);
  if (current !== source.draft) {
    await input.press('ControlOrMeta+A'); await input.press('Backspace');
    if (source.draft) await input.fill(source.draft);
  }
  await input.press('Tab');
  assert.equal(await read(), source.draft);
  await writeFile('artifacts/interaction-timeout-draft-cleanup.json', JSON.stringify({ at: new Date().toISOString(), alreadyRestored: current === source.draft, draftRestored: true }));
  console.log('Original draft restored; no model request or other chat modified.');
} finally { await device.close(); }
