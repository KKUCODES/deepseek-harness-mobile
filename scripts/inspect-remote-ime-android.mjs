import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只聚焦既有测试会话，不输入或发送消息，也不更换系统输入法。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString() };
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.innerText();
  const measure = () => page.evaluate(() => ({ height: innerHeight, visualHeight: visualViewport.height,
    editorBottom: document.querySelector('[contenteditable="true"]')?.getBoundingClientRect().bottom }));
  report.before = await measure();
  await device.shell('uiautomator dump /data/local/tmp/dshm-ime.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-ime.xml')).toString();
  const views = [...xml.matchAll(/<node\b[^>]+class="android.webkit.WebView"[^>]+bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)];
  const bounds = [...new Set(views.map(view => view.slice(1).join(',')))];
  assert.equal(bounds.length, 1, 'WebView宿主与可访问性子节点必须指向同一屏幕区域');
  const [left, top, right] = bounds[0].split(',').map(Number);
  const box = await input.boundingBox(); assert.ok(box);
  const width = await page.evaluate(() => innerWidth), scale = (right - left) / width;
  await device.shell(`input tap ${Math.round(left + (box.x + box.width / 2) * scale)} ${Math.round(top + (box.y + box.height / 2) * scale)}`);
  const deadline = Date.now() + 5000;
  do {
    const ime = (await device.shell('dumpsys input_method')).toString();
    report.shown = /mInputShown=true/.test(ime);
    report.after = await measure();
    if (report.shown && report.after.visualHeight < report.before.visualHeight - 100) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  // 必须在返回键之前采样，收起后的零高度不能证明键盘从未显示。
  const windows = (await device.shell('dumpsys window windows')).toString();
  const imeWindow = windows.split(/(?=  Window #\d+ Window\{)/).find(section => /^  Window #\d+ Window\{[^\n]*InputMethod\}/.test(section));
  report.imeWindow = imeWindow?.split('\n').filter(line => /mViewVisibility=|mHasSurface=|mFrame=/.test(line)).map(line => line.trim()) ?? [];
  report.inputMethod = (await device.shell('settings get secure default_input_method')).toString().trim();
  report.showWithHardwareKeyboard = (await device.shell('settings get secure show_ime_with_hard_keyboard')).toString().trim();
  await device.screenshot({ path: 'artifacts/remote-ime-inspect.png' });
  report.draftPreserved = await input.innerText() === draft;
  assert.ok(report.draftPreserved);
  if (report.shown) await device.shell('input keyevent KEYCODE_BACK');
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await device.shell('rm -f /data/local/tmp/dshm-ime.xml').catch(() => {}); await writeFile('artifacts/remote-ime-inspect.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
