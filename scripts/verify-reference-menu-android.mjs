import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const source = JSON.parse(await readFile('artifacts/reference-send-seed.json', 'utf8'));
const fixed = process.argv.includes('--fixed');
const report = { at: new Date().toISOString(), fixed, errors: [] };
const d = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(d);
let input, page, prepared = false;
try {
  page = (await (await androidAppWebView(d)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  input = main.getByRole('textbox', { name: '消息', exact: true });
  assert.equal(await input.textContent(), ''); prepared = true;
  await input.fill(`@${source.sourceTitle.split(' ').at(-1)}`);
  await page.getByRole('listbox', { name: '触发候选建议', exact: true }).getByRole('option').filter({ hasText: source.sourceTitle }).click();
  await input.locator('[data-composer-chip]').waitFor();
  report.before = await input.locator('[data-composer-chip]').count();
  await main.getByRole('button', { name: '添加附件', exact: true }).click();
  await page.getByRole('dialog', { name: '附件', exact: true }).getByRole('button', { name: '引用文件或聊天', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
  await picker.getByRole('searchbox', { name: '搜索文件或聊天', exact: true }).fill(source.sourceTitle);
  await picker.getByRole('button', { name: `引用 ${source.sourceTitle}`, exact: true }).click();
  await picker.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="remote-workspace"] [data-composer-chip]').length !== 1);
  report.after = await input.locator('[data-composer-chip]').count();
  assert.equal(report.after, 2, '菜单选择必须保留原引用并插入新的结构化引用');
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await input.locator('[data-composer-chip]').first().waitFor();
  assert.equal(await input.locator('[data-composer-chip]').count(), 2);
  report.reopened = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (prepared) {
    const picker = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
    if (await picker.isVisible()) await picker.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await input.fill(''); report.originalDraftRestored = await input.textContent() === '';
  }
  await writeFile(`artifacts/reference-menu-${fixed ? 'fixed' : 'before'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await d.close();
}
