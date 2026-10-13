/** 暂停指定原请求的信用确认；旧确认丢弃，恢复后新请求仍走原载体。 */
export async function startPausedOfficeReader(page, initial) {
  await page.getByTestId('remote-workspace').evaluate((element, initial) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    let model;
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.model?.client) { model = fiber.memoizedProps.model; break; }
    }
    if (!model || window.__latestOfficeCancellation) throw Error('office_cancellation_observation_unavailable');
    const client = model.client, originalRequest = client.request, originalCall = client.call;
    const state = { hold: true, chunks: 0, receivedBytes: 0, heldAcknowledgements: 0, cancellations: 0,
      settled: false, cancellationSent: false };
    function request(operation, ...args) {
      if (state.hold && operation.method === 'remote.office' && operation.path === initial.fileName
        && operation.sessionId === initial.sessionId) {
        if (state.id || typeof args[0] !== 'function') throw Error('office_cancellation_unexpected_reader');
        const emit = args[0];
        args[0] = function(value, ...rest) {
          if (value.type === 'metadata') state.metadata = { absolutePath: value.absolutePath,
            version: value.version, generation: value.generation, bytes: value.bytes };
          if (value.type === 'chunk') {
            const data = atob(value.data);
            if (value.offset !== state.receivedBytes || data.length <= 0 || data.length > initial.chunkBytes
              || state.receivedBytes + data.length > state.metadata.bytes
              || (data.length !== initial.chunkBytes && state.receivedBytes + data.length !== state.metadata.bytes)
              || btoa(data) !== value.data)
              throw Error('office_cancellation_invalid_original_chunk');
            state.chunks++; state.receivedBytes += data.length;
          }
          return emit.call(this, value, ...rest);
        };
        const pending = originalRequest.call(this, operation, ...args);
        state.id = pending.id;
        pending.promise.then(value => { state.settled = true; state.resultUndefined = value === undefined;
          if (value?.ok === false) state.resultFailure = { code: value.error.code, details: value.error.details };
        },
          failure => { state.settled = true; state.failure = failure.message; });
        return pending;
      }
      return originalRequest.call(this, operation, ...args);
    }
    function call(operation, data, ...args) {
      if (operation === 'socket.send' && data?.frame?.id === state.id) {
        if (state.hold && data.frame.type === 'ack') {
          if (data.frame.count !== 1) throw Error('office_cancellation_unexpected_ack');
          state.heldAcknowledgements++;
          return Promise.resolve();
        }
        if (data.frame.type === 'cancel') {
          state.cancellations++;
          return originalCall.call(this, operation, data, ...args).then(value => {
            state.cancellationSent = true; return value;
          });
        }
      }
      return originalCall.call(this, operation, data, ...args);
    }
    client.request = request; client.call = call;
    window.__latestOfficeCancellation = { state, client, release() { state.hold = false; }, async resume() {
      if (!state.hold || !state.id || state.settled || state.heldAcknowledgements !== initial.window)
        throw Error('office_resume_requires_original_held_window');
      state.hold = false;
      await originalCall.call(client, 'socket.send', { frame: { type: 'ack', id: state.id, count: state.heldAcknowledgements } });
      state.resumedAcknowledgements = state.heldAcknowledgements;
    }, stop() {
      if (client.request === request) client.request = originalRequest;
      if (client.call === call) client.call = originalCall;
      delete window.__latestOfficeCancellation;
    } };
  }, initial);
  return {
    snapshot: () => page.evaluate(() => {
      const observation = window.__latestOfficeCancellation;
      return { ...observation.state, pending: observation.client.requests.has(observation.state.id) };
    }),
    release: () => page.evaluate(() => window.__latestOfficeCancellation.release()),
    resume: () => page.evaluate(() => window.__latestOfficeCancellation.resume()),
    stop: () => page.evaluate(() => window.__latestOfficeCancellation?.stop()),
  };
}
