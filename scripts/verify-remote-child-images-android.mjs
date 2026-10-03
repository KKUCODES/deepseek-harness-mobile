import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';
import { chooseDownload } from './android-picker-test.mjs';
import { attachmentImageFixture } from './attachment-image-fixture.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const action = process.argv[2]; assert.ok(['rejection', 'prepare', 'send'].includes(action));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), action, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const seed = JSON.parse(await readFile('artifacts/remote-child-recovery-prepare.json', 'utf8'));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  if (action === 'prepare') {
    if (await page.getByRole('button', { name: '返回父会话', exact: true }).count()) await page.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal(await heading.innerText(), seed.chat);
    const draft = await editor.inputValue();
    await editor.focus();
    report.previousModel = (await page.locator('.model').innerText()).trim();
    await page.locator('.model').click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    // 模型选择是异步操作；等待真实模态窗口关闭后再输入，不能向 inert 背景 fill。
    await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
    try {
      const prompt = '这是 DSHM 子会话图片联调。请只调用一次 subagent，run_in_background=true，label=DSHM 图片子会话。子任务提示词：不要调用工具，只回复 IMAGE_CHILD_READY，后续直接回答用户消息，不调用工具。创建后你只回复 IMAGE_PARENT_READY。不读写文件，不执行命令，不调用其他工具。';
      await editor.fill(prompt); assert.equal(await editor.inputValue(), prompt);
      await page.getByRole('button', { name: '发送消息', exact: true }).click(); report.sent = true;
      await history.getByText(prompt, { exact: true }).waitFor(); report.exactPromptObserved = true;
      await history.getByText('IMAGE_PARENT_READY', { exact: true }).waitFor({ timeout: 120000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
    } finally {
      await editor.fill(draft); await editor.focus(); await page.locator('.model').click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: report.previousModel, exact: true }).click();
      await page.getByRole('dialog', { name: '选择模型', exact: true }).waitFor({ state: 'detached' });
    }
    await menu('子会话');
    await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /DSHM 图片子会话/ }).click();
    await history.getByText('IMAGE_CHILD_READY', { exact: true }).waitFor({ timeout: 90000 });
    report.childTitle = await heading.innerText();
    await editor.focus(); report.childModel = (await page.locator('.model').innerText()).trim();
    assert.equal(report.childModel, 'DeepSeek-V41-Flash');
  } else {
    if (action === 'rejection') {
      const previous = JSON.parse(await readFile('artifacts/remote-child-recovery-navigate.json', 'utf8'));
      assert.equal(await heading.innerText(), previous.childTitle);
    } else {
      const previous = JSON.parse(await readFile('artifacts/remote-child-images-prepare.json', 'utf8'));
      assert.equal(await heading.innerText(), previous.childTitle);
    }
    const draft = await editor.inputValue();
    const filename = 'dshm-child-image.png';
    const bytes = attachmentImageFixture(1024, 1024, [2, 0, 1]);
    await writeFile(`artifacts/${filename}`, bytes); await device.push(bytes, `/sdcard/Download/${filename}`);
    report.bytes = bytes.length;
    const before = await history.getByRole('article', { name: '模型回复' }).count();
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '选择文件', exact: true }).count(), 0);
    await page.getByRole('button', { name: '从相册选择', exact: true }).click();
    await chooseDownload(device, filename);
    const pending = page.getByLabel('待发送附件', { exact: true });
    await pending.getByText(/待发送图片/).waitFor();
    const prompt = '仅看本条消息附件图片，说出顶部三个色块从左到右的颜色，不参考历史消息，不调用工具。';
    await editor.fill(prompt); await page.getByRole('button', { name: '发送消息', exact: true }).click();
    if (action === 'rejection') {
      await page.locator('.remote-error').filter({ hasText: /image|图片/i }).waitFor({ timeout: 60000 });
      report.rejection = await page.locator('.remote-error').innerText();
      assert.equal(await editor.inputValue(), prompt);
      assert.equal(await history.getByRole('article', { name: '模型回复' }).count(), before);
      assert.equal(await history.getByText('正在发送…', { exact: true }).count(), 0);
      assert.equal(await pending.locator('.remote-file').count(), 1); report.draftAndImagePreserved = true;
      await pending.getByRole('button', { name: `移除附件 ${filename}`, exact: true }).click();
    } else {
      await pending.waitFor({ state: 'detached', timeout: 90000 });
      const response = history.getByRole('article', { name: '模型回复' }).nth(before);
      await response.waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 90000 });
      report.reply = await response.innerText(); assert.match(report.reply, /蓝[\s\S]*红[\s\S]*绿/);
      await history.getByRole('button', { name: `查看附件 ${filename}`, exact: true }).last().click();
      const preview = page.getByRole('dialog', { name: '文件预览', exact: true });
      await preview.locator('img').waitFor();
      await page.waitForFunction(() => document.querySelector('.remote-file-preview img')?.naturalWidth === 1024);
      report.historicalImagePreview = true;
      await page.screenshot({ path: 'artifacts/remote-child-images-preview.png' });
      await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    }
    await editor.fill(draft);
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/remote-child-images-${action}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
