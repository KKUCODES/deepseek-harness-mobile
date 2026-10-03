import assert from 'node:assert/strict';

/** 只用于独立验收包。暂缓真实输出响应，再经电脑公开设备页撤销该身份。 */
export async function verifySidebarOutputRevocation({ page, output, artifact }) {
  const control = async path => {
    const response = await fetch(`http://127.0.0.1:18794/${path}`, {
      method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000),
    });
    assert.ok(response.ok); return response.json();
  };
  const before = await control('stats');
  assert.ok(before.devices > 0 && before.devices <= 2, '仅独立测试App的会话/提醒连接经过代理');
  assert.equal(before.heldBytes, 0);
  await control('pause');
  await output.getByRole('button', { name: '错误输出', exact: true }).click();
  const deadline = Date.now() + 10000;
  let held;
  do {
    held = await control('stats');
    if (held.heldOutputResults > 0) break;
    assert.ok(Date.now() < deadline, '未观察到真实独立输出响应');
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (true);
  await output.getByRole('status').filter({ hasText: '正在读取' }).waitFor();
  assert.equal(await output.locator('pre').count(), 0);
  await page.screenshot({ path: `artifacts/${artifact}-held-android.png` });
  console.log('SIDEBAR_OUTPUT_HELD_REVOKE_ISOLATED_DEVICE');
  await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor({ timeout: 60000 });
  assert.equal(await page.getByTestId('remote-workspace').count(), 0);
  assert.equal(await output.count(), 0);
  const revoked = await control('stats');
  assert.equal(revoked.heldBytes, 0); assert.ok(revoked.droppedBytes >= held.heldBytes);
  await control('resume');
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
  assert.equal(await page.getByTestId('remote-workspace').count(), 0);
  assert.equal(await page.getByText(/DSHM_SIDEBAR_ERR_\d+/).count(), 0);
  await page.screenshot({ path: `artifacts/${artifact}-denied-android.png` });
  return { heldOutputResults: held.heldOutputResults, heldBytes: held.heldBytes,
    droppedBytes: revoked.droppedBytes, workspaceRemoved: true, reconnectRejected: true };
}
