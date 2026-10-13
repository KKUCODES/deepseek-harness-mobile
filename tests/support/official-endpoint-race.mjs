import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机原表单与另一已批准协议连接竞争；外部闸门同时放行真实请求，公开配置为最终依据。 */
export async function verifyOfficialEndpointRace({ page, device, evidence, settings, fingerprint, title, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const control = settings.endpointRace, report = { cases: [], phases: [], inferenceVerified: false };
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const persist = () => writeFile(resolve(evidence, 'endpoint-race.json'), JSON.stringify(report, null, 2) + '\n');
  const verify = async phase => { const value = await control.verify(phase); report.phases.push(phase); await persist(); await mark('official-endpoint-race-' + phase); return value; };
  const pid = async () => (await device.shell('pidof ' + packageName)).toString().trim();
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title }); if (await row.count()) await row.click();
    await editor.waitFor(); await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const permissionReconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click(); await open();
  };
  let granted = false;
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    await editor.fill('OFFICIAL_ENDPOINT_RACE_DRAFT'); await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await settings.management(fingerprint, true); granted = true; await permissionReconnect();
    const targets = await verify('prepare');
    for (const target of ['chat', 'search', 'provider']) {
      await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('models'); let form = dialog;
      if (target === 'search') {
        await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑插件', exact: true }).click();
        await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '插件设置', exact: true }).click();
        form = page.getByRole('dialog', { name: '插件设置', exact: true });
        const tab = form.getByRole('tab', { name: '插件配置', exact: true }); if (await tab.count()) await tab.click();
        await form.getByRole('combobox', { name: '插件配置', exact: true }).selectOption('web-search');
      }
      if (target === 'provider') {
        const providers = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
        await providers.getByRole('button', { name: '其他模型提供方', exact: true }).click();
        const creation = providers.getByRole('region', { name: '新增模型提供方', exact: true });
        await creation.getByRole('button', { name: '新增模型提供方', exact: true }).click();
        await creation.getByRole('combobox', { name: /^提供方来源/ }).selectOption('custom');
        await creation.getByLabel('提供方标识', { exact: true }).fill(targets.route);
        await creation.getByRole('combobox', { name: /^服务协议/ }).selectOption('openai-completions');
        await creation.getByLabel('服务地址', { exact: true }).fill(targets.address);
        await creation.getByRole('textbox', { name: '模型 ID 1', exact: true }).fill('phone-model');
        await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
        await creation.getByRole('button', { name: '核对提供方', exact: true }).click();
        await creation.getByRole('group', { name: '确认新增提供方', exact: true }).getByRole('button', { name: '确认新增', exact: true }).click();
        await creation.getByRole('button', { name: '查看提供方设置', exact: true }).waitFor();
        await verify('provider:created'); await creation.getByRole('button', { name: '查看提供方设置', exact: true }).click();
        form = providers.locator('.remote-provider-form');
      }
      const endpoint = form.getByRole('region', { name: target === 'search' ? '电脑网页搜索服务地址' : '电脑模型服务地址', exact: true });
      const input = endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true });
      const phoneDestination = target === 'provider' ? targets.alternate : targets.address;
      // 自定义提供方初值就是 address；竞争双方都必须改变原值，不能把合法无变化写入当成覆盖。
      const otherDestination = target === 'provider' ? targets.httpsAddress : targets.alternate;
      await input.waitFor(); await verify(target + ':initial');
      for (const order of ['phone-first', 'other-first']) {
        const item = { target, order, phoneDestination, otherDestination }; report.cases.push(item);
        const count = (await control.writes()).length;
        await input.fill(phoneDestination); await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
        const review = endpoint.getByRole('group', { name: '确认服务地址', exact: true });
        await review.getByText(phoneDestination, { exact: true }).waitFor();
        item.prepared = await control.arm(target === 'chat' ? undefined : target === 'search' ? 'web-search-deepseek' : { provider: targets.route }, phoneDestination, otherDestination);
        await review.getByRole('button', { name: '确认更改服务地址', exact: true }).click();
        item.settled = await control.compete(phoneDestination, otherDestination, order);
        const success = item.settled.receipts.find(frame => frame.type === 'result');
        const winningWrite = item.settled.writes.find(write => write.id === success.id);
        item.winner = winningWrite.operation.change.value === phoneDestination ? 'phone' : 'other';
        await endpoint.getByText(item.winner === 'phone' ? '服务地址已保存到电脑。' : '电脑配置已变化或页面已过期，请重新读取地址。', { exact: true }).waitFor();
        if (item.winner === 'other') assert.equal(await input.count(), 0);
        assert.equal(await endpoint.getByText('地址保存结果尚未确认，请重新连接并核对，不要重复提交。', { exact: true }).count(), 0);
        item.configuration = await verify(target + ':race-' + item.winner);
        assert.equal(item.configuration.currentOrigin, new URL(winningWrite.operation.change.value).origin);
        assert.equal(success.value.origin, item.configuration.currentOrigin);
        assert.equal(item.configuration.revision, success.value.revision);
        assert.equal(item.configuration.revision, item.prepared.revision + 1);
        await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click(); await input.waitFor();
        await endpoint.getByText(item.configuration.currentOrigin, { exact: true }).waitFor();
        assert.equal((await control.writes()).length, count + 2); item.noAutomaticReplay = true;
        assert.equal(await page.getByTestId('remote-offline-status').count(), 0);
        assert.equal(await pid(), report.appPid); assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_RACE_DRAFT');
        assert.equal(await page.locator('iframe').count(), 0); item.sameAppAndChatDraft = true;
        await endpoint.scrollIntoViewIfNeeded();
        await writeFile(resolve(evidence, 'endpoint-race-' + target + '-' + order + '.png'), await device.screenshot());
        await verify(target + ':fault-reset');
        await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click(); await input.waitFor();
        item.passed = true; await persist();
      }
      if (target === 'provider') {
        const removal = form.getByRole('region', { name: '移除提供方', exact: true });
        await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
        await removal.getByRole('group', { name: '确认移除提供方', exact: true }).getByRole('button', { name: '确认移除', exact: true }).click();
        await form.waitFor({ state: 'detached' }); await verify('provider:removed');
      }
      if (target === 'search') { await form.getByRole('button', { name: '关闭窗口', exact: true }).click(); await open(); }
    }
    assert.deepEqual([...new Set(report.cases.map(item => item.winner))].sort(), ['other', 'phone']);
    await control.close(); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await settings.management(fingerprint, false); granted = false; await permissionReconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_RACE_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.completed = true; await mark('official-endpoint-race-management-revoked'); return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await control.close(); if (granted) await settings.management(fingerprint, false); await persist(); }
}
