import assert from 'node:assert/strict';
import test from 'node:test';
import { Context, Service } from '@deepseek-ai/cordis';
import { MobileInterfacePlugins, REMOTE_HOME_SLOT } from '../src/mobile-interface-plugins.mjs';

class ProbeSlots extends Service {
  entries = new Set();
  errors = new Set();
  constructor(ctx) { super(ctx, 'slots'); }
  onEntryError(listener) { this.errors.add(listener); return () => this.errors.delete(listener); }
  register(options, component) {
    return this.ctx.effect(() => {
      this.entries.add(component);
      return () => this.entries.delete(component);
    });
  }
}
const plugin = (name = 'generic-home') => ({ name, inject: ['slots'], mobileInterface: { apiVersion: 1, surface: REMOTE_HOME_SLOT }, apply(ctx) { ctx.slots.register({ name: REMOTE_HOME_SLOT }, () => null); } });
const entry = (module, load = async () => module) => ({ id: module.name, name: module.name, apiVersion: 1, load });
function setup(catalog, options) {
  const ctx = new Context(), slots = new ProbeSlots(ctx);
  const controller = new MobileInterfacePlugins(ctx, catalog, options);
  return { ctx, slots, controller };
}

test('actual Cordis enable/disable releases registration; installation state belongs to registry', async () => {
  const item = entry(plugin()), { ctx, slots, controller } = setup([item]);
  await controller.ready;
  assert.equal(controller.getSnapshot().status, 'active'); assert.equal(slots.entries.size, 1);
  await controller.select(null);
  assert.equal(slots.entries.size, 0); assert.equal(controller.getSnapshot().status, 'default');
  await ctx.fiber.dispose();
  const next = setup([item], { autoStart: false }); await next.controller.ready;
  assert.equal(next.controller.getSnapshot().status, 'default'); assert.equal(next.slots.entries.size, 0);
  await next.controller.select(item.id); assert.equal(next.slots.entries.size, 1);
  await next.ctx.fiber.dispose(); assert.equal(next.slots.entries.size, 0);
});

test('late module after disable cannot reactivate the page', async () => {
  const module = plugin(), gate = Promise.withResolvers();
  const { ctx, slots, controller } = setup([entry(module, () => gate.promise)]);
  await controller.select(null); gate.resolve(module); await controller.ready;
  assert.equal(slots.entries.size, 0); assert.equal(controller.getSnapshot().status, 'default');
  await ctx.fiber.dispose();
});

test('incompatible API and missing module fail without blocking default home', async () => {
  for (const item of [{ ...entry(plugin()), apiVersion: 2 }, entry(plugin(), async () => { throw Error('network'); }), entry({ ...plugin(), mobileInterface: { apiVersion: 2 } })]) {
    const { ctx, slots, controller } = setup([item]); await controller.ready;
    assert.equal(controller.getSnapshot().status, 'failed'); assert.equal(slots.entries.size, 0);
    await controller.select(null); assert.equal(controller.getSnapshot().status, 'default');
    await ctx.fiber.dispose();
  }
});

test('page render error unloads only interface plugin and can be explicitly retried', async () => {
  const item = entry(plugin()), { ctx, slots, controller } = setup([item]); await controller.ready;
  for (const listener of slots.errors) listener(REMOTE_HOME_SLOT);
  await new Promise(resolve => setTimeout(resolve));
  assert.equal(controller.getSnapshot().status, 'failed'); assert.equal(slots.entries.size, 0);
  await controller.select(item.id); assert.equal(controller.getSnapshot().status, 'active');
  assert.equal(slots.entries.size, 1); await ctx.fiber.dispose();
});

test('rapid selection settles on the final plugin without duplicate slots', async () => {
  const first = plugin('first'), second = plugin('second'), gate = Promise.withResolvers();
  const { ctx, slots, controller } = setup([entry(first, () => gate.promise), entry(second)]);
  await controller.select('second'); gate.resolve(first); await controller.ready;
  assert.equal(controller.getSnapshot().selected, 'second'); assert.equal(controller.getSnapshot().status, 'active');
  assert.equal(slots.entries.size, 1); await ctx.fiber.dispose();
});

test('managed loader cannot activate before installed state is reconciled', async () => {
  let loads = 0;
  const module = plugin(), item = entry(module, async () => { loads++; return module; });
  const { ctx, slots, controller } = setup([item], { autoStart: false });
  await controller.ready;
  assert.equal(loads, 0); assert.equal(slots.entries.size, 0);
  await controller.select(item.id); assert.equal(loads, 1); assert.equal(slots.entries.size, 1);
  await ctx.fiber.dispose();
});

test('a stalled module times out and cannot activate after fallback', async () => {
  const gate = Promise.withResolvers(), module = plugin();
  const { ctx, slots, controller } = setup([entry(module, () => gate.promise)], { timeoutMs: 10 });
  await controller.ready; assert.equal(controller.getSnapshot().error, 'timeout');
  gate.resolve(module); await new Promise(resolve => setTimeout(resolve));
  assert.equal(controller.getSnapshot().status, 'failed'); assert.equal(slots.entries.size, 0);
  await ctx.fiber.dispose();
});

test('closing the host during load cannot leave a late Cordis registration', async () => {
  const gate = Promise.withResolvers(), module = plugin();
  const { ctx, slots, controller } = setup([entry(module, () => gate.promise)]);
  await ctx.fiber.dispose(); gate.resolve(module); await controller.ready;
  assert.equal(slots.entries.size, 0);
});
