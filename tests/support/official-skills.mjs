import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 实际手机的选择、说明预览和发送；正文必须由官方技能注入，不从测试消息提供答案。 */
export async function verifyOfficialSkills({ page, device, evidence, inference, mark }) {
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const checks = inference.skills, report = { completed: false };
  const sheet = page.getByRole('dialog', { name: '选择技能', exact: true });
  const open = async () => {
    await main.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('dialog', { name: '附件', exact: true }).getByRole('button', { name: '选择技能', exact: true }).click();
    await sheet.getByRole('button', { name: '使用技能 ' + checks.name, exact: true }).waitFor();
  };
  try {
    report.prepared = await checks.prepare();
    const initialSeq = await checks.before(), draft = '请按所选技能中的说明回答，不调用工具。';
    await editor.fill(draft); await open();
    assert.equal(await sheet.getByRole('button', { name: '使用技能 ' + checks.hidden, exact: true }).count(), 0);
    assert.equal(await sheet.getByRole('button', { name: '使用技能 ' + checks.collision, exact: true }).isDisabled(), true);
    await sheet.getByText('与电脑命令同名，暂不能从此处选择', { exact: true }).waitFor();
    await sheet.getByRole('button', { name: '使用技能 ' + checks.name, exact: true }).getByText('仅手动调用', { exact: true }).waitFor();
    const search = sheet.getByRole('searchbox', { name: '搜索技能', exact: true });
    await search.fill('dshm-unmatched-' + checks.name);
    await sheet.getByText('没有找到匹配的技能', { exact: true }).waitFor();
    await search.fill(checks.name);
    await sheet.getByRole('button', { name: '使用技能 ' + checks.name, exact: true }).waitFor();
    await writeFile(resolve(evidence, 'skill-picker.png'), await device.screenshot());
    report.catalog = { hiddenExcluded: true, commandCollisionDisabled: true, manualOnlyShown: true, liveSearch: true };
    await sheet.getByRole('button', { name: '查看技能 ' + checks.name, exact: true }).click();
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    const active = panel.locator('.remote-document-tab:not([hidden])');
    await active.waitFor();
    await active.getByText(checks.reply, { exact: false }).waitFor();
    report.source = { officialWorkspaceSourceShown: true };
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    // 文档入口会关闭技能选择；只检查真实草稿与原记录，随后重新打开选择。
    assert.equal(await editor.innerText(), draft);
    report.noInvocation = await checks.noInvocation(initialSeq);
    await mark('official-skill-catalog-search-source-and-no-implicit-invocation');
    await open();
    await sheet.getByRole('button', { name: '使用技能 ' + checks.name, exact: true }).click();
    const prompt = '/' + checks.name + ' ' + draft;
    assert.equal(await editor.innerText(), prompt);
    report.selectionDoesNotSend = await checks.noInvocation(initialSeq);
    await open(); await sheet.getByRole('button', { name: '使用技能 ' + checks.name, exact: true }).click();
    assert.equal(await editor.innerText(), prompt); report.noDuplicateToken = true;
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    const answer = main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: checks.reply });
    await answer.waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    report.execution = await checks.verify(initialSeq, prompt);
    await answer.scrollIntoViewIfNeeded();
    await writeFile(resolve(evidence, 'skill-real-reply.png'), await device.screenshot());
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await editor.innerText(), ''); report.completed = true; report.iframeAbsent = true;
    await mark('official-phone-invoked-skill-body-and-real-model-reply');
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'skills.json'), JSON.stringify(report, null, 2) + '\n'); }
  return report;
}
