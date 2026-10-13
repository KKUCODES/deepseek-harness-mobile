import test from 'node:test';
import assert from 'node:assert/strict';
import { RemotePresetDirectory } from '../../src/remote-preset-directory.mjs';

// 内存夹具只验手机寿命与权限边界；真实 profile/鉴权另由 Host→网关→页面专项覆盖。
function fixture() {
  let changed, finish, calls = [], cancelled = 0;
  const model = { lifetime: new AbortController(), transport: { capabilities: { presetProfileDirectory: true, management: true } },
    connection: { state: { getSnapshot: () => 'connected' }, generation: { getSnapshot: () => ({ id: 1 }), subscribe(fn) { changed = fn; return () => {}; } } },
    client: { request(value) { calls.push(value); return { promise: new Promise(resolve => { finish = resolve; }), cancel() { cancelled++; } }; } } };
  return { model, calls, directory: new RemotePresetDirectory(model), finish: value => finish(value), changed: () => changed(), cancelled: () => cancelled };
}
const response = { ok: true, value: { opened: false, path: 'C:\\isolated', documentPath: 'C:\\isolated\\cordis.patch.yml' } };

test('没有管理授权或未协商新版能力时不读取，读取只提交固定预设 ID', async () => {
  const f = fixture();
  try {
    f.model.transport.capabilities.management = false; await f.directory.read('standard');
    f.model.transport.capabilities.management = true; f.model.transport.capabilities.presetProfileDirectory = false; await f.directory.read('standard');
    assert.equal(f.calls.length, 0);
    f.model.transport.capabilities.presetProfileDirectory = true;
    for (const value of ['../file', undefined, null, { id: 'standard' }]) await f.directory.read(value);
    assert.equal(f.calls.length, 0);
    const work = f.directory.read('standard');
    assert.deepEqual(f.calls, [{ method: 'remote.rpc', endpoint: 'settings/openAgentPresetDirectory', payload: { args: { agentPreset: 'standard' } } }]);
    f.finish(response); await work;
    assert.deepEqual(f.directory.getSnapshot(), { busy: false, value: response.value, error: null });
  } finally { f.directory.dispose(); }
});

test('关闭、重新选择、换连接和销毁后，迟到的路径或失败不会重新显示', async () => {
  for (const action of ['clear', 'generation', 'dispose']) {
    for (const result of [response, { ok: false }]) {
      const f = fixture();
      try {
        const work = f.directory.read('standard');
        if (action === 'clear') f.directory.clear();
        if (action === 'generation') f.changed();
        if (action === 'dispose') f.directory.dispose();
        f.finish(result); await work;
        assert.equal(f.cancelled(), 1);
        assert.deepEqual(f.directory.getSnapshot(), { busy: false, value: null, error: null });
      } finally { f.directory.dispose(); }
    }
  }
});

test('原接口失败可再次主动读取，不接受会启动文件管理器的结果', async () => {
  const f = fixture();
  try {
    const failed = f.directory.read('standard'); f.finish({ ok: false }); await failed;
    assert.equal(f.directory.getSnapshot().busy, false);
    assert.ok(f.directory.getSnapshot().error);
    const opened = f.directory.read('standard'); f.finish({ ...response, value: { ...response.value, opened: true } }); await opened;
    assert.equal(f.directory.getSnapshot().value, null);
    const retried = f.directory.read('standard'); f.finish(response); await retried;
    assert.deepEqual(f.directory.getSnapshot().value, response.value);
  } finally { f.directory.dispose(); }
});
