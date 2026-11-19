import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { latestMobileBuild } from '../scripts/latest-mobile-build.mjs';

const root = resolve(import.meta.dirname, '..');
const sdk = latestMobileBuild(root, { officialOnly: true, officialVersion: '0.2.2-rc.3', ci: true });
const outfile = resolve(root, 'artifacts/tests/markdown-images.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-markdown-images.mjs'], outfile, bundle: true, platform: 'node', format: 'cjs',
  plugins: [sdk.resolver], alias: sdk.alias, nodePaths: [resolve(sdk.runtime, 'node_modules'), resolve(root, 'node_modules')],
  loader: { '.module.css': 'empty', '.css': 'empty', '.svg': 'dataurl' }, logLevel: 'silent' });
const { FAILED_IMAGE_URL, RemoteMarkdownImages, markdownImageDestinations } = createRequire(import.meta.url)(outfile);

const image = () => new Uint8Array([137, 80, 78, 71]);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const flush = async () => { for (let index = 0; index < 8; index++) await tick(); };

test('正文图片复用官方空格、Windows路径与编码文件名语义', async () => {
  const text = ['![space](/work/my photo.png)', '', String.raw`![windows](C:\work\_photo.png)`, '', '![hash](/work/a%23b.png)'].join('\n');
  assert.deepEqual(markdownImageDestinations(text), ['/work/my photo.png', String.raw`C:\work\_photo.png`, '/work/a%23b.png']);
  const reads = [];
  const images = new RemoteMarkdownImages(null, 'chat', { read: async (_, path) => { reads.push(path); return image(); } });
  images.prefetch(text); await flush();
  assert.deepEqual(reads, ['/work/my photo.png', String.raw`C:\work\_photo.png`, '/work/a#b.png']);
  for (const path of reads) assert.match(images.resolve(path), /^blob:/);
  images.dispose();
});

test('失败去重，用户显式重试可恢复，永久超限不重复读取', async () => {
  let online = false, reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', { cwd: '/work', read: async () => {
    reads++; if (!online) throw Error('offline'); return image();
  } });
  images.prefetch('![x](a.png)'); await flush();
  images.prefetch('![x](a.png)'); await flush(); assert.equal(reads, 1);
  online = true; images.retry('![x](a.png)'); await flush();
  assert.equal(reads, 2); assert.match(images.resolve('a.png'), /^blob:/);
  images.dispose();
});

test('重连时仅重试暂时失败的图片，离线不新增请求', async () => {
  let state = { connectionState: 'connected', ready: true }, generation = 1, reads = 0;
  const listeners = new Set();
  const model = { lifetime: new AbortController(), getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    connection: { generation: { getSnapshot: () => ({ id: generation }) } } };
  const publish = () => { for (const fn of listeners) fn(); };
  const images = new RemoteMarkdownImages(model, 'chat', { cwd: '/work', read: async () => {
    reads++; if (reads === 1) throw Error('offline'); return image();
  } });
  images.prefetch('![x](a.png)'); await flush();
  state = { ...state, connectionState: 'disconnected' }; publish();
  images.prefetch('![y](b.png)'); await flush(); assert.equal(reads, 1);
  generation++; state = { connectionState: 'connected', ready: true }; publish(); await flush();
  assert.equal(reads, 3); assert.match(images.resolve('a.png'), /^blob:/); assert.match(images.resolve('b.png'), /^blob:/);
  images.dispose(); assert.equal(listeners.size, 0);
});

test('正文图片目标包含引用式图片，代码块与原始HTML不预取', () => {
  const text = [
    '![实拍](artifacts/a.png "标题")',
    '![引用][shot]',
    '',
    '[shot]: .shots/b.JPEG',
    '',
    '```markdown',
    '![代码](artifacts/c.png)',
    '```',
    '<img src="artifacts/d.png">',
  ].join('\n');
  assert.deepEqual(markdownImageDestinations(text), ['artifacts/a.png', '.shots/b.JPEG']);
});

test('只读取本地图片，外链、data目标与未知类型都不触发读取', async () => {
  const reads = [];
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: 'C:\\work',
    read: async (sessionId, path) => { reads.push([sessionId, path]); return image(); },
  });
  images.prefetch([
    '![a](artifacts/a.png)',
    '![duplicate](artifacts/a.png "重复")',
    '![remote](https://example.com/b.png)',
    '![inline](data:image/png;base64,AA==)',
    '![text](notes.txt)',
    '![absolute](C:\\shots\\e.jpg)',
    '![encoded](artifacts/a%20b.png)',
  ].join('\n'));
  await flush();
  assert.deepEqual(reads, [['chat', 'C:\\work\\artifacts/a.png'], ['chat', 'C:\\shots\\e.jpg'], ['chat', 'C:\\work\\artifacts/a b.png']]);
  assert.match(images.resolve('artifacts/a.png'), /^blob:/);
  assert.match(images.resolve('C:\\shots\\e.jpg'), /^blob:/);
  assert.match(images.resolve('artifacts/a b.png'), /^blob:/);
  assert.equal(images.resolve('https://example.com/b.png'), undefined);
  assert.equal(images.resolve('notes.txt'), undefined);
  images.dispose();
});

test('读取成功发布blob URL并复用，重复预取不再读取', async () => {
  let reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async () => { reads++; return image(); },
  });
  assert.equal(images.resolve('a.png'), undefined);
  images.prefetch('![a](a.png)');
  await flush();
  const url = images.resolve('a.png');
  assert.match(url, /^blob:/);
  assert.equal(reads, 1);
  images.prefetch('![a](a.png)');
  await flush();
  assert.equal(reads, 1);
  images.dispose();
  assert.equal(images.resolve('a.png'), undefined);
  await assert.rejects(fetch(url));
});

test('读取失败只影响当前图片，失败目标不重复请求', async () => {
  let reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async () => { reads++; throw new Error('offline'); },
  });
  images.prefetch('![a](a.png)\n![b](b.png)');
  await flush();
  assert.equal(reads, 2);
  assert.equal(images.resolve('a.png'), FAILED_IMAGE_URL);
  assert.equal(images.resolve('b.png'), FAILED_IMAGE_URL);
  images.prefetch('![a](a.png)\n![b](b.png)');
  await flush();
  assert.equal(reads, 2);
  images.dispose();
});

test('总预算用尽后其余图片按失败占位，不发布超出预算的URL', async () => {
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work', budget: 5, read: async () => new Uint8Array([1, 2, 3, 4]),
  });
  images.prefetch('![a](a.png)\n![b](b.png)');
  await flush();
  assert.match(images.resolve('a.png'), /^blob:/);
  assert.equal(images.resolve('b.png'), FAILED_IMAGE_URL);
  images.dispose();
});

test('并发读取不超过配置数量，完成后继续排队目标', async () => {
  let active = 0, max = 0;
  const controls = [];
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: () => new Promise(resolve => {
      active++; max = Math.max(max, active);
      controls.push(() => { active--; resolve(image()); });
    }),
  });
  images.prefetch('![a](a.png)\n![b](b.png)\n![c](c.png)');
  await flush();
  assert.equal(max, 2);
  assert.equal(controls.length, 2);
  controls.shift()();
  await flush();
  assert.equal(controls.length, 2);
  for (const finish of controls.splice(0)) finish();
  await flush();
  assert.match(images.resolve('a.png'), /^blob:/);
  assert.match(images.resolve('b.png'), /^blob:/);
  assert.match(images.resolve('c.png'), /^blob:/);
  images.dispose();
});

test('释放后读取、通知与已发布URL都失效', async () => {
  let reads = 0, notices = 0;
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work', read: async () => { reads++; return image(); },
  });
  const off = images.subscribe(() => { notices++; });
  images.prefetch('![a](a.png)');
  await flush();
  assert.equal(reads, 1);
  assert.ok(notices > 0);
  images.dispose();
  off();
  images.prefetch('![b](b.png)');
  images.notify();
  await flush();
  assert.equal(reads, 1);
});
