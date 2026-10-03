import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { installRemotePlatform } from '../src/remote-platform.mjs';
import installRemoteUrl from '../src/remote-url-platform.cjs';

test('旧 WebView 的组合取消保留首个原因并清理其他来源监听，空输入保持有效', async () => {
  class Signal extends EventTarget { aborted = false; reason; }
  class Controller {
    signal = new Signal();
    abort(reason) { if (this.signal.aborted) return; this.signal.aborted = true; this.signal.reason = reason; this.signal.dispatchEvent(new Event('abort')); }
  }
  const PromiseClass = vm.runInNewContext('Promise'); delete PromiseClass.withResolvers;
  const target = { AbortSignal: Signal, AbortController: Controller, Promise: PromiseClass };
  installRemotePlatform(target);
  const first = new Controller(), second = new Controller();
  let removals = 0; const remove = second.signal.removeEventListener.bind(second.signal);
  second.signal.removeEventListener = (...args) => { removals++; remove(...args); };
  const both = Signal.any([first.signal, second.signal]);
  first.abort('first'); second.abort('second');
  assert.equal(both.reason, 'first'); assert.equal(removals, 1);
  assert.equal(Signal.any([first.signal]).reason, 'first');
  assert.equal(Signal.any([]).aborted, false);
  assert.throws(() => Signal.any([{}]), TypeError);
  const deferred = PromiseClass.withResolvers(); deferred.resolve(7); assert.equal(await deferred.promise, 7);
  const rejected = PromiseClass.withResolvers(); rejected.reject(new Error('fixture')); await assert.rejects(rejected.promise, /fixture/);
});

test('现代引擎的原实现保持不变', () => {
  const any = AbortSignal.any, withResolvers = Promise.withResolvers, url = URL;
  installRemotePlatform();
  installRemoteUrl();
  assert.equal(AbortSignal.any, any); assert.equal(Promise.withResolvers, withResolvers);
  assert.equal(URL, url);
});

test('旧引擎自定义资源协议恢复 host/path，保留 HTTP、配对链接与 blob URL', () => {
  // 在独立进程模拟旧引擎缺陷，避免全局补丁污染其他并行测试。
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const NativeURL = URL;
    globalThis.URL = class extends NativeURL {
      get hostname() { return this.protocol === 'dsh-resource:' ? '' : super.hostname; }
    };
    const { default: installRemoteUrl } = await import('./src/remote-url-platform.cjs');
    installRemoteUrl();
    const resource = new URL('dsh-resource://file/session/s/Q%3A/test%20file.txt');
    assert.equal(resource.hostname, 'file');
    assert.equal(resource.pathname, '/session/s/Q%3A/test%20file.txt');
    assert.equal(new URL('sidebar://guide').hostname, 'guide');
    const pairing = new URL('dshm://pair?server=https%3A%2F%2Fexample.com#key=fixture');
    assert.equal(pairing.searchParams.get('server'), 'https://example.com');
    assert.equal(pairing.hash, '#key=fixture');
    const http = new URL('/api?q=中文', 'https://example.com');
    assert.equal(http.origin, 'https://example.com');
    assert.equal(http.searchParams.get('q'), '中文');
    assert.throws(() => new URL('not a url'), TypeError);
    const blob = URL.createObjectURL(new Blob(['fixture']));
    assert.equal(await (await fetch(blob)).text(), 'fixture');
    URL.revokeObjectURL(blob);
    await assert.rejects(fetch(blob));
  `], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});
