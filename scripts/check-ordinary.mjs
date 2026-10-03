import assert from 'node:assert/strict';

/** 只创建自己的草稿与标记为合成的恢复样例，不调用模型、不配置或读取用户 Key。 */
export async function checkOrdinary(page, android) {
  const input = page.getByRole('textbox', { name: '普通聊天消息', exact: true });
  await input.waitFor();
  const initial = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  await page.getByTestId('ordinary-new').click();
  await page.waitForFunction(id => document.querySelector('select[aria-label="普通聊天历史"]').value !== id, initial);
  const id = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  const draft = '仅历史验证草稿，不发送模型 🧪';
  await input.fill(draft);
  await page.waitForFunction(async ({ id, draft }) => {
    const db = await new Promise(resolve => { const req = indexedDB.open('dshm-ordinary-history-v1'); req.onsuccess = () => resolve(req.result); });
    try { return await new Promise(resolve => { const req = db.transaction('chats').objectStore('chats').get(id); req.onsuccess = () => resolve(req.result?.draft === draft); }); }
    finally { db.close(); }
  }, { id, draft });
  await page.reload();
  await input.waitFor();
  await page.waitForFunction(expected => document.querySelector('textarea[aria-label="普通聊天消息"]').value === expected, draft);
  // 合成未终止轮次只用于验证崩溃恢复，不当作真实回复。
  await page.evaluate(async id => {
    const db = await new Promise(resolve => { const req = indexedDB.open('dshm-ordinary-history-v1'); req.onsuccess = () => resolve(req.result); });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('chats', 'readwrite'); const store = tx.objectStore('chats');
        store.get(id).onsuccess = event => {
          const chat = event.target.result;
          chat.turns.push({ requestId: 'synthetic-recovery-probe', prompt: '合成恢复样例', content: '部分合成字节', status: 'streaming' });
          store.put(chat);
        };
        tx.oncomplete = resolve; tx.onabort = reject;
      });
    } finally { db.close(); }
  }, id);
  await page.reload();
  await page.getByTestId('ordinary-messages').getByText('App 重启，未自动重发').waitFor();
  assert.match(await page.getByTestId('ordinary-messages').innerText(), /部分合成字节/);
  const bridge = android ? await page.evaluate(async () => {
    const call = (op, data = {}) => new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => reject(new Error('native_probe_timeout')), 5000);
      const listener = event => {
        const value = JSON.parse(event.data);
        if (value.id === id) { clearTimeout(timer); DSHMOrdinary.removeEventListener('message', listener); resolve(value); }
      };
      DSHMOrdinary.addEventListener('message', listener);
      DSHMOrdinary.postMessage(JSON.stringify({ id, op, data }));
    });
    const status = await call('key.status');
    const request = { requestId: crypto.randomUUID(), model: 'deepseek-flash', messages: [{ role: 'user', content: 'never sent' }] };
    const denied = await call('request.open', { ...request, url: 'https://example.com' });
    const keyRead = await call('key.read');
    const wrongModel = await call('request.open', { ...request, model: 'unknown' });
    const noKey = status.data.configured ? null : await call('request.open', request);
    const childResponse = await new Promise(resolve => {
      const child = document.createElement('iframe');
      const marker = crypto.randomUUID();
      const onMessage = event => { if (event.data === marker) finish(true); };
      const finish = value => { clearTimeout(timer); window.removeEventListener('message', onMessage); child.remove(); resolve(value); };
      const timer = setTimeout(() => finish(false), 800);
      window.addEventListener('message', onMessage);
      child.srcdoc = `<script>if(window.DSHMOrdinary){DSHMOrdinary.onmessage=()=>parent.postMessage('${marker}','*');DSHMOrdinary.postMessage(JSON.stringify({id:'child',op:'key.status'}))}<\/script>`;
      document.body.append(child);
    });
    return { configured: status.data.configured, statusFields: Object.keys(status.data), denied: denied.error,
      keyRead: keyRead.error, wrongModel: wrongModel.error, noKey: noKey?.error, childResponse };
  }) : { available: await page.evaluate(() => !!window.DSHMOrdinary) };
  if (android) {
    assert.deepEqual(bridge.statusFields, ['configured']);
    assert.equal(bridge.denied, 'invalid_request');
    assert.equal(bridge.keyRead, 'unsupported_operation');
    assert.equal(bridge.wrongModel, 'unsupported_model');
    if (!bridge.configured) assert.equal(bridge.noKey, 'key_missing');
    assert.equal(bridge.childResponse, false);
  } else assert.equal(bridge.available, false);
  await page.getByRole('button', { name: '删除当前聊天', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.waitForFunction(id => ![...document.querySelector('select[aria-label="普通聊天历史"]').options].some(option => option.value === id), id);
  return { draftReload: true, unfinishedRecovery: true, delete: true, bridge, realApiTested: false };
}
