import assert from 'node:assert/strict';

/** Deferred failures cross the actual registered hero wrapper, not a substitute error handler. */
export async function checkPresetLifetime(page) {
  const begin = async () => {
    await page.evaluate(async () => {
      window.fixture.clearPresetError();
      await window.fixture.select('agent-blank');
      await window.fixture.enablePresetFailureProbe();
    });
    await page.getByTestId('preset-failure-probe').waitFor({ state: 'attached' });
    await page.waitForFunction(() => window.fixture.presetPending().includes('agent-blank'));
  };
  await begin();
  await page.evaluate(() => window.fixture.rejectPresetRead());
  assert.equal(await page.evaluate(() => window.fixture.presetPageError()), 'preset-read-fixture', '当前读取错误必须保留');
  await page.evaluate(() => window.fixture.unloadPresetFailureProbe());

  await begin();
  await page.evaluate(async () => { await window.fixture.select('one'); window.fixture.presetOtherError(); await window.fixture.rejectPresetRead(); });
  assert.equal(await page.evaluate(() => window.fixture.presetPageError()), 'current-chat-fixture', '旧聊天的迟到失败不能覆盖当前错误');
  assert.deepEqual(await page.evaluate(() => window.fixture.presetPending()), []);
  await page.evaluate(() => window.fixture.unloadPresetFailureProbe());

  await begin();
  await page.evaluate(async () => { await window.fixture.unloadPresetFailureProbe(); window.fixture.presetOtherError(); await window.fixture.rejectPresetRead(); });
  assert.equal(await page.evaluate(() => window.fixture.presetPageError()), 'current-chat-fixture', '卸载后的失败不能覆盖当前错误');
  const starts = await page.evaluate(() => window.fixture.presetLoadStarts());
  await page.evaluate(() => window.fixture.invokeReleasedPresetLoad());
  assert.equal(await page.evaluate(() => window.fixture.presetLoadStarts()), starts, '卸载后的回调不能启动新读取');
  assert.deepEqual(await page.evaluate(() => window.fixture.presetPending()), []);
  await page.evaluate(async () => { window.fixture.clearPresetError(); await window.fixture.select('one'); });
  await begin();
  const generation = await page.evaluate(() => window.fixture.presetConnection().id);
  await page.evaluate(() => window.fixture.reconnectPreset());
  await page.waitForFunction(id => {
    const current = window.fixture.presetConnection();
    return current.id && current.id !== id && current.state === 'connected';
  }, generation);
  await page.evaluate(async () => { window.fixture.presetOtherError(); await window.fixture.rejectPresetRead(); });
  assert.equal(await page.evaluate(() => window.fixture.presetPageError()), 'current-chat-fixture', '旧连接失败不能覆盖重连后错误');
  await page.evaluate(async () => { await window.fixture.unloadPresetFailureProbe(); await window.fixture.finishPresetReads(); window.fixture.clearPresetError(); await window.fixture.select('one'); });
  assert.deepEqual(await page.evaluate(() => window.fixture.presetPending()), []);
  return { currentFailureVisible: true, navigationIsolated: true, unloadIsolated: true, releasedCallbackInert: true, reconnectIsolated: true, locksReleased: true };
}
