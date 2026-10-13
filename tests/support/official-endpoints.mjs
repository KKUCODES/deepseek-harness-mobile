import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 三个实际地址表单使用独立空凭据Host，电脑正常设置接口验证完整值和继承。 */
export async function verifyOfficialEndpoints({ page, device, evidence, settings, fingerprint, title, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const report = { phases: [], inferenceVerified: false }, main = page.getByTestId('remote-workspace');
  const policy = settings.endpoints.policy === true;
  const editor = main.locator('[data-composer-input]'), dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const verify = async phase => {
    const result = await settings.endpoints.verify(phase); report.phases.push(phase);
    await writeFile(resolve(evidence, 'endpoints.json'), JSON.stringify(report, null, 2) + '\n');
    await mark('official-endpoint-' + phase); return result;
  };
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title }); if (await row.count()) await row.click();
    await editor.waitFor(); await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click(); await open();
  };
  const select = () => page.getByRole('combobox', { name: '设置页面', exact: true });
  let granted = false;
  await editor.fill('OFFICIAL_ENDPOINT_WRITE_DRAFT');
  try {
    await open(); await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    const targets = await verify('prepare');
    for (const target of ['chat', 'search', 'provider']) {
      await select().selectOption('models');
      let form = dialog;
      if (target === 'search') {
        await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑插件', exact: true }).click();
        await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '插件设置', exact: true }).click();
        form = page.getByRole('dialog', { name: '插件设置', exact: true });
        const configuration = form.getByRole('tab', { name: '插件配置', exact: true });
        if (await configuration.count()) await configuration.click();
        const card = form.getByRole('combobox', { name: '插件配置', exact: true });
        await card.selectOption('web-search'); report.searchPageId = 'Remote 选项/电脑插件/插件设置/插件配置/web-search';
      }
      if (target === 'provider') {
        const providers = page.getByRole('region', { name: '其他模型提供方', exact: true });
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
      const review = endpoint.getByRole('group', { name: '确认服务地址', exact: true });
      const prepare = async destination => { await input.fill(destination); await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click(); };
      const save = async destination => {
        await prepare(destination); await review.getByText(destination, { exact: true }).waitFor();
        if (destination.startsWith('http:')) await review.getByText('这个地址使用 HTTP，传输未加密。', { exact: true }).waitFor();
        await review.getByRole('button', { name: '确认更改服务地址', exact: true }).click();
        await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).waitFor();
        assert.equal(await input.inputValue(), '');
      };
      await input.waitFor(); await verify(target + ':initial');
      for (const invalid of ['ftp://127.0.0.1/v1', 'http://account:password@127.0.0.1/v1', targets.address + '?x=1', targets.address + '#part']) {
        await prepare(invalid); await endpoint.getByText('请输入不含账号、密码、查询参数和片段的 HTTP 或 HTTPS 地址。', { exact: true }).waitFor();
        assert.equal(await review.count(), 0);
      }
      await verify(target + ':invalid');
      const destination = target === 'provider' ? targets.alternate : targets.address;
      await prepare(destination); await review.getByRole('button', { name: '取消更改地址', exact: true }).click();
      await verify(target + ':cancel'); await save(destination); await verify(target + ':saved');
      await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click();
      await input.waitFor(); await endpoint.getByRole('button', { name: '核对新地址', exact: true }).waitFor();
      await verify(target + ':reread');
      if (target === 'provider') {
        const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
        await models.getByRole('button', { name: '编辑模型清单', exact: true }).click();
        await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
        await models.getByRole('checkbox', { name: 'HTTP 新模型 · probe-discovered', exact: true }).waitFor();
        await verify('provider:discovered');
      } else { await save(targets.httpsAddress); await verify(target + ':https'); }
      await prepare(destination); await verify(target + ':external');
      await review.getByRole('button', { name: '确认更改服务地址', exact: true }).click();
      await endpoint.getByText('电脑配置已变化或页面已过期，请重新读取地址。', { exact: true }).waitFor();
      await verify(target + ':stale');
      await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click();
      await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).waitFor();
      if (target === 'provider') await verify('provider:reset-baseline');
      if (target !== 'provider' || !policy) {
        await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).click();
        await review.getByRole('button', { name: '确认更改服务地址', exact: true }).click();
      }
      if (target === 'provider') {
        if (policy) {
          await endpoint.getByText('当前没有可恢复的默认地址，请填写完整服务地址。', { exact: true }).waitFor();
          assert.equal(await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).isEnabled(), false);
          assert.equal(await review.count(), 0); await verify('provider:reset-policy');
        } else {
          await endpoint.getByText('地址保存结果尚未确认，请重新连接并核对，不要重复提交。', { exact: true }).waitFor();
          assert.equal(await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).count(), 0);
        }
        await verify('provider:reset-refused');
        await writeFile(resolve(evidence, 'endpoint-provider-reset-refused.png'), await device.screenshot());
        await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click();
        await input.waitFor(); await endpoint.getByText(new URL(targets.address).origin, { exact: true }).waitFor();
        if (policy) { await save(targets.address); await verify('provider:reset-policy-write'); }
        const removal = form.getByRole('region', { name: '移除提供方', exact: true });
        await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
        await removal.getByRole('group', { name: '确认移除提供方', exact: true }).getByRole('button', { name: '确认移除', exact: true }).click();
        await form.waitFor({ state: 'detached' }); await verify('provider:removed');
      } else {
        await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).waitFor();
        await verify(target + ':restored');
        assert.equal(await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).isEnabled(), false);
      }
      await writeFile(resolve(evidence, 'endpoint-' + target + (target === 'provider' ? '-removed.png' : '-restored.png')), await device.screenshot());
      if (target === 'search') {
        await form.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await open();
      }
    }
    if (policy) {
      await verify('catalog:created');
      const providers = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
      const selectProvider = providers.getByRole('combobox', { name: '模型提供方', exact: true });
      await selectProvider.locator('option[value="openai"]').waitFor({ state: 'attached' }); await selectProvider.selectOption('openai');
      const form = providers.locator('.remote-provider-form').filter({ has: page.getByText('openai', { exact: true }) });
      const endpoint = form.getByRole('region', { name: '电脑模型服务地址', exact: true });
      const input = endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true });
      await input.waitFor(); await endpoint.getByText('未单独配置地址，由提供方的模型目录决定。', { exact: true }).waitFor();
      assert.equal(await endpoint.getByText('当前没有可恢复的默认地址，请填写完整服务地址。', { exact: true }).count(), 0);
      const alternate = (await verify('catalog:initial')).address;
      // 地址使用先前创建的独立本机目录服务；不发模型请求。
      await input.fill(alternate);
      await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
      await endpoint.getByRole('group', { name: '确认服务地址', exact: true }).getByRole('button', { name: '确认更改服务地址', exact: true }).click();
      await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).waitFor(); await verify('catalog:saved');
      assert.equal(await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).isEnabled(), true);
      await endpoint.getByRole('button', { name: '恢复默认服务地址', exact: true }).click();
      await endpoint.getByRole('group', { name: '确认服务地址', exact: true }).getByRole('button', { name: '确认更改服务地址', exact: true }).click();
      await endpoint.getByText('服务地址已保存到电脑。', { exact: true }).waitFor();
      await endpoint.getByText('未单独配置地址，由提供方的模型目录决定。', { exact: true }).waitFor(); await verify('catalog:restored');
      await writeFile(resolve(evidence, 'endpoint-catalog-restored.png'), await device.screenshot());
      const removal = form.getByRole('region', { name: '移除提供方', exact: true });
      await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
      await removal.getByRole('group', { name: '确认移除提供方', exact: true }).getByRole('button', { name: '确认移除', exact: true }).click();
      await form.waitFor({ state: 'detached' }); await verify('catalog:removed');
      report.resetPolicyVerified = true; report.catalogDefaultRestored = true;
    }
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_WRITE_DRAFT');
    await settings.management(fingerprint, false); granted = false; await reconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_ENDPOINT_WRITE_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true; await mark('official-endpoint-management-revoked');
    return report;
  } catch (error) {
    report.failure = error.message;
    report.endpointNotices = await page.getByRole('region', { name: '电脑模型服务地址', exact: true }).allTextContents();
    await writeFile(resolve(evidence, 'endpoint-failure.png'), await device.screenshot());
    throw error;
  }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'endpoints.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
