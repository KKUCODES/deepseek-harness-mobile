// 从电脑原始插件资源路由下载的真实 Worker，不读取聊天或设备凭据。
let tick = 0;
setInterval(() => self.postMessage({ type: 'tick', tick: ++tick }), 100);
self.onmessage = async ({ data }) => {
  if (data.type !== 'read') return;
  try {
    const response = await fetch(data.url, { cache: 'no-store', credentials: 'omit' });
    const text = await response.text();
    self.postMessage({ type: 'read', status: response.status, bytes: text.length,
      ownMarker: text.includes('dshm-worker-lifecycle-marker'),
      noBridge: typeof self.DSHMRemote === 'undefined' && typeof self.DSHMOrdinary === 'undefined' });
  } catch { self.postMessage({ type: 'read', error: 'resource-unavailable' }); }
};
