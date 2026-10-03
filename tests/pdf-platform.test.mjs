import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pdfWorkerPlatform } from '../scripts/pdf-assets.mjs';

test('PDF Worker 在旧引擎中转移、截断和扩展缓冲区，原缓冲区失效', async () => {
  const context = vm.createContext({ structuredClone, AbortSignal, AbortController });
  vm.runInContext('delete ArrayBuffer.prototype.transferToFixedLength; delete Promise.withResolvers;', context);
  vm.runInContext(await pdfWorkerPlatform(), context);
  const result = vm.runInContext(`(() => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const short = buffer.transferToFixedLength(2);
    const expanded = short.transferToFixedLength(4);
    let detached = false, negative = false;
    try { buffer.transferToFixedLength(); } catch (error) { detached = error instanceof TypeError; }
    try { new ArrayBuffer(1).transferToFixedLength(-1); } catch (error) { negative = error instanceof RangeError; }
    return JSON.stringify({ bytes: [...new Uint8Array(expanded)], originalLength: buffer.byteLength,
      shortLength: short.byteLength, detached, negative, promises: typeof Promise.withResolvers });
  })()`, context);
  assert.deepEqual(JSON.parse(result), { bytes: [1, 2, 0, 0], originalLength: 0, shortLength: 0,
    detached: true, negative: true, promises: 'function' });
});
