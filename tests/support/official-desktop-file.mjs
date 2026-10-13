import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyOfficialPresentedDesktop } from './official-presented-desktop.mjs';

/** 从实际文档页执行默认打开；用真实Windows窗口核对副作用，确认取消/文件变化不打开。 */
export async function verifyOfficialDesktopFile({ page, device, active, seed, evidence, mark }) {
  const report = {};
  const save = () => writeFile(resolve(evidence, 'desktop-file.json'), JSON.stringify(report, null, 2) + '\n');
  const prepare = async () => {
    await active.getByRole('button', { name: '在电脑打开', exact: true }).click();
    const group = active.getByRole('group', { name: '确认在电脑打开', exact: true });
    await group.waitFor();
    assert.match(await group.innerText(), new RegExp(seed.filename.replaceAll('.', '\\.')));
    return group;
  };
  try {
    report.before = await seed.desktop.snapshot();
    let group = await prepare();
    await writeFile(resolve(evidence, 'desktop-file-confirmation.png'), await device.screenshot());
    assert.deepEqual(await seed.desktop.snapshot(), report.before);
    await group.getByRole('button', { name: '取消', exact: true }).click();
    await group.waitFor({ state: 'detached' });
    assert.deepEqual(await seed.desktop.snapshot(), report.before);
    report.cancelledWithoutNativeOpen = true;

    group = await prepare();
    await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
    await active.getByText('已请求电脑打开文件。', { exact: true }).waitFor();
    report.defaultOpen = await seed.desktop.verify('open');
    await mark('official-workspace-file-real-default-application'); await save();

    group = await prepare();
    try {
      await seed.desktop.change(true);
      await group.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
      await active.getByText('文件已变化，请重新核对后再打开。', { exact: true }).waitFor();
      assert.deepEqual(await seed.desktop.snapshot(), report.before);
      report.changedFileRefusedBeforeNativeOpen = true;
    } finally { await seed.desktop.change(false); }

    try {
      await seed.desktop.missing(true);
      await active.getByRole('button', { name: '在电脑打开', exact: true }).click();
      await active.getByText('电脑已不再保留这条文件记录，或文件已被移动、删除。', { exact: true }).waitFor();
      assert.equal(await active.getByRole('group', { name: '确认在电脑打开', exact: true }).count(), 0);
      assert.deepEqual(await seed.desktop.snapshot(), report.before);
      report.missingFileRefusedBeforeNativeOpen = true;
    } finally { await seed.desktop.missing(false); }
    report.sourceRestored = await seed.verify();
    assert.equal(report.sourceRestored.sha256, seed.sha256);
    await mark('official-workspace-desktop-cancel-changed-missing-and-original-restored');
    if (seed.desktop.presented) report.presented = await verifyOfficialPresentedDesktop({ page, device, seed, evidence, mark });
    report.passed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { report.nativeCleanup = await seed.desktop.cleanup(); await save(); }
}
