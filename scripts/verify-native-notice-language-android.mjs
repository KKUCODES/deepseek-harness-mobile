import assert from 'node:assert/strict';

const pkg = 'dev.dshmobile.validation';
async function nativeNodes(device) {
  await device.shell('uiautomator dump /data/local/tmp/dshm-notice-language.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-notice-language.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === pkg);
}
async function closeSettings(device, nodes) {
  const button = nodes.find(node => node['resource-id'] === 'android:id/button1');
  assert.ok(button);
  const [x1, y1, x2, y2] = button.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
}
async function notificationKeys(device) {
  return (await device.shell('cmd notification list')).toString().split('\n').map(line => line.trim()).filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
}
async function notification(device, key) {
  // Android通知tag包含原事件的JSON元组；保持整个key为一个shell参数。
  assert.match(key, /^[\w.|:@\[\]",-]+$/);
  return (await device.shell(`cmd notification get '${key}'`)).toString();
}

/** Uses the installed app and dedicated live chat; never changes notification switches or permissions. */
export async function verifyNativeNoticeLanguage(remote, device, { ordinary, change, openRemote }, report) {
  const en = ['Approval needed', 'Answer needed', 'Task completed', 'Task failed or blocked'];
  const zh = ['需要批准', '需要回答', '任务完成', '执行失败或受阻'];
  let checked;
  let nodes;
  await remote.getByRole('button', { name: 'Remote options', exact: true }).click();
  await remote.getByRole('button', { name: 'Remote notifications', exact: true }).click();
  try { for (const language of ['en', 'zh', 'en']) {
    if (language !== 'en' || checked) {
      const phone = await ordinary(); await change(phone, language); await openRemote(phone);
    }
    nodes = await nativeNodes(device);
      assert.ok(nodes.some(node => node.text === (language === 'en' ? 'Remote alerts · Connected' : 'Remote 提醒 · 已连接')));
      const rows = nodes.filter(node => node.checkable === 'true');
      assert.deepEqual(rows.map(node => node.text), language === 'en' ? en : zh);
      if (checked) assert.deepEqual(rows.map(node => node.checked), checked);
      else checked = rows.map(node => node.checked);
      await device.screenshot({ path: `artifacts/notice-language-settings-${language}.png` });
  } } finally {
    await closeSettings(device, await nativeNodes(device));
    await remote.getByRole('dialog').getByRole('button', { name: /^(Close|关闭窗口)$/ }).click();
  }
  report.push({ check: 'Same open native notification window follows phone language without reopening; all four category choices unchanged', checked });
  assert.equal(checked[2], 'true', 'Completion alerts must already be enabled; test does not enable them');
  const before = await notificationKeys(device);
  const marker = `DSHM_NATIVE_NOTICE_LANGUAGE_${Date.now()}`;
  await remote.getByRole('textbox', { name: 'Message', exact: true }).fill(`这是 DSHM 通知语言验收。不要调用工具、不要操作文件。请直接写 20 行简短的中文测试句子，最后一行单独回复 ${marker}。`);
  await remote.getByRole('button', { name: 'Send message', exact: true }).click();
  await device.shell('input keyevent KEYCODE_HOME');
  let key;
  const deadline = Date.now() + 60000;
  while (!key && Date.now() < deadline) {
    key = (await notificationKeys(device)).find(value => !before.includes(value));
    if (!key) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(key, 'Expected real background completion notification');
  const english = await notification(device, key);
  assert.match(english, /Computer task completed/);
  await device.shell('cmd statusbar expand-notifications');
  await nativeNodes(device);
  await device.screenshot({ path: 'artifacts/notice-language-system-en.png' });
  await device.shell('cmd statusbar collapse');
  const phone = await ordinary(); await change(phone, 'zh');
  let chinese = '';
  const updatedDeadline = Date.now() + 10000;
  while (!chinese.includes('电脑任务已完成') && Date.now() < updatedDeadline) {
    chinese = await notification(device, key);
    if (!chinese.includes('电脑任务已完成')) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.match(chinese, /电脑任务已完成/);
  assert.deepEqual(await notificationKeys(device), [...before, key]);
  // recoverBuilder重建Java包装对象；系统PendingIntentRecord才是点击目标身份。
  const pending = text => text.match(/contentIntent=PendingIntent\{[^:]+: (PendingIntentRecord\{.+)/)?.[1];
  assert.ok(pending(english), 'Original notification must contain a click target');
  assert.equal(pending(chinese), pending(english));
  await device.shell('cmd statusbar expand-notifications');
  await nativeNodes(device);
  await device.screenshot({ path: 'artifacts/notice-language-system-zh.png' });
  await device.shell('cmd statusbar collapse');
  report.push({ check: 'Real completion notification translated in place with identical notification key and click PendingIntent', marker });
  await phone.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await phone.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
  nodes = await nativeNodes(device);
  try {
    assert.ok(nodes.some(node => node.text === 'Remote 提醒 · 已连接'));
    assert.deepEqual(nodes.filter(node => node.checkable === 'true').map(node => node.checked), checked);
    await device.screenshot({ path: 'artifacts/notice-language-ordinary-settings-zh.png' });
  } finally { await closeSettings(device, nodes); }
  await phone.getByRole('button', { name: /^外观与语言/ }).click();
  report.push('Ordinary chat native notification settings use the same language and original category choices');
  await openRemote(phone);
  await remote.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker }).waitFor({ timeout: 60000 });
  assert.deepEqual(await notificationKeys(device), before);
  await change(await ordinary(), 'en'); await openRemote(phone);
  assert.deepEqual(await notificationKeys(device), before);
  report.push('Entering the original chat clears the notice; changing language again does not replay it');
}
