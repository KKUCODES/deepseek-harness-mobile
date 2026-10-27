import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { checkChatTable } from './check-chat-table.mjs';

// 正式Remote组件生成的无用户数据快照，在隔离调试包中执行真正的WebView触摸滚动。
// 先运行verify-preview15-history.mjs --table；不修改设备上的聊天/Key/配对。
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === (process.env.DSHM_ANDROID_SERIAL ?? 'emulator-5554'));
assert.ok(device);
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation.rc21test' })).page();
  const html = (await readFile('artifacts/chat-table-dom.html', 'utf8'))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
  await page.setContent(html);
  const css = (await readFile('artifacts/tests/preview15-history/0.2.1-rc.2-candidate-table/test.css', 'utf8'))
    .replace(/url\(["']?(?:\.\/)?(JetBrainsMono[^)"']+)["']?\)/g, 'url("https://appassets.androidplatform.net/assets/web/$1")');
  await page.addStyleTag({ content: css });
  const report = { source: 'MuMu isolated debug WebView; real component DOM/CSS snapshot, no model requests',
    table: await checkChatTable(page, page.getByTestId('remote-workspace')) };
  await writeFile('artifacts/chat-table-native.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await device.close(); }
