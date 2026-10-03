/** 仅旁听真实阅读位置请求及原生成功回执，所有调用和响应原样转交。 */
export async function installReadingProbe(page) {
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, post = bridge.postMessage, receive = bridge.onmessage;
    const waiting = new Map(), acknowledged = [], failures = [], sent = [];
    const send = function(raw) {
      const message = JSON.parse(raw);
      if (message.op === 'notifications.context') { waiting.set(message.id, message.data.sessionId); sent.push(message.data.sessionId); }
      return post.call(bridge, raw);
    };
    const onmessage = function(event) {
      const message = JSON.parse(event.data);
      if (waiting.has(message.id)) {
        if (!message.error) acknowledged.push(waiting.get(message.id));
        else failures.push(message.error);
        waiting.delete(message.id);
      }
      return receive.call(bridge, event);
    };
    bridge.postMessage = send; bridge.onmessage = onmessage;
    if (bridge.postMessage !== send || bridge.onmessage !== onmessage) throw new Error('Native bridge cannot be observed');
    window.__dshmReadingProbe = { acknowledged, failures, sent, restore() {
      if (bridge.postMessage === send) bridge.postMessage = post;
      if (bridge.onmessage === onmessage) bridge.onmessage = receive;
      delete window.__dshmReadingProbe;
    } };
  });
}

export async function waitReading(page, expected) {
  await page.waitForFunction(expected => {
    const values = window.__dshmReadingProbe.acknowledged;
    return values.length > 0 && (expected === 'non-null' ? typeof values.at(-1) === 'string' : values.at(-1) === expected);
  }, expected);
  return page.evaluate(() => window.__dshmReadingProbe.acknowledged.at(-1));
}

export async function removeReadingProbe(page) {
  return page.evaluate(() => {
    const probe = window.__dshmReadingProbe;
    if (!probe) return [];
    const values = { acknowledged: [...probe.acknowledged], failures: [...probe.failures], sent: [...probe.sent] }; probe.restore(); return values;
  });
}
