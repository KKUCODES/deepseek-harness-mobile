import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

// 只进入隔离调试包；重放真实Remote组件生成的DOM/CSS，验证旧WebView的sticky布局。
// 先运行verify-preview15-history.mjs --code-block生成无用户数据的快照。
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === (process.env.DSHM_ANDROID_SERIAL ?? 'emulator-5554'));
assert.ok(device);
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation.rc21test' })).page();
  const html = (await readFile('artifacts/code-block-dom.html', 'utf8'))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
  await page.setContent(html);
  const css = (await readFile('artifacts/tests/preview15-history/0.2.1-rc.2-candidate-code-block/test.css', 'utf8'))
    .replace(/url\(["']?(?:\.\/)?(JetBrainsMono[^)"']+)["']?\)/g, 'url("https://appassets.androidplatform.net/assets/web/$1")');
  await page.addStyleTag({ content: css });
  await page.evaluate(() => document.fonts.load('11px "JetBrains Mono"'));
  const geometry = await page.evaluate(() => {
    const group = document.querySelector('.remote-history-group'), list = document.querySelector('.remote-history-list');
    const chat = document.querySelector('.conversation'), card = group.querySelector('.md-code-block');
    // 相同远端组件，放到5000px的已读历史位置；不能只检查首屏零偏移代码块。
    if (getComputedStyle(group).transform === 'none') group.style.top = '5000px';
    else group.style.transform = 'translateY(5000px)';
    list.style.height = '6500px';
    chat.scrollTop += card.getBoundingClientRect().top - chat.getBoundingClientRect().top + 100;
    const rect = el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, height: el.getBoundingClientRect().height });
    return { chat: rect(chat), card: rect(card), banner: rect(card.querySelector('[data-code-block-banner]')) };
  });
  const expected = Math.min(geometry.card.bottom - geometry.banner.height, Math.max(geometry.card.top, geometry.chat.top));
  assert.ok(Math.abs(geometry.banner.top - expected) < 2, JSON.stringify(geometry));
  const cdp = await page.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const highlighted = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.md-code-block pre code .line span' });
  const { nodeId } = highlighted.nodeId ? highlighted : await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.md-code-block pre code' });
  const fonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  assert.ok(fonts.fonts.some(font => font.familyName === 'JetBrains Mono' && font.isCustomFont), JSON.stringify(fonts));
  await cdp.detach();
  const report = { environment: 'Isolated MuMu WebView; real component DOM/CSS snapshot, not a live model', geometry, fonts };
  await writeFile('artifacts/code-block-native-layout.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await device.close(); }
