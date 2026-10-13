import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const previewPanel = page => page.getByRole('region', { name: '插件面板', exact: true });
const activeDocument = panel => panel.locator('.remote-document-tab:not([hidden])');

/** 从真实待审批工具进入计划差异，核对当前原件仍未写入，再回到同一审批。 */
export async function verifyOfficialPlannedDiff({ page, device, evidence, seed, details }) {
  await details.getByRole('button', { name: '查看本次修改', exact: true }).click();
  await details.waitFor({ state: 'hidden' });
  const panel = previewPanel(page), active = activeDocument(panel);
  await panel.waitFor();
  const changes = active.locator('[data-dshm-document-view="changes"]');
  await changes.waitFor();
  const text = await changes.innerText();
  // 官方write的计划预览仅从content生成（oldText:null）；旧内容由当前原件独立核对。
  assert.ok(text.includes(seed.after));
  await active.getByRole('button', { name: '计划修改', exact: true }).waitFor();
  await writeFile(resolve(evidence, `review-${seed.outcome}-planned.png`), await device.screenshot());
  await active.getByRole('button', { name: '最新完整文件', exact: true }).click();
  const original = active.locator('[data-textpreview-plain]');
  await original.waitFor();
  assert.equal((await original.innerText()).trim(), seed.before);
  await active.getByRole('button', { name: '计划修改', exact: true }).click();
  assert.equal(await changes.innerText(), text);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await page.locator('[data-approval-key]').count(), 1);
  return { passed: true, actualSidebarTab: true, originalBeforeApprovalVerified: true,
    plannedDiffPreserved: true, officialWritePlannedContentOnly: true, samePendingApproval: true };
}

/** 完成卡片进入原 ReviewTab；手机渲染与官方真实快照和电脑文件相互核对。 */
export async function verifyOfficialTurnReview({ page, device, evidence, seed, record }) {
  const main = page.getByTestId('remote-workspace'), panel = previewPanel(page), active = activeDocument(panel);
  const draft = 'DSHM_REVIEW_DRAFT_' + seed.after;
  await main.locator('[data-composer-input]').fill(draft);
  const card = main.locator('[data-changed-files]').filter({ hasText: seed.fileName });
  await card.waitFor();
  assert.equal(await card.count(), 1);
  await card.getByRole('button').first().click();
  await panel.waitFor();
  const review = active.locator('[data-changes-review][data-review-state="ready"]');
  await review.waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), record.path);
  const diff = review.locator('[data-review-view]');
  await diff.waitFor();
  const text = await diff.innerText();
  assert.ok(text.includes(seed.before));
  assert.ok(text.includes(seed.after));
  // 官方alpha.2新标签默认双栏；先切到单栏，再核对切回双栏。
  await review.locator('[data-review-view="split"]').waitFor();
  await review.locator('[data-review-tool="split"]').click();
  await review.locator('[data-review-view="unified"]').waitFor();
  await review.locator('[data-review-tool="split"]').click();
  await review.locator('[data-review-view="split"]').waitFor();
  await review.locator('[data-review-tool="wrap"]').click();
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  await writeFile(resolve(evidence, 'review-turn-split.png'), await device.screenshot());
  await review.locator('[data-review-tool="open-file"]').click();
  const current = active.locator('[data-textpreview-plain]');
  await current.waitFor();
  assert.equal((await current.innerText()).trim(), seed.after);
  await writeFile(resolve(evidence, 'review-current-file.png'), await device.screenshot());
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await main.locator('[data-composer-input]').innerText(), draft);
  await card.getByRole('button').first().click();
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), record.path);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await main.locator('[data-composer-input]').innerText(), draft);
  await main.locator('[data-composer-input]').fill('');
  return { passed: true, actualCompletedCard: true, actualSidebarTab: true, officialRecord: record,
    fullDiffVerified: true, splitAndWrapVerified: true, selectionRetainedOnReopen: true,
    currentOriginalFileVerified: true, draftPreserved: true };
}
