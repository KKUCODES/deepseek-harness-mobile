import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 原生密码只打开后取消；地址只进入确认页后取消，不输入 Key、不更换提供方。 */
export async function verifyOfficialCredentialEndpoints({ page, device, evidence, settings, fingerprint, title, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const report = {}, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const key = dialog.getByRole('region', { name: '电脑 DeepSeek Key', exact: true });
  const endpoint = dialog.getByRole('region', { name: '电脑模型服务地址', exact: true });
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click(); await open();
  };
  // 仅投影服务已经返回的公开布尔值/站点元数据，不能把整个 model 或配置写入报告。
  const view = () => main.evaluate(node => {
    for (let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model, key = model?.computerKey?.view, endpoint = model?.computerEndpoint?.view;
      if (key && endpoint) return { key: { configured: key.configured, writable: key.writable },
        endpoint: { origin: endpoint.origin, protocol: endpoint.protocol, revision: endpoint.revision, overridden: endpoint.overridden } };
    }
    return null;
  });
  const xmlPath = '/data/local/tmp/dshm-official-key-cancel.xml';
  const nativeNodes = async () => {
    await device.shell(`uiautomator dump ${xmlPath}`);
    const xml = (await device.shell(`cat ${xmlPath}`)).toString();
    return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
      .filter(node => node.package === packageName);
  };
  const findNative = async predicate => {
    const deadline = Date.now() + 15000;
    do { const found = (await nativeNodes()).filter(predicate); if (found.length === 1) return found[0]; } while (Date.now() < deadline);
    throw Error('official_native_key_control_missing');
  };
  let granted = false, nativeOpen = false;
  await editor.fill('OFFICIAL_KEY_ENDPOINT_DRAFT');
  try {
    await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    await key.getByText('已配置', { exact: true }).waitFor({ timeout: 60000 });
    await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).waitFor();
    report.initial = await settings.credentials.verify('initial', await view());
    await key.getByRole('button', { name: '管理电脑 Key', exact: true }).click(); nativeOpen = true;
    await findNative(node => node.text === '电脑 DeepSeek Key');
    const password = await findNative(node => node.class === 'android.widget.EditText' && node.password === 'true');
    // Android accessibility 的空 EditText 返回 hint；只接受确切提示，不能接受任意密码文本。
    assert.equal(password.text, '输入新的电脑 DeepSeek Key');
    const cancel = await findNative(node => node.class === 'android.widget.Button' && node.text === '取消');
    const [left, top, right, bottom] = cancel.bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`); nativeOpen = false;
    await key.getByRole('button', { name: '管理电脑 Key', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('section')]
      .find(node => node.getAttribute('aria-label') === '电脑 DeepSeek Key')?.querySelector('button')?.disabled === false);
    report.nativeCancel = await settings.credentials.verify('native-cancel', await view());
    report.nativePasswordInitiallyEmpty = true; report.keyInputPerformed = false;
    assert.equal(await key.getByText('电脑 Key 操作已完成。', { exact: true }).count(), 0);
    await mark('official-key-public-status-empty-native-window-and-cancel');

    const destination = 'http://127.0.0.1:18888/v1';
    await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill(destination);
    await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
    const review = endpoint.getByRole('group', { name: '确认服务地址', exact: true });
    await review.getByText(destination, { exact: true }).waitFor();
    await review.getByText('这个地址使用 HTTP，传输未加密。', { exact: true }).waitFor();
    assert.equal(await review.getByRole('button', { name: '确认更改服务地址', exact: true }).isEnabled(), true);
    await review.scrollIntoViewIfNeeded();
    await writeFile(resolve(evidence, 'computer-endpoint-confirm-cancel.png'), await device.screenshot());
    await review.getByRole('button', { name: '取消更改地址', exact: true }).click();
    assert.equal(await review.count(), 0);
    await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).click();
    await endpoint.getByRole('button', { name: '重新读取服务地址', exact: true }).waitFor();
    await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).waitFor();
    assert.equal(await endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true }).inputValue(), '');
    report.endpointCancel = await settings.credentials.verify('endpoint-cancel', await view());
    report.destinationSubmitted = false;
    await mark('official-endpoint-review-http-warning-cancel-and-original-config');
    await settings.management(fingerprint, false); granted = false; await reconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_KEY_ENDPOINT_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-key-endpoint-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (nativeOpen) await device.shell('input keyevent KEYCODE_BACK').catch(() => {});
    if (granted) await settings.management(fingerprint, false);
    await device.shell(`rm -f ${xmlPath}`).catch(() => {});
    await writeFile(resolve(evidence, 'computer-key-endpoint.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
