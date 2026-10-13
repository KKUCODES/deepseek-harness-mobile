import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真实模型调用官方present，手机从原交付卡片操作；不生成或注入会话事件。 */
export async function verifyOfficialPresentedDesktop({ page, device, seed, evidence, mark }) {
  const report = {}, panel = page.getByRole('region', { name: '插件面板', exact: true });
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  const draft = await editor.innerText(), marker = 'DSHM_NATIVE_PRESENT_' + seed.filename.slice(14, 22);
  const path = seed.root.replaceAll('\\', '/') + '/' + seed.filename;
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  try {
    await editor.fill(`这是DSHM交付文件与电脑定位的专用验收。仅调用一次present工具，files数组仅包含已存在文件 ${path}，description为DSHM原生文件验收。不要修改文件、运行命令或调用其他工具。随后只回复 ${marker}。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker }).waitFor({ timeout: 180000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 180000 });
    report.officialEvent = await seed.desktop.verifyPresented(marker);
    // 只读当前投影和公开组件状态，区分记录遗漏、插槽未注册和卡片渲染失败。
    report.rendering = await page.getByTestId('remote-workspace').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model;
        if (!model?.client) continue;
        const state = model.getSnapshot();
        return {
          deliverablesInstalled: model.deliverablesPreview === true,
          documentPreviewsInstalled: !!model.documentPreviews,
          reviewInstalled: model.reviewPreview === true,
          nodes: state.conversation.order.map(key => {
            const node = state.conversation.nodes.get(key), turn = node.location?.turn;
            return { kind: node.kind, seq: node.anchorSeq, turn: turn?.turn, status: turn?.status,
              presented: turn?.data?.get('deliverables')?.presented?.map(file => ({ seq: file.seq, index: file.index })),
              closingSeq: node.data?.closing?.finalNode.seq };
          }),
          tailElements: element.querySelectorAll('[data-turn-tail]').length,
          deliverablesElements: element.querySelectorAll('[data-remote-deliverables]').length,
        };
      }
      return null;
    });
    assert.equal(report.rendering?.deliverablesInstalled, true);
    assert.equal(report.rendering?.documentPreviewsInstalled, true);
    const card = page.locator('[data-presented-file]').filter({ hasText: seed.filename });
    await card.waitFor();
    assert.equal(await card.count(), 1);
    await card.getByRole('button', { name: /^在侧边栏预览 / }).click();
    // 卡片的正式入口是侧栏文件标签；沿真实入口验收，不要求旧的弹窗布局。
    const preview = panel;
    await preview.waitFor();
    await preview.locator('nav').getByRole('button', { name: seed.filename, exact: true })
      .and(preview.locator('button[aria-pressed="true"]')).waitFor();
    report.preview = { actualSidebarTab: true, uniqueCard: true };
    const prepare = async action => {
      await preview.getByRole('button', { name: action === 'open' ? '在电脑打开' : '在电脑文件夹中显示', exact: true }).click();
      const group = preview.getByRole('group', { name: action === 'open' ? '确认在电脑打开' : '确认在电脑文件夹中显示', exact: true });
      await group.waitFor(); assert.match(await group.innerText(), new RegExp(seed.filename.replaceAll('.', '\\.')));
      return group;
    };
    for (const action of ['open', 'reveal']) {
      const before = await seed.desktop.snapshot();
      let group = await prepare(action);
      assert.deepEqual(await seed.desktop.snapshot(), before);
      await group.getByRole('button', { name: '取消', exact: true }).click();
      await group.waitFor({ state: 'detached' });
      assert.deepEqual(await seed.desktop.snapshot(), before);
      group = await prepare(action);
      await writeFile(resolve(evidence, 'presented-desktop-' + action + '.png'), await device.screenshot());
      await group.getByRole('button', { name: action === 'open' ? '确认在电脑打开' : '确认在电脑文件夹中显示', exact: true }).click();
      await preview.getByText(action === 'open' ? '已请求电脑打开文件。' : '已请求电脑在文件夹中显示。', { exact: true }).waitFor();
      report[action] = { ...await seed.desktop.verify(action), cancelWithoutSideEffect: true };
      await mark('official-presented-file-real-native-' + action);
    }
    await preview.getByRole('button', { name: '返回聊天', exact: true }).click();
    await editor.fill(draft);
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '插件面板', exact: true }).click();
    // 文件树原标签先于present的绝对路径标签；返回文件树标签供后续格式验收使用。
    await panel.locator('nav').getByRole('button', { name: seed.filename, exact: true }).first().click();
    report.sourceUnchanged = await seed.verify();
    report.passed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    report.nativeCleanup = await seed.desktop.cleanup();
    await writeFile(resolve(evidence, 'presented-desktop.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
