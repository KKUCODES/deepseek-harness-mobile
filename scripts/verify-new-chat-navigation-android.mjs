import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device);
const rapid = process.argv.includes('--rapid');
const prefix = rapid ? 'new-chat-rapid' : 'new-chat-navigation';
const report = { at: new Date().toISOString(), rapid, samples: [], errors: [] };
try {
  const page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace');
  const heading = main.locator('.remote-heading strong');
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), '');
  await menu('新建聊天');
  const dialog = page.getByRole('dialog', { name: '选择工作区', exact: true });
  await dialog.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
  if (rapid) {
    await menu('重命名聊天');
    const rename = page.getByRole('dialog', { name: '重命名聊天', exact: true });
    report.renameTargetTitle = await rename.getByRole('textbox', { name: '聊天名称', exact: true }).inputValue();
    report.titleWhileRenaming = await heading.innerText();
    await rename.getByRole('button', { name: '关闭窗口', exact: true }).click();
  }
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const sample = { at: new Date().toISOString(), title: await heading.innerText(),
      articles: await main.getByRole('article', { name: '模型回复' }).count(), choosing: await dialog.isVisible() };
    report.samples.push(sample);
    if (!sample.choosing && sample.articles === 0 && sample.title !== 'DSHM Remote 联调提示') { report.openedEmptyChat = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await page.screenshot({ path: `artifacts/${prefix}-android.png` });
  assert.equal(report.openedEmptyChat, true, 'Create must visibly select a new empty chat before any follow-up action');
  // 只有已确认的本次空聊天才可归档，绝不归档旧联调记录。
  await menu('归档聊天');
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  report.originalChatRestored = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
