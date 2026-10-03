/** 兼容载体中较旧的 Android WebView；不覆盖浏览器已有实现。 */
export function installRemotePlatform(target = globalThis) {
  if (!target.AbortSignal.any) Object.defineProperty(target.AbortSignal, 'any', {
    configurable: true, writable: true, value(signals) {
      const values = [...signals];
      if (values.some(signal => !(signal instanceof target.AbortSignal))) throw new TypeError('Expected AbortSignal');
      const controller = new target.AbortController(), releases = [];
      const abort = signal => { controller.abort(signal.reason); for (const release of releases.splice(0)) release(); };
      const stopped = values.find(signal => signal.aborted);
      if (stopped) abort(stopped);
      else for (const signal of new Set(values)) {
        const listener = () => abort(signal);
        signal.addEventListener('abort', listener, { once: true });
        releases.push(() => signal.removeEventListener('abort', listener));
      }
      return controller.signal;
    },
  });
  if (!target.Promise.withResolvers) Object.defineProperty(target.Promise, 'withResolvers', {
    configurable: true, writable: true, value() {
      let resolve, reject;
      const promise = new this((accept, decline) => { resolve = accept; reject = decline; });
      return { promise, resolve, reject };
    },
  });
}
