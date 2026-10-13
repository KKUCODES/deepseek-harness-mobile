import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机实际确认写入，外部真实连接断开；公开电脑设置及完整历史作最终依据。 */
export async function verifyOfficialEndpointInterruption({ page, device, evidence, settings, fingerprint, title, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const transport = settings.endpointInterruption, report = { cases: [], phases: [], inferenceVerified: false };
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const persist = () => writeFile(resolve(evidence, 'endpoint-interruption.json'), JSON.stringify(report, null, 2) + '\n');
  const verify = async phase => { const value = await transport.verify(phase); report.phases.push(phase); await persist(); await mark('official-endpoint-interruption-' + phase); return value; };
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
    await editor.fill('OFFICIAL_ENDPOINT_INTERRUPTION_DRAFT');
    await open(); await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await settings.management(fingerprint, true); granted = true; await permissionReconnect();
    const targets = await verify('prepare');
    const select = () => dialog.getByRole('combobox', { name: '设置页面', exact: true });
    for (const target of ['chat', 'search', 'provider']) {
      await select().selectOption('models'); let form = dialog;
      if (target === 'search') {
        await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑插件', exact: true }).click();
        await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '插件设置', exact: true }).click();
        form = page.getByRole('dialog', { name: '插件设置', exact: true });
        const configuration = form.getByRole('tab', { name: '插件配置', exact: true }); if (await configuration.count()) await configuration.click();
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
      const reread = async () => {
        if (target === 'search') {
          const configuration = form.getByRole('tab', { name: '插件配置', exact: true }); if (await configuration.count()) await configuration.click();
          await form.getByRole('combobox', { name: '插件配置', exact: true }).selectOption('web-search');
        }
        if (target === 'provider') {
          const selectProvider = dialog.getByRole('combobox', { name: '模型提供方', exact: true });
          await selectProvider.locator('option[value="' + targets.route + '"]').waitFor({ state: 'attached' });
          await selectProvider.selectOption(targets.route);
        }
        await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click(); await input.waitFor();
      };
      const destination = target === 'provider' ? targets.alternate : targets.address;
      await input.waitFor(); await verify(target + ':initial');
      for (const mode of ['before-forward', 'after-receipt']) {
        const item = { target, mode, destination }; report.cases.push(item);
        const count = (await transport.writes()).length;
        await input.fill(destination); await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
        const review = endpoint.getByRole('group', { name: '确认服务地址', exact: true });
        await review.getByText(destination, { exact: true }).waitFor();
        await transport.arm({ target: target === 'chat' ? undefined : target === 'search' ? 'web-search-deepseek' : { provider: targets.route }, destination, mode });
        await review.getByRole('button', { name: '确认更改服务地址', exact: true }).click();
        item.cut = await transport.cut(); await persist();
        assert.equal(item.cut.socketClosed, true); assert.equal(item.cut.forwarded, mode === 'after-receipt');
        if (mode === 'before-forward') assert.equal(item.cut.receipt, undefined);
        else { assert.equal(item.cut.receipt.type, 'result'); assert.equal(item.cut.receipt.value.origin, new URL(destination).origin); }
        await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
        const unknownNotice = target === 'provider' ? dialog.getByRole('region', { name: '未确认的提供方地址', exact: true }) : target === 'search' ? form : endpoint;
        await unknownNotice.getByText('地址保存结果尚未确认，请重新连接并核对，不要重复提交。', { exact: true }).waitFor();
        assert.equal(await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).count(), 0);
        if (target === 'search') assert.equal(await form.locator('input,select').count(), 0);
        else if (target === 'provider') assert.equal(await form.count(), 0);
        else assert.equal(await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).isEnabled(), false);
        assert.equal(await pid(), report.appPid); item.unknownResultShown = true;
        item.offline = await verify(target + (mode === 'after-receipt' ? ':cut-after' : ':cut-before'));
        assert.equal((await transport.writes()).length, count + 1);
        await writeFile(resolve(evidence, 'endpoint-' + target + '-' + mode + '-offline.png'), await device.screenshot());
        await transport.resume(); await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
        await reread();
        if (item.offline.currentOrigin) await endpoint.getByText(item.offline.currentOrigin, { exact: true }).waitFor();
        item.reconnected = await verify(target + ':reread');
        assert.equal((await transport.writes()).length, count + 1); item.noAutomaticReplay = true;
        assert.equal(await pid(), report.appPid); assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_INTERRUPTION_DRAFT');
        assert.equal(await page.locator('iframe').count(), 0); item.sameAppAndChatDraft = true;
        await writeFile(resolve(evidence, 'endpoint-' + target + '-' + mode + '-reconnected.png'), await device.screenshot());
        await verify(target + ':fault-reset'); await reread(); item.passed = true; await persist();
      }
      if (target === 'provider') {
        const removal = form.getByRole('region', { name: '移除提供方', exact: true });
        await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
        await removal.getByRole('group', { name: '确认移除提供方', exact: true }).getByRole('button', { name: '确认移除', exact: true }).click();
        await form.waitFor({ state: 'detached' }); await verify('provider:removed');
      }
      if (target === 'search') { await form.getByRole('button', { name: '关闭窗口', exact: true }).click(); await open(); }
    }
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await settings.management(fingerprint, false); granted = false; await permissionReconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_INTERRUPTION_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.completed = true; await mark('official-endpoint-interruption-management-revoked'); return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { if (granted) await settings.management(fingerprint, false); await persist(); }
}
