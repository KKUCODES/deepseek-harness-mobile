import { clientFrameSchema, MAX_UPLOAD_BYTES, RESOURCE_CHUNK_BYTES, RESOURCE_WINDOW } from '../../backend/packages/protocol/dist/index.js';

/** 原文件插件的 fetch 载体；只接受其固定上传路由，保留原 Host receipt 与业务结果。 */
export async function uploadRemote(client, input, init, lifetime) {
  const url = new URL(String(input), 'https://remote.dshm.invalid');
  const keys = [...url.searchParams.keys()];
  if (url.origin !== 'https://remote.dshm.invalid' || url.pathname !== '/api/session/uploadFileBinary'
    || url.username || url.password || url.hash || init?.method !== 'POST'
    || keys.some(key => !['sessionId', 'name'].includes(key)) || new Set(keys).size !== keys.length
    || new Headers(init.headers).get('content-type') !== 'application/octet-stream') throw new Error('remote_upload_denied');
  return uploadBody(client, { method: 'remote.upload', sessionId: url.searchParams.get('sessionId'),
    ...(url.searchParams.has('name') ? { name: url.searchParams.get('name') } : {}) }, init.body, lifetime, init.signal);
}

/** 大图片随原消息一次提交；仅普通/子会话消息，不扩大通用 RPC 的单帧限制。 */
export async function promptRemote(client, payload, lifetime, signal, endpoint = 'session/prompt') {
  const rpcId = crypto.randomUUID();
  const envelope = { type: 'client-request', rpcId, method: endpoint, payload };
  const response = await uploadBody(client, { method: 'remote.prompt', rpcId, ...(endpoint === 'session/prompt' ? {} : { endpoint }) }, new Blob([JSON.stringify(envelope)], { type: 'application/json' }), lifetime, signal);
  return response.json();
}

async function uploadBody(client, operation, body, lifetime, callerSignal) {
  if (!(body instanceof Blob) && !(body instanceof ReadableStream)) throw new Error('remote_upload_body');
  if (body instanceof Blob && body.size > MAX_UPLOAD_BYTES) throw new Error('remote_upload_too_large');
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, lifetime, ...(callerSignal ? [callerSignal] : [])]);
  signal.throwIfAborted();
  const source = body instanceof Blob ? body.stream() : body;
  let request, failure, finished = false, credits = 0, wake, reader, total = 0, complete = false, earlyResult, finalTimer;
  const notify = () => wake?.();
  const cancel = () => { request?.cancel(); void reader?.cancel().catch(() => {}); notify(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    request = client.request(operation, value => {
      if (value?.type !== 'credit' || !Number.isInteger(value.count) || value.count < 1 || credits + value.count > RESOURCE_WINDOW) {
        failure = new Error('invalid_upload_credit'); controller.abort();
      } else credits += value.count;
      notify();
    });
    // 失败可能早于第一次读取；立即挂 rejection handler，迟到成功也不能触发重传。
    const outcome = request.promise.then(value => { earlyResult = value; finished = true; void reader?.cancel().catch(() => {}); notify(); return value; }, error => {
      failure = error; finished = true; controller.abort(); return undefined;
    });
    reader = source.getReader();
    const check = () => {
      if (failure) throw failure;
      signal.throwIfAborted();
      if (finished) throw new Error('remote_upload_ended_early');
    };
    const send = frame => client.call('socket.send', { frame: clientFrameSchema.parse(frame) });
    for (;;) {
      check();
      const item = await reader.read(); check();
      if (item.done) break;
      if (!(item.value instanceof Uint8Array)) throw new Error('remote_upload_body');
      total += item.value.byteLength;
      if (total > MAX_UPLOAD_BYTES) throw new Error('remote_upload_too_large');
      for (let offset = 0; offset < item.value.length; offset += RESOURCE_CHUNK_BYTES) {
        while (!credits) {
          check();
          await new Promise(resolve => {
            const timer = setTimeout(() => { failure = new Error('remote_upload_timeout'); controller.abort(); }, 30000);
            wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
          });
        }
        check(); credits--;
        const chunk = item.value.subarray(offset, offset + RESOURCE_CHUNK_BYTES);
        let binary = '';
        for (let start = 0; start < chunk.length; start += 8192) binary += String.fromCharCode(...chunk.subarray(start, start + 8192));
        await send({ type: 'uploadChunk', id: request.id, data: btoa(binary) });
      }
    }
    await send({ type: 'uploadEnd', id: request.id });
    finalTimer = setTimeout(() => { failure = new Error('request_timeout_outcome_unknown'); controller.abort(); }, 30000);
    const result = await outcome;
    if (failure) throw failure;
    signal.throwIfAborted();
    if (typeof result?.ok !== 'boolean') throw new Error('invalid_remote_result');
    complete = true;
    return Response.json(result);
  } catch (error) {
    // Host 可在读取正文前返回“会话不存在”等原业务错误，保持原插件的错误语义。
    if (!failure && !signal.aborted && earlyResult?.ok === false) { complete = true; return Response.json(earlyResult); }
    throw failure ?? error;
  } finally {
    clearTimeout(finalTimer);
    signal.removeEventListener('abort', cancel);
    if (!complete) request?.cancel();
    // 取消不会等待用户提供的 source 完成异步清理，避免卡住断线销毁。
    void reader?.cancel().catch(() => {}); reader?.releaseLock();
  }
}
