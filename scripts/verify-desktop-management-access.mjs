import assert from 'node:assert/strict';
import { localDesktopManagement } from './local-desktop-management.mjs';

const action = process.argv[2] ?? 'status';
assert.ok(['status', 'grant', 'withdraw'].includes(action));
try {
  const api = await localDesktopManagement();
  const before = await api();
  const matches = before.devices.filter(device => device.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
  assert.equal(matches.length, 1, 'The previously authorized Android identity must be unique');
  const device = matches[0];
  assert.equal(device.name, 'DSHM Android'); assert.equal(device.status, 'active');
  if (action !== 'status') {
    await api({ action: 'management', deviceId: device.id, enabled: action === 'grant' });
    const after = (await api()).devices.find(item => item.id === device.id);
    assert.equal(after?.management, action === 'grant');
    assert.equal(after?.status, 'active');
    console.log(JSON.stringify({ action, name: device.name, management: after.management, chatAuthorizationRetained: true }));
  } else console.log(JSON.stringify({ action, name: device.name, status: device.status, management: device.management }));
} catch { console.error('Local desktop management check failed; no credentials logged.'); process.exitCode = 1; }
