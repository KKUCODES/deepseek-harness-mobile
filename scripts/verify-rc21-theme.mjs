import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('artifacts/official-rc21-mobile-dist');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const baseline of [true, false]) {
    const context = await browser.newContext(); const errors = []; let replacements = 0;
    await context.route('https://theme.dshm.invalid/**', async route => {
      const file = resolve(root, '.' + new URL(route.request().url()).pathname);
      assert.ok(!relative(root, file).startsWith('..'));
      let body = await readFile(file);
      if (baseline && extname(file) === '.js') {
        // 只在诊断响应恢复旧版“rc.2不提供主题默认字段”的条件，不改产品/DSH源码。
        body = Buffer.from(body.toString().replace(/themeDefaults:[\w$]+\("0\.2\.1-rc\.2"\)\?/g, () => {
          replacements++; return 'themeDefaults:false?';
        }));
      }
      await route.fulfill({ body, contentType: ({ '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] ?? 'application/octet-stream' });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('https://theme.dshm.invalid/mobile.html');
    if (baseline) {
      await page.waitForFunction(() => document.body.innerText.includes('inactive_plugins:'));
      assert.equal(replacements, 1);
      assert.match(await page.locator('body').innerText(), /inactive_plugins:@deepseek-ai\/dsh-client-ui-theme/);
    } else {
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
      assert.deepEqual(errors, []);
    }
    results.push({ baseline, replacements, errors, outcome: baseline ? 'theme_failure_reproduced' : 'ordinary_ready' });
    await context.close();
  }
  await writeFile('artifacts/rc21/theme-regression.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} finally { await browser.close(); }
