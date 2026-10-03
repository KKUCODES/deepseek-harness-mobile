import assert from 'node:assert/strict';

async function nodes(device) {
  await device.shell('uiautomator dump /data/local/tmp/dshm-key-language.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-key-language.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
}
async function cancel(device) {
  const button = (await nodes(device)).find(node => node['resource-id'] === 'android:id/button2' && /^(Cancel|CANCEL|取消)$/.test(node.text));
  assert.ok(button, 'Expected native Key cancel button');
  const [x1, y1, x2, y2] = button.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
}

/** Real authorized entry; never enters, reads, saves or removes a credential. */
export async function verifyNativeKeyLanguage(remote, device, changeLanguage, report) {
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  await remote.getByRole('button', { name: 'Remote options', exact: true }).click();
  await remote.getByRole('button', { name: 'Computer settings', exact: true }).click();
  let panel = remote.getByRole('dialog', { name: 'Computer settings', exact: true });
  const key = panel.getByRole('region', { name: 'Computer DeepSeek Key', exact: true });
  const manage = key.getByRole('button', { name: 'Manage computer Key', exact: true });
  await manage.waitFor();
  assert.equal(await manage.isEnabled(), true, 'Existing temporary management permission required');
  const configured = await key.getByText('Configured', { exact: true }).count();
  assert.equal(configured, 1);
  const timeout = panel.locator('#computer-streamIdleTimeoutMs');
  await timeout.waitFor();
  const original = await timeout.inputValue();
  const draft = String(Number(original || '60000') + 1);
  await timeout.fill(draft);
  await manage.click();
  try {
    for (const language of ['en', 'zh', 'en']) {
      if (language !== 'en' || report.length) await changeLanguage(language);
      const tree = await nodes(device);
      const expectedTitle = language === 'en' ? 'Computer DeepSeek Key' : '电脑 DeepSeek Key';
      assert.ok(tree.some(node => node.text === expectedTitle));
      const editor = tree.filter(node => node.class === 'android.widget.EditText');
      assert.equal(editor.length, 1); assert.equal(editor[0].password, 'true');
      assert.ok(tree.some(node => node.text.includes(language === 'en' ? 'Key transmission is not encrypted.' : 'Key 传输未加密。')));
      const buttons = tree.filter(node => node.class === 'android.widget.Button');
      assert.equal(buttons.length, 3);
      report.push({ language, title: expectedTitle, passwordField: true, buttons: buttons.map(node => node.text), note: 'No input, save, removal or secret read' });
    }
  } finally { await cancel(device); }
  panel = remote.getByRole('dialog', { name: 'Computer settings', exact: true });
  await panel.getByRole('region', { name: 'Computer DeepSeek Key', exact: true }).getByRole('button', { name: 'Manage computer Key', exact: true }).waitFor();
  assert.equal(await panel.locator('#computer-streamIdleTimeoutMs').inputValue(), draft);
  assert.equal(await panel.getByRole('region', { name: 'Computer DeepSeek Key', exact: true }).getByText('Configured', { exact: true }).count(), configured);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await remote.getByRole('button', { name: 'Remote options', exact: true }).click();
  await remote.getByRole('button', { name: 'Computer settings', exact: true }).click();
  panel = remote.getByRole('dialog', { name: 'Computer settings', exact: true });
  await panel.locator('#computer-streamIdleTimeoutMs').waitFor();
  assert.equal(await panel.locator('#computer-streamIdleTimeoutMs').inputValue(), original);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  report.push('Native window cancelled; original Key status unchanged; settings draft survived language changes and was discarded on close without writing');
}
