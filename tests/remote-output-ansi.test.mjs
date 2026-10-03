import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { RemoteOutputAnsi } from '../src/remote-output-ansi.mjs';

const outfile = resolve('artifacts/tests/remote-output-ansi.cjs');
await build({ stdin: { contents: "export { RemoteLiveJobOutput as Reader } from './src/remote-live-job-output.mjs'; export { parseAnsiLines } from '../deepseek-harness/packages/client/ui-primitives/src/ansi.ts';", resolveDir: process.cwd() },
  outfile, bundle: true, platform: 'node', format: 'cjs', nodePaths: [resolve('node_modules')], logLevel: 'silent' });
const { Reader, parseAnsiLines } = createRequire(import.meta.url)(outfile);
const render = value => parseAnsiLines((value.ansiPrefix ?? '') + (value.ansiText ?? value.text)).flat();
const visible = value => render(value).map(span => span.text).join('');
const red = value => render(value).find(span => span.text.includes('RED'))?.style?.color;

function fixture(mode = 'history', checkpoint) {
  const target = { sessionId: 'one', id: 'job', startedAt: 1 }, requests = [];
  const state = { selected: 'one', session: { openState: 'open' }, connectionState: 'connected', list: { jobsBySession: { one: [target] } } };
  const model = { getSnapshot: () => state, subscribe: () => () => {}, transport: { capabilities: { jobControlGeneration: 'same', jobOutput: true } },
    connection: { generation: { getSnapshot: () => ({ id: 1 }) } }, client: { request() {
      const task = Promise.withResolvers(); requests.push(task); return { promise: task.promise, cancel() {} };
    } } };
  const reader = new Reader(model, target, 'stdout', mode, checkpoint);
  return { reader, async feed(text, { end = false, gap = false } = {}) {
    const bytes = Buffer.isBuffer(text) ? text : Buffer.from(text), offset = reader.snapshot.offset + (gap ? 12 : 0);
    const reading = reader.read(); requests.at(-1).resolve({ state: 'available', status: end ? 'completed' : 'running', data: bytes.toString('base64'),
      startOffset: offset, nextOffset: offset + bytes.length, totalBytes: offset + bytes.length, lossy: gap });
    await reading; return reader.snapshot;
  } };
}

test('64KiB历史分页保留上一页颜色，不把色码显示成文字', async () => {
  const f = fixture();
  try {
    await f.feed('\u001b[31m' + 'x'.repeat(65531));
    const next = await f.feed('RED\u001b[0mPLAIN', { end: true });
    assert.equal(red(next), 'var(--dsw-alias-state-error-primary)');
    assert.equal(visible(next), 'REDPLAIN');
    assert.equal(render(next).find(span => span.text === 'PLAIN')?.style, undefined);
  } finally { f.reader.dispose(); }
});

test('ANSI序列跨字节页和重建边界不会泄漏碎片，UTF-8中文仍完整', async () => {
  const f = fixture();
  await f.feed('\u001b[3');
  assert.equal(visible(f.reader.snapshot), '');
  const checkpoint = f.reader.checkpoint(); f.reader.dispose();
  const next = fixture('history', checkpoint);
  try {
    const value = await next.feed('1mRED中文\u001b[0m', { end: true });
    assert.equal(visible(value), 'RED中文'); assert.equal(red(value), 'var(--dsw-alias-state-error-primary)');
  } finally { next.reader.dispose(); }
});

test('实时128K裁剪后保留颜色，数据缺口重置未知颜色', async () => {
  const f = fixture('live');
  try {
    await f.feed('\u001b[31m' + 'x'.repeat(65531));
    await f.feed('y'.repeat(65536));
    const value = await f.feed('z'.repeat(3000) + 'RED');
    assert.equal(value.trimmed, true); assert.equal(red(value), 'var(--dsw-alias-state-error-primary)');
    assert.ok(value.text.length <= 128 * 1024); assert.ok((value.ansiText ?? '').length <= 128 * 1024);
    const gap = await f.feed('GAP', { gap: true, end: true });
    assert.equal(render(gap).find(span => span.text.endsWith('GAP'))?.style, undefined);
  } finally { f.reader.dispose(); }
});

test('OSC跨页内容不进入可见输出，超长控制序列不增长无界状态', async () => {
  const f = fixture();
  try {
    await f.feed('\u001b]8;;https://private.invalid/');
    for (let i = 0; i < 4; i++) await f.feed('x'.repeat(65536));
    assert.equal(f.reader.ansi.pending.length, 0);
    const next = await f.feed('hidden\u0007LINK\u001b]8;;\u0007', { end: true });
    assert.equal(visible(next), 'LINK');
  } finally { f.reader.dispose(); }
});

test('装饰、256色、RGB背景跨页保留，关闭属性和颜色重置生效', async () => {
  const f = fixture();
  try {
    await f.feed('\u001b[1;3;4;38;5;196;48;2;10;20;30m');
    const value = await f.feed('RED\u001b[22;23;24;39;49mPLAIN', { end: true });
    const styled = render(value).find(span => span.text === 'RED');
    assert.equal(styled.style.fontWeight, 700);
    assert.equal(styled.style.fontStyle, 'italic');
    assert.match(styled.style.textDecoration, /underline/);
    assert.equal(styled.style.backgroundColor, 'rgb(10, 20, 30)');
    assert.equal(render(value).find(span => span.text === 'PLAIN').style, undefined);
    const same = await f.feed('', { end: true });
    assert.equal(visible(same), 'REDPLAIN');
  } finally { f.reader.dispose(); }
});

test('裁剪不留下半个CSI或代理对；长控制序列状态有界', () => {
  const ansi = new RemoteOutputAnsi();
  const append = text => ansi.append(text, { limit: 32 });
  let value = append('x'.repeat(10) + '\u001b[31m' + 'RED'.repeat(10));
  assert.equal(visible(value), 'RED'.repeat(10));
  assert.equal(red(value), 'var(--dsw-alias-state-error-primary)');
  value = append('🙂' + 'x'.repeat(31));
  assert.equal(visible(value), 'x'.repeat(31));
  append('\u001b[' + '9;'.repeat(100000));
  assert.equal(ansi.pending.length, 0);
  assert.equal(ansi.control, 'discard');
  value = append('mRED');
  assert.ok(value.ansiPrefix.length < 100);
  assert.ok(value.ansiText.length <= 32);
  assert.equal(red(value), 'var(--dsw-alias-state-error-primary)');
});

test('UTF-8和ANSI同时跨字节边界，独立reader不会互相继承颜色', async () => {
  const f = fixture(), plain = fixture();
  try {
    const bytes = Buffer.from('\u001b[31mRED中文🙂\u001b[0m');
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      const value = await f.feed(bytes.subarray(i, i + 1), { end: i === bytes.length - 1 });
      text += visible(value);
    }
    assert.equal(text, 'RED中文🙂');
    assert.equal(red(await plain.feed('RED', { end: true })), undefined);
  } finally { f.reader.dispose(); plain.reader.dispose(); }
});

test('旧版checkpoint没有ANSI状态时，EOF空读和再次重建保留可见内容', async () => {
  const old = { generation: 'same', decoder: new TextDecoder(), snapshot: {
    text: '\u001b[31mRED', offset: 8, total: 8, status: 'completed', phase: 'ended' } };
  const f = fixture('history', old);
  await f.feed('', { end: true });
  assert.equal(visible(f.reader.snapshot), 'RED');
  const checkpoint = f.reader.checkpoint(); f.reader.dispose();
  const restored = fixture('history', checkpoint);
  try { assert.equal(red(restored.reader.snapshot), 'var(--dsw-alias-state-error-primary)'); }
  finally { restored.reader.dispose(); }
});
