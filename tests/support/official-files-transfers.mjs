import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';
import { officialShareRecipient } from './official-share-recipient.mjs';
import { verifyOfficialDesktopFile } from './official-desktop-file.mjs';

/** 真实文件树、手机文档窗口和系统保存；不替换读取服务或系统文件选择器。 */
export async function verifyOfficialFilesAndTransfers({ page, device, evidence, inference, packageName, mark }) {
  const seed = inference.files, report = {};
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  await editor.fill('OFFICIAL_FILES_DRAFT');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const save = () => writeFile(resolve(evidence, 'files-transfers.json'), JSON.stringify(report, null, 2) + '\n');
  const tree = panel.locator('[data-files-state="tree"]');
  const openTree = async () => {
    if (!await panel.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
        .getByRole('button', { name: '插件面板', exact: true }).click();
    }
    const tab = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await tab.count()) await tab.click();
    else await panel.getByRole('button', { name: /工作区文件/ }).click();
    await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(),
      seed.root.replaceAll('\\', '/').toLowerCase());
  };
  const open = async name => {
    await openTree();
    await tree.getByRole('button', { name, exact: true }).click();
    await active.waitFor();
  };
  let ownSavedPath;
  const digest = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  try {
    await openTree();
    assert.equal(await tree.getByRole('button', { name: 'readme.txt', exact: true }).count(), 0);
    await tree.getByRole('button', { name: 'empty', exact: true }).click();
    await tree.getByText('空目录', { exact: true }).waitFor();
    await tree.getByRole('button', { name: 'nested', exact: true }).click();
    await tree.getByRole('button', { name: 'readme.txt', exact: true }).click();
    await active.locator('[data-textpreview-plain]').waitFor();
    assert.equal(await active.locator('[data-textpreview-plain]').textContent(), seed.nestedText);
    report.tree = { ownWorkspace: true, lazyExpansion: true, emptyDirectory: true, nestedFileRead: true };
    await mark('official-workspace-tree-and-nested-document'); await save();

    await open(seed.filename);
    const plain = active.locator('[data-textpreview-plain]');
    await plain.waitFor();
    assert.equal(await plain.locator('[data-textpreview-line]').count(), 5000);
    assert.equal(await plain.textContent(), seed.text.split('\n').slice(0, 5000).join('\n') + '\n');
    await panel.getByRole('button', { name: '加载更多', exact: true }).click();
    await plain.locator('[data-textpreview-line="5002"]').waitFor();
    assert.equal(await plain.textContent(), seed.text);
    report.text = { firstPageLines: 5000, fullLines: 5002, unicodeMatches: true };
    report.relayRead = await seed.verify();
    await writeFile(resolve(evidence, 'file-text.png'), await device.screenshot());
    await mark('official-text-pagination-and-independent-full-byte-read'); await save();
    if (seed.desktop) report.desktop = await verifyOfficialDesktopFile({ page, device, active: panel, seed, evidence, mark });

    const target = '/sdcard/Download/' + seed.filename;
    assert.match(target, /^\/sdcard\/Download\/dshm-official-[a-f0-9]{8}\.txt$/);
    assert.equal((await device.shell(`if [ -e '${target}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim(), 'ABSENT');
    await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor();
    assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text === seed.filename));
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    ownSavedPath = target;
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    if ((await pickerNodes(device)).some(node => node.text === '替换')) {
      await device.shell('input keyevent 4'); await device.shell('input keyevent 4');
      ownSavedPath = undefined;
      throw new Error('Refusing to overwrite an existing download');
    }
    await panel.getByText('已保存到所选位置。', { exact: true }).waitFor();
    assert.equal(await digest(target), seed.sha256);
    assert.equal(Number((await device.shell(`wc -c < '${target}'`)).toString().trim()), seed.bytes);
    report.download = { systemPicker: true, bytes: seed.bytes, sha256: seed.sha256, fullFileVerified: true };
    await mark('official-file-complete-system-download'); await save();

    if (!seed.desktop) {
    const recipient = seed.verifyShareRecipient ? await officialShareRecipient({ device, packageName, evidence }) : undefined;
    try {
      await panel.getByRole('button', { name: '分享完整文件', exact: true }).click();
      if (recipient) {
        report.share = await recipient.receive(seed);
        await panel.getByText('已打开系统分享面板。', { exact: true }).waitFor();
        assert.equal(await panel.getByText(/已发送|已分享/).count(), 0);
        report.share.noSentClaim = true;
        report.share.sourceAfterReceiving = await seed.verify();
        // 仅删除独立验收 UID 中本轮完整分享副本；真实接收者已读完，产品仍保留一小时生命周期。
        const paths = (await device.shell(`run-as ${packageName} find cache/remote-shares -type f`)).toString().trim().split(/\r?\n/).filter(Boolean);
        assert.equal(paths.length, 1);
        const path = paths[0];
        assert.match(path, /^cache\/remote-shares\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/dshm-official-[a-f0-9]{8}\.txt$/);
        assert.equal((await device.shell(`run-as ${packageName} sha256sum ${path}`)).toString().split(/\s/)[0], seed.sha256);
        await device.shell(`run-as ${packageName} rm ${path}`);
        await device.shell(`run-as ${packageName} rmdir ${path.slice(0, path.lastIndexOf('/'))}`);
        report.share.ownSnapshotRemoved = true;
        await mark('official-file-complete-share-readonly-recipient'); await save();
      } else {
        let xml = '';
        for (let attempt = 0; attempt < 8; attempt++) {
          await device.shell('uiautomator dump /data/local/tmp/dshm-official-share.xml');
          xml = (await device.shell('cat /data/local/tmp/dshm-official-share.xml')).toString();
          if (xml.includes('resource-id="android:id/chooser_header"')) break;
        }
        assert.ok(xml.includes('resource-id="android:id/chooser_header"'));
        await writeFile(resolve(evidence, 'file-share-sheet.png'), await device.screenshot());
        await device.shell('input keyevent 4');
        await panel.getByText('已打开系统分享面板。', { exact: true }).waitFor();
        report.share = { actualSystemSheet: true, noRecipientSelected: true, recipientDeliveryVerified: false };
        await mark('official-file-system-share-sheet'); await save();
      }
    } finally {
      if (recipient) { await recipient.cleanup(); report.shareReceiverRemoved = true; await save(); }
    }
    } else report.share = { notRunInThisScope: true };

    await open('readme.md');
    await active.locator('[data-document-markdown]').getByRole('heading', { name: 'DSHM 官方文件预览', exact: true }).waitFor();
    report.markdown = true;
    await open('image.svg');
    await active.locator('img').waitFor();
    assert.deepEqual(await active.locator('img').evaluate(async img => { await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight }; }), { width: 160, height: 100 });
    report.image = true;
    await open('page.html');
    const html = active.frameLocator('iframe');
    await html.getByRole('heading', { name: 'DSHM isolated HTML', exact: true }).waitFor();
    await html.getByRole('button', { name: 'COUNT_0', exact: true }).click();
    await html.getByRole('button', { name: 'COUNT_1', exact: true }).waitFor();
    assert.deepEqual(await html.locator('body').evaluate(() => ({ origin: origin,
      nativeBridge: !!window.DSHMRemote || !!window.DSHMOrdinary })), { origin: 'null', nativeBridge: false });
    report.html = { interactive: true, opaqueOrigin: true, nativeBridgeAbsent: true };
    await open('document.pdf');
    await active.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    report.pdf = { actualCanvas: true };
    await writeFile(resolve(evidence, 'file-pdf.png'), await device.screenshot());
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_FILES_DRAFT');
    await editor.fill('');
    report.draftPreserved = true;
    await mark('official-markdown-image-html-pdf-and-draft');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (ownSavedPath) {
      assert.equal(await digest(ownSavedPath), seed.sha256, 'Refusing cleanup of changed or incomplete download');
      await device.shell(`rm '${ownSavedPath}'`);
      assert.equal((await device.shell(`if [ -e '${ownSavedPath}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim(), 'ABSENT');
      report.testDownloadRemoved = true;
    }
    await save();
  }
}
