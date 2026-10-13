import assert from 'node:assert/strict';

function nativeControls(device, packageName) {
  assert.ok(['dev.dshmobile.validation.latesttest', 'dev.dshmobile.validation.latestofficetest',
    'dev.dshmobile.validation.latestfinaltest', 'dev.dshmobile.validation.officialtest'].includes(packageName));
  const xmlPath = '/data/local/tmp/dshm-latest-probe.xml';
  async function nodes() {
    await device.shell(`uiautomator dump ${xmlPath}`);
    const xml = (await device.shell(`cat ${xmlPath}`)).toString();
    return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
      .filter(node => node.package === packageName);
  }
  async function find(predicate) {
    const deadline = Date.now() + 10000;
    do {
      const node = (await nodes()).find(predicate);
      if (node) return node;
    } while (Date.now() < deadline);
    throw Error('isolated_native_probe_control_missing');
  }
  async function tap(node) {
    assert.ok(node);
    const [left, top, right, bottom] = node.bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((left + right) / 2)} ${Math.floor((top + bottom) / 2)}`);
  }
  // Android 主题可能将按钮中的英文转为大写；匹配同一原生按钮的实际显示文本。
  const button = text => find(node => node.class === 'android.widget.Button' && node.text?.toLowerCase() === text.toLowerCase());
  return { find, tap, button, cleanup: () => device.shell(`rm -f ${xmlPath}`) };
}

/** 只操作独立测试 UID 的原生密码窗口；虚构 Key 不经过页面输入或写入证据。 */
export async function verifyNativeModelProbe(device, packageName, page, probe, verify) {
  const { find, tap, button, cleanup } = nativeControls(device, packageName);
  const open = async () => {
    await probe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await find(node => node.text === '临时 Key 获取模型');
    await find(node => node.class === 'android.widget.EditText' && node.password === 'true');
  };
  let dialogOpen = false;
  try {
    await open(); dialogOpen = true;
    await tap(await button('取消')); dialogOpen = false;
    await probe.getByRole('button', { name: '从当前地址获取模型', exact: true }).waitFor();
    await verify('native-probe-cancelled');
    await open(); dialogOpen = true;
    await tap(await button('获取模型'));
    // EditText 错误气泡受系统焦点影响；核验拒绝行为，不依赖气泡进入无障碍树。
    await find(node => node.text === '临时 Key 获取模型');
    await find(node => node.class === 'android.widget.EditText' && node.password === 'true' && node.enabled === 'true');
    await verify('native-probe-invalid');
    await tap(await find(node => node.class === 'android.widget.EditText' && node.password === 'true'));
    await device.shell('input text synthetic-latest-temporary');
    await tap(await button('获取模型'));
    await probe.getByText('没有可添加的新模型。', { exact: true }).waitFor();
    dialogOpen = false;
    assert.equal((await page.locator('body').innerText()).includes('synthetic-latest-temporary'), false);
    await verify('native-probe-executed');
  } finally {
    if (dialogOpen) await tap(await button('取消')).catch(() => {});
    await cleanup();
  }
}

/** 为本轮手机新建的测试提供方写入/移除虚构值，不操作官方或用户路由。 */
export async function verifyNativeProviderKey(device, packageName, page, key, action, route) {
  assert.equal(route, 'dshm-phone-management');
  assert.ok(['set', 'remove', 'cancel', 'invalid'].includes(action));
  const { find, tap, button, cleanup } = nativeControls(device, packageName);
  let dialogOpen = false;
  try {
    await key.getByRole('button', { name: '管理电脑 Key', exact: true }).click();
    dialogOpen = true;
    await find(node => node.text?.startsWith('电脑提供方 Key') && node.text.includes(route));
    if (action === 'cancel' || action === 'invalid') {
      await find(node => node.class === 'android.widget.EditText' && node.password === 'true');
      if (action === 'invalid') {
        await tap(await button('保存到电脑'));
        await find(node => node.text?.startsWith('电脑提供方 Key') && node.text.includes(route));
        await find(node => node.class === 'android.widget.EditText' && node.password === 'true' && node.enabled === 'true');
      }
      await tap(await button('取消'));
    } else if (action === 'set') {
      await tap(await find(node => node.class === 'android.widget.EditText' && node.password === 'true'));
      await device.shell('input text synthetic-latest-stored');
      await tap(await button('保存到电脑'));
    } else {
      await tap(await button('移除电脑 Key'));
      await tap(await button('确认移除'));
    }
    await key.getByText(action === 'set' ? '已配置' : '尚未配置', { exact: true }).waitFor();
    dialogOpen = false;
    assert.equal((await page.locator('body').innerText()).includes('synthetic-latest-stored'), false);
  } finally {
    if (dialogOpen) await tap(await button('取消')).catch(() => {});
    await cleanup();
  }
}
