import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/startup.js', import.meta.url), 'utf8');
function startup({ native = true, reduced = false } = {}) {
  const events = new Map(), timers = new Map(), frames = new Map(), messages = [];
  let id = 0, removed = false, revealed = false;
  const cover = {
    style: {}, remove() { removed = true; }, addEventListener() {},
    querySelectorAll: () => [{ set hidden(value) { revealed = !value; } }],
    querySelector: () => ({ addEventListener() {} }),
  };
  const document = { readyState: 'complete', documentElement: { lang: 'zh-CN' }, getElementById: () => cover };
  const window = {
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: name => events.delete(name),
    ...(native ? { DSHMStartup: { postMessage: value => messages.push(value) } } : {}),
  };
  runInNewContext(source, { window, document, matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
  });
  return {
    controller: window.__dshmStartup, messages, timers, events, cover,
    get removed() { return removed; }, get revealed() { return revealed; },
    frame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
  };
}

test('startup keeps the logo until committed content crosses two frames, then sends one native ready', () => {
  const app = startup();
  app.controller.ready(); app.controller.ready();
  assert.equal(app.removed, false);
  app.frame();
  assert.deepEqual(app.messages, []);
  app.frame();
  assert.equal(app.removed, true);
  assert.deepEqual(app.messages, ['ready']);
  assert.equal(app.timers.size, 0);
  assert.equal(app.events.size, 0);
});

test('startup failure wins over a queued reveal and cannot be dismissed by a late ready', () => {
  const app = startup();
  app.controller.ready(); app.frame();
  app.controller.fail(); app.controller.ready(); app.frame();
  assert.equal(app.removed, false);
  assert.equal(app.revealed, true);
  assert.deepEqual(app.messages, ['failed']);
  assert.equal(app.timers.size, 0);
});

test('missing modules time out to a retry screen, with no unbounded logo or raw exception text', () => {
  const app = startup();
  const timeout = [...app.timers.values()][0];
  assert.equal(timeout.ms, 30_000);
  timeout.fn(); timeout.fn();
  assert.equal(app.revealed, true);
  assert.equal(app.removed, false);
  assert.deepEqual(app.messages, ['failed']);
});

test('browser fallback respects reduced motion and has a bounded removal if transitionend never fires', () => {
  for (const reduced of [true, false]) {
    const app = startup({ native: false, reduced });
    app.controller.ready(); app.frame(); app.frame();
    assert.equal(app.cover.style.opacity, '0');
    const cleanup = [...app.timers.values()][0];
    assert.equal(cleanup.ms, reduced ? 0 : 260);
    cleanup.fn();
    assert.equal(app.removed, true);
  }
});
