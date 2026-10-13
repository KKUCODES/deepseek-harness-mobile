import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 从手机原文件树触发官方转换，读取实际 PDF 画布和正文；不注入转换/缓存观察器。 */
export async function verifyOfficialOfficePreview({ page, device, evidence, inference, mark }) {
  const seed = inference.office, report = { formats: [] };
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const tree = panel.locator('[data-files-state="tree"]');
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const save = () => writeFile(resolve(evidence, 'office-preview.json'), JSON.stringify(report, null, 2) + '\n');
  await editor.fill('OFFICIAL_OFFICE_DRAFT');
  try {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: /工作区文件/ }).click();
    await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(),
      seed.root.replaceAll('\\', '/').toLowerCase());
    for (const file of seed.files) {
      const open = async () => {
        await tree.getByRole('button', { name: file.name, exact: true }).click();
        await active.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 180000 });
        await active.locator('.textLayer').first().waitFor();
        const text = await active.locator('.textLayer').allTextContents();
        assert.ok(text.join('').trim().length > 0, 'PDF 必须显示实际正文');
        if (file.extension.endsWith('x')) assert.ok(text.join('').includes('Office preview'), text.join(''));
        return text;
      };
      const close = async () => {
        await panel.getByRole('button', { name: '面板操作', exact: true }).click();
        await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
        await active.waitFor({ state: 'detached' });
      };
      const started = Date.now();
      const text = await open();
      const original = await seed.verify(file.name);
      await writeFile(resolve(evidence, 'office-' + file.extension + '.png'), await device.screenshot());
      await close();
      const reopenedText = await open();
      assert.deepEqual(reopenedText, text);
      await close();
      report.formats.push({ ...file, original, actualCanvas: true, text, reopenedSameText: true,
        cacheReuseVerified: false, elapsedMs: Date.now() - started });
      await mark('official-office-' + file.extension + '-canvas-text-and-reopen');
      await save();
    }
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_OFFICE_DRAFT');
    await editor.fill('');
    report.draftPreserved = true;
    return report;
  } catch (error) {
    report.failure = error.message;
    report.failureText = await page.locator('body').innerText();
    await writeFile(resolve(evidence, 'office-failed.png'), await device.screenshot());
    throw error;
  } finally { await save(); }
}
