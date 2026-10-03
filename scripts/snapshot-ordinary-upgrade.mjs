import { _android } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// 只记录旧库行的摘要，不输出聊天内容或读取凭据。
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device, 'Device unavailable');
try {
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const rows = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('dshm-ordinary-history-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise((resolve, reject) => { const request = db.transaction('chats').objectStore('chats').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
  const hashes = rows.map(row => ({ id: row.id, sha256: createHash('sha256').update(JSON.stringify(row)).digest('hex') }));
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/ordinary-upgrade-before.json', JSON.stringify({ at: new Date().toISOString(), serial, hashes }, null, 2));
  console.log(JSON.stringify({ preservedBaselineChats: hashes.length, source: page.url() }));
} finally { await device.close(); }
