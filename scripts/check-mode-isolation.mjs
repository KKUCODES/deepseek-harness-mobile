import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const first = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const pages = first.context().pages();
  const ordinary = pages.find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  const remote = pages.find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(ordinary); assert.ok(remote);
  const marker = `isolation-${crypto.randomUUID()}`;
  await ordinary.evaluate(marker => localStorage.setItem('dshm-isolation-test', marker), marker);
  const snapshot = async (page, own, foreign) => page.evaluate(async ({ own, foreign }) => {
    const bridge = window[own];
    const call = op => new Promise(resolve => {
      const id = crypto.randomUUID();
      const listener = event => { const reply = JSON.parse(event.data); if (reply.id === id) { bridge.removeEventListener('message', listener); resolve(reply); } };
      bridge.addEventListener('message', listener); bridge.postMessage(JSON.stringify({ id, op, data: {} }));
    });
    return { origin: location.origin, foreignBridgeAbsent: window[foreign] === undefined,
      databases: (await indexedDB.databases()).map(db => db.name), marker: localStorage.getItem('dshm-isolation-test'),
      credentialRead: (await call(own === 'DSHMRemote' ? 'key.read' : 'binding.info')).error,
      foreignRequest: (await call(own === 'DSHMRemote' ? 'request.open' : 'socket.connect')).error };
  }, { own, foreign });
  const remoteResult = await snapshot(remote, 'DSHMRemote', 'DSHMOrdinary');
  assert.equal(remoteResult.marker, null);
  assert.equal(remoteResult.databases.includes('dshm-ordinary-history-v1'), false);
  await remote.evaluate(() => localStorage.setItem('dshm-isolation-test', 'remote-only'));
  const ordinaryResult = await snapshot(ordinary, 'DSHMOrdinary', 'DSHMRemote');
  assert.equal(ordinaryResult.marker, marker);
  assert.equal(ordinaryResult.databases.includes('dshm-ordinary-history-v1'), true);
  for (const value of [remoteResult, ordinaryResult]) {
    assert.equal(value.foreignBridgeAbsent, true);
    assert.equal(value.credentialRead, 'unsupported_operation');
    assert.equal(value.foreignRequest, 'unsupported_operation');
  }
  await ordinary.evaluate(() => localStorage.removeItem('dshm-isolation-test'));
  await remote.evaluate(() => localStorage.removeItem('dshm-isolation-test'));
  await remote.getByTestId('remote-connect').click();
  await remote.getByTestId('remote-error').waitFor();
  assert.equal(await remote.getByTestId('remote-error').innerText(), 'http_403');
  const report = { testedAt: new Date().toISOString(), ordinary: ordinaryResult, remote: remoteResult,
    pendingDeviceDenied: true, actualRemoteRoundtrip: false };
  delete report.ordinary.marker; delete report.remote.marker;
  await writeFile('artifacts/mode-isolation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await device.close(); }
