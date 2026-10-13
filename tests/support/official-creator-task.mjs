import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真实模型只读发现Host工具，手机显示原工具结果；不请求旧动态运行器。 */
export async function verifyOfficialCreatorTask({ page, device, evidence, inference, mark }) {
  const main = page.getByTestId('remote-workspace'), creator = inference.creatorTask;
  const report = { prepared: await creator.verify('prepare') };
  const prompt = `这是 DSHM 创造模式真实验收。只执行本条消息：先调用 cordis_inspect_list，然后依据返回的 Host Tool provider 及其 listTools 方法调用 cordis_inspect_query，读取当前 Agent 工具目录。只查 Host，不查 Client，不调用其他工具，不写文件，不运行命令，不修改插件或配置。完成只回复 ${creator.marker}。`;
  try {
    await main.getByRole('button', { name: /^Agent 模式，当前 创造模式$/ }).waitFor();
    await main.locator('[data-composer-input]').fill(prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: creator.marker }).waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
    report.official = await creator.verify('inspect', report.prepared.initialSeq);
    // 官方已完成轮次默认折叠；先从用户入口展开，再核对内部工具结果。
    const turn = main.locator('[data-turn-process]').last();
    await turn.waitFor();
    if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
    for (const callId of report.official.callIds) await main.locator(`[data-chat-call-id="${callId}"]`).waitFor();
    await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
    const details = page.getByRole('dialog', { name: '工具详情', exact: true });
    await details.waitFor();
    const text = await details.innerText();
    assert.ok(text.includes('cordis_inspect_query')); assert.ok(text.includes('write'));
    await writeFile(resolve(evidence, 'creator-host-tools.png'), await device.screenshot());
    await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
    report.actualToolDetailsShown = true;
    assert.equal(await page.locator('iframe').count(), 0); report.noEmbeddedDesktop = true;
    await mark('official-creator-real-host-inspection-results-on-phone');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'creator-task.json'), JSON.stringify(report, null, 2) + '\n'); }
}
