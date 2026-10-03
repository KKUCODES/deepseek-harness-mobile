import { _android } from 'playwright';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const before = JSON.parse(await readFile('artifacts/ordinary-upgrade-before.json', 'utf8'));
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByTestId('ordinary-product').waitFor();
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '配置 DeepSeek Key', exact: true }).count(), 0);
  const rows = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    try { return await new Promise((resolve, reject) => { const r = db.transaction('chats').objectStore('chats').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject; }); } finally { db.close(); }
  });
  for (const prior of before.hashes) assert.equal(createHash('sha256').update(JSON.stringify(rows.find(row => row.id === prior.id))).digest('hex'), prior.sha256);
  const result = { at: new Date().toISOString(), passed: true, sameOrigin: new URL(page.url()).origin, preservedChats: before.hashes.length, keyStillConfigured: true, note: 'Upgrade between this iteration builds, not the disconnected old MuMu instance' };
  await writeFile('artifacts/ordinary-upgrade-after.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await device.close(); }
