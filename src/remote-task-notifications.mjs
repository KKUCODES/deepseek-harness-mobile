const uuid = value => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const session = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\x00-\x1f\x7f]/.test(value);
const number = value => Number.isSafeInteger(value) && value >= 0;
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const pending = item => keys(item, ['eventId', 'sessionId', 'kind']) && uuid(item.eventId)
  && session(item.sessionId) && ['approval', 'question'].includes(item.kind);
const invalid = () => { throw new Error('invalid_task_notification'); };

/** 只保留进程内通知身份；初始待办用于核对/清除旧提醒，不作为新通知。 */
export class RemoteNoticeLedger {
  seen = new Set();
  pending = new Map();
  remember(key) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > 4096) this.seen.delete(this.seen.values().next().value);
    return true;
  }
  baseline(items) {
    if (!Array.isArray(items) || items.length > 256 || !items.every(pending)
      || new Set(items.map(item => item.eventId)).size !== items.length
      || items.some(item => this.seen.has(`resolved:${item.eventId}`))) invalid();
    const removed = [...this.pending.keys()].filter(id => !items.some(item => item.eventId === id));
    this.pending = new Map(items.map(item => [item.eventId, Object.freeze({ ...item })]));
    for (const item of items) this.remember(`pending:${item.eventId}`);
    for (const id of removed) this.remember(`resolved:${id}`);
    return { type: 'baseline', removed, pending: [...this.pending.values()] };
  }
  receive(event) {
    if (event?.type === 'pending' && keys(event, ['type', 'item']) && pending(event.item)) {
      const item = Object.freeze({ ...event.item }), previous = this.pending.get(item.eventId);
      if (this.seen.has(`resolved:${item.eventId}`)) return { type: 'ignored' };
      if (previous && (previous.sessionId !== item.sessionId || previous.kind !== item.kind)) invalid();
      if (!previous && this.pending.size >= 256) invalid();
      this.pending.set(item.eventId, item);
      return { type: 'pending', item, notify: this.remember(`pending:${item.eventId}`) };
    }
    if (event?.type === 'resolved' && keys(event, ['type', 'eventId']) && uuid(event.eventId)) {
      this.pending.delete(event.eventId);
      this.remember(`pending:${event.eventId}`);
      this.remember(`resolved:${event.eventId}`);
      return { type: 'resolved', eventId: event.eventId };
    }
    if (event?.type === 'outcome' && keys(event, ['type', 'sessionId', 'seq', 'time', 'turn', 'reason'])
      && session(event.sessionId) && ['seq', 'time', 'turn'].every(key => number(event[key]))
      && ['completed', 'error', 'blocked', 'max-tokens'].includes(event.reason)) {
      return { type: 'outcome', item: Object.freeze({ ...event }),
        notify: this.remember(`outcome:${JSON.stringify([event.sessionId, event.seq])}`) };
    }
    invalid();
  }
}

/** 只读流跟随已协商的连接代次；失败不重放事件、不重试任何写请求。 */
export function watchTaskNotifications(model, ledger, changed) {
  let disposed = false, current, key;
  const stop = () => { const old = current; current = undefined; old?.request?.cancel(); };
  const publish = patch => model.publish({ taskNotifications: { ...model.getSnapshot().taskNotifications, ...patch } });
  const start = () => {
    const state = model.getSnapshot(), generation = model.capabilityGeneration;
    const next = state.connectionState === 'connected' && generation
      && model.transport.capabilities?.taskNotifications === true ? generation : undefined;
    if (disposed || key === next) return;
    key = next; stop();
    if (!next) { publish({ status: 'offline' }); return; }
    const subscription = current = { ready: false };
    const fail = () => {
      if (disposed || current !== subscription) return;
      stop(); publish({ status: 'error' });
    };
    publish({ status: 'connecting' });
    try {
      subscription.request = model.client.request({ method: 'remote.taskFollow' }, event => {
        if (disposed || current !== subscription) return;
        try {
          let change;
          if (!subscription.ready) {
            if (!keys(event, ['type', 'generation', 'pendingAvailable', 'pending']) || event.type !== 'ready'
              || !uuid(event.generation) || typeof event.pendingAvailable !== 'boolean'
              || (!event.pendingAvailable && event.pending?.length !== 0)) invalid();
            change = ledger.baseline(event.pending);
            subscription.ready = true;
            subscription.pendingAvailable = event.pendingAvailable;
            publish({ status: 'listening', pendingAvailable: event.pendingAvailable });
          } else {
            if (!subscription.pendingAvailable && event?.type !== 'outcome') invalid();
            change = ledger.receive(event);
          }
          changed(change);
        } catch { fail(); }
      }, fail);
      void subscription.request.promise.then(fail, fail);
      if (current !== subscription) subscription.request.cancel();
    } catch { fail(); }
  };
  const off = model.subscribe(start);
  start();
  return () => { disposed = true; off(); stop(); };
}
