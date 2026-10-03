import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { chromium, _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { attachmentImageFixture } from './attachment-image-fixture.mjs';
import { spawn } from 'node:child_process';

// 仅创建独立图片夹具，经真实手机文件树和Host读取；不发送模型消息或修改已有文件。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const parent = resolve('../DSH-TEST'), root = resolve(parent, `dshm-image-formats-${Date.now()}`);
assert.equal(dirname(root), parent);
const report = { at: new Date().toISOString(), errors: [], resources: [], images: [] };
const boundaries = process.argv.includes('--boundaries');
const animated = process.argv.includes('--animated');
assert.ok(!(boundaries && animated));
const artifactPrefix = animated ? 'image-animated' : boundaries ? 'image-boundaries' : 'image-formats';
const files = new Map(), written = [];
let device, page, panel, created = false, draft;

async function animationFixture(operation, input = '') {
  assert.ok(process.env.DSHM_TEST_PYTHON, 'Set DSHM_TEST_PYTHON to a Python runtime with Pillow');
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.DSHM_TEST_PYTHON, ['scripts/animated-image-fixture.py', operation],
      { cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('close', code => { if (code) reject(new Error(error || `Fixture exited ${code}`)); else {
      try { resolve(JSON.parse(output)); } catch (cause) { reject(cause); }
    } });
    child.stdin.on('error', reject); child.stdin.end(input);
  });
}

async function fixtures() {
  if (animated) {
    const encoded = await animationFixture('generate');
    for (const [type, value] of Object.entries(encoded)) files.set(`animated.${type}`, Buffer.from(value, 'base64'));
    return;
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let encoded;
  try {
    const canvasPage = await browser.newPage();
    encoded = await canvasPage.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ['#e61919', '#19e619', '#1919e6'].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(i * 40, 0, 40, 80); });
      return Object.fromEntries(['png', 'jpeg', 'webp'].map(type => [type, canvas.toDataURL(`image/${type}`, 0.95)]));
    });
  } finally { await browser.close(); }
  for (const [type, url] of Object.entries(encoded)) {
    assert.ok(url.startsWith(`data:image/${type};base64,`));
    files.set(`sample.${type}`, Buffer.from(url.split(',')[1], 'base64'));
  }
  files.set('sample.jpg', files.get('sample.jpeg'));
  const bitmap = Buffer.alloc(54 + 120 * 80 * 3);
  bitmap.write('BM'); bitmap.writeUInt32LE(bitmap.length, 2); bitmap.writeUInt32LE(54, 10);
  bitmap.writeUInt32LE(40, 14); bitmap.writeInt32LE(120, 18); bitmap.writeInt32LE(80, 22);
  bitmap.writeUInt16LE(1, 26); bitmap.writeUInt16LE(24, 28); bitmap.writeUInt32LE(bitmap.length - 54, 34);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) {
    const rgb = [25, 25, 25]; rgb[Math.floor(x / 40)] = 230;
    Buffer.from(rgb.reverse()).copy(bitmap, 54 + (y * 120 + x) * 3);
  }
  files.set('sample.bmp', bitmap);
  const png = files.get('sample.png'), ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = 120; ico[7] = 80;
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
  files.set('sample.ico', Buffer.concat([ico, png]));
  files.set('sample.gif', Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
  if (boundaries) {
    files.clear();
    files.set('wide.png', attachmentImageFixture(2048, 1024));
    files.set('tall.png', attachmentImageFixture(512, 4096));
  }
  files.set('broken.png', Buffer.from('DSHM deliberately invalid image fixture'));
}

try {
  await fixtures();
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(20000);
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, 'Open the existing Remote session first'); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  draft = await editor.innerText();
  await mkdir(root); created = true;
  for (const [name, value] of files) { await writeFile(resolve(root, name), value, { flag: 'wx' }); written.push(name); }
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const fileNav = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
  if (await fileNav.count()) await fileNav.click(); else await panel.getByRole('button', { name: /工作区文件/ }).click();
  const tree = panel.locator('[data-files-state="tree"]'); await tree.waitFor();
  assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(), parent.replaceAll('\\', '/').toLowerCase());
  await tree.getByRole('button', { name: '重新读取', exact: true }).click();
  const folder = tree.getByRole('button', { name: basename(root), exact: true });
  await folder.waitFor(); if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
  for (const name of files.keys()) {
    await tree.getByRole('button', { name, exact: true }).click();
    const active = panel.locator('.remote-document-tab:not([hidden])'), image = active.locator('[data-image-preview] img');
    if (animated) {
      await image.waitFor({ state: 'visible' });
      const size = await image.evaluate(node => ({ width: node.naturalWidth, height: node.naturalHeight }));
      assert.deepEqual(size, { width: 120, height: 80 });
      // canvas.drawImage并非动画播放证据；逐帧取实际WebView截图，读取中心像素。
      const colors = new Map(), deadline = Date.now() + 12000;
      while (colors.size < 3 && Date.now() < deadline) {
        const screenshot = await image.screenshot({ animations: 'allow' });
        const pixel = await animationFixture('pixel', screenshot.toString('base64'));
        const color = pixel.indexOf(Math.max(...pixel));
        assert.ok(pixel[color] > 200 && pixel[(color + 1) % 3] < 50 && pixel[(color + 2) % 3] < 50);
        if (!colors.has(color)) {
          colors.set(color, pixel);
          await writeFile(`artifacts/${artifactPrefix}-${name}-frame-${color}.png`, screenshot);
        }
      }
      assert.equal(colors.size, 3, `${name} must actually animate through all three colors`);
      report.images.push({ name, ...size, bytes: files.get(name).length, renderedFrames: [...colors.entries()].sort() });
    } else if (name === 'broken.png') {
      await active.locator('[data-image-preview]').getByRole('alert').waitFor();
      assert.equal(await image.isVisible(), false);
      report.corruptImage = await active.locator('[data-image-preview]').getByRole('alert').innerText();
      if (boundaries) {
        await page.screenshot({ path: `artifacts/${artifactPrefix}-broken-before-android.png` });
        assert.deepEqual(await readFile(resolve(root, name)), files.get(name));
        const repaired = attachmentImageFixture(180, 120, [2, 1, 0]);
        await writeFile(resolve(root, name), repaired); files.set(name, repaired);
        await active.getByRole('button', { name: '重新读取文件', exact: true }).click();
        await image.waitFor({ state: 'visible' });
        const restored = await image.evaluate(node => {
          const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(node, 0, 0);
          return { width: node.naturalWidth, height: node.naturalHeight, pixel: [...ctx.getImageData(20, 10, 1, 1).data] };
        });
        assert.deepEqual(restored, { width: 180, height: 120, pixel: [25, 25, 230, 255] });
        assert.equal(await active.locator('[data-image-preview]').getByRole('alert').count(), 0);
        report.repairedImage = restored;
      }
    } else {
      await image.waitFor({ state: 'visible' });
      const geometry = await image.evaluate(node => {
        const bounds = node.getBoundingClientRect(), canvas = document.createElement('canvas');
        canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(node, 0, 0);
        return { naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight, width: bounds.width, height: bounds.height,
          left: bounds.left, right: bounds.right, viewport: innerWidth,
          pixels: canvas.width > 1 ? [1, 3, 5].map(part => [...ctx.getImageData(Math.floor(canvas.width * part / 6), 20, 1, 1).data]) : [] };
      });
      const tiny = name.endsWith('.gif');
      const dimensions = name === 'wide.png' ? [2048, 1024] : name === 'tall.png' ? [512, 4096] : tiny ? [1, 1] : [120, 80];
      assert.equal(geometry.naturalWidth, dimensions[0]); assert.equal(geometry.naturalHeight, dimensions[1]);
      assert.ok(geometry.width > 0 && geometry.height > 0);
      assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1);
      assert.ok(Math.abs(geometry.width / geometry.height - dimensions[0] / dimensions[1]) < 0.02);
      if (boundaries) {
        assert.ok(geometry.width < geometry.naturalWidth, 'Oversized images must shrink to the actual phone pane');
        const scroll = active.locator('[data-textpreview-body]');
        const before = await scroll.evaluate(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }));
        assert.ok(before.scrollWidth <= before.clientWidth + 1, 'Image must not introduce horizontal scrolling');
        if (name === 'tall.png') {
          assert.ok(before.scrollHeight > before.clientHeight);
          await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
          const end = await scroll.evaluate(node => ({ top: node.scrollTop, height: node.clientHeight, total: node.scrollHeight }));
          assert.ok(end.top > 0 && Math.abs(end.top + end.height - end.total) <= 1);
          report.tallScroll = end;
        }
        geometry.bytes = files.get(name).length; geometry.scroll = before;
      }
      if (!tiny) geometry.pixels.forEach((pixel, i) => {
        assert.ok(pixel[i] > 200 && pixel[(i + 1) % 3] < 50 && pixel[(i + 2) % 3] < 50);
        assert.equal(pixel[3], 255);
      });
      report.images.push({ name, ...geometry });
    }
    await page.screenshot({ path: `artifacts/${artifactPrefix}-${name}-android.png` });
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await fileNav.click(); await tree.waitFor();
  }
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []); report.ok = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  try {
    if (panel && await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (created) {
      assert.deepEqual((await readdir(root)).sort(), [...written].sort());
      for (const name of written) assert.deepEqual(await readFile(resolve(root, name)), files.get(name));
      for (const name of written) await unlink(resolve(root, name));
      await rmdir(root); report.testFilesRemoved = true;
    }
  } catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
  await writeFile(`artifacts/${artifactPrefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device?.close();
}
