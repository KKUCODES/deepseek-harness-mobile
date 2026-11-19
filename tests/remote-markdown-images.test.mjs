import test from 'node:test';
import assert from 'node:assert/strict';
import { FAILED_IMAGE_URL, RemoteMarkdownImages, markdownImageDestinations, markdownImageFailureBlocks } from '../src/remote-markdown-images.mjs';

const image = () => new Uint8Array([137, 80, 78, 71]);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const flush = async () => { for (let index = 0; index < 8; index++) await tick(); };

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

test('失败原因按读取、超限、缓存与解码归类，并带错误码和可重试标记', async () => {
  const cases = [
    { reason: 'read', retryable: true, code: 'remote_image_read_failed', error: new Error('offline') },
    { reason: 'too_large', retryable: false, code: 'remote_image_too_large', error: Object.assign(new Error('too big'), { code: 'remote_file_preview_too_large' }) },
    { reason: 'budget', retryable: true, code: 'remote_image_budget', budget: 1 },
    { reason: 'decode', retryable: false, code: 'remote_image_decode', bytes: new Uint8Array(0) },
  ];
  for (const item of cases) {
    const images = new RemoteMarkdownImages(null, 'chat', {
      cwd: '/work', budget: item.budget,
      read: async () => {
        if (item.error) throw item.error;
        return item.bytes ?? image();
      },
    });
    images.prefetch('![a](a.png)');
    await flush();
    const failure = images.failureFor('a.png', '播放中声波动画');
    assert.equal(failure.reason, item.reason);
    assert.equal(failure.retryable, item.retryable);
    assert.equal(failure.code, item.code);
    assert.equal(failure.alt, '播放中声波动画');
    assert.equal(failure.path, '/work/a.png');
    assert.equal(images.resolve('a.png'), FAILED_IMAGE_URL);
    images.dispose();
  }
});

test('工作区未知的本地图片登记为不可重试失败，仍可展开原因', async () => {
  let reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', { read: async () => { reads++; return image(); } });
  images.prefetch('![a](artifacts/a.png)');
  await flush();
  const failure = images.failureFor('artifacts/a.png', '描述');
  assert.equal(failure.reason, 'no_cwd');
  assert.equal(failure.code, 'remote_image_no_cwd');
  assert.equal(failure.retryable, false);
  assert.equal(failure.path, 'artifacts/a.png');
  assert.equal(images.resolve('artifacts/a.png'), FAILED_IMAGE_URL);
  assert.equal(await images.retry('artifacts/a.png'), false);
  assert.equal(reads, 0);
  images.dispose();
});

test('重新加载清掉失败并重新读取，成功后恢复为就绪图片', async () => {
  let reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async () => {
      reads++;
      if (reads === 1) throw new Error('offline');
      return image();
    },
  });
  images.prefetch('![a](a.png)');
  await flush();
  assert.equal(images.failureFor('a.png', 'a').reason, 'read');
  assert.equal(await images.retry('a.png'), true);
  assert.equal(images.failureFor('a.png', 'a'), undefined);
  assert.match(images.resolve('a.png'), /^blob:/);
  assert.equal(reads, 2);
  images.dispose();
});

test('不可重试的失败不发起新的读取', async () => {
  let reads = 0;
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async () => { reads++; throw Object.assign(new Error('too big'), { code: 'remote_file_preview_too_large' }); },
  });
  images.prefetch('![a](a.png)');
  await flush();
  assert.equal(await images.retry('a.png'), false);
  assert.equal(reads, 1);
  images.dispose();
});

test('浏览器解码失败后按解码原因展示，不再保留原URL', async () => {
  const images = new RemoteMarkdownImages(null, 'chat', { cwd: '/work', read: async () => image() });
  images.prefetch('![a](a.png)');
  await flush();
  const url = images.resolve('a.png');
  assert.match(url, /^blob:/);
  assert.equal(images.decodeFailed(url), true);
  assert.equal(images.decodeFailed(url), false);
  assert.equal(images.failureFor('a.png', 'a').reason, 'decode');
  assert.equal(images.failureFor('a.png', 'a').retryable, false);
  assert.equal(images.resolve('a.png'), FAILED_IMAGE_URL);
  images.dispose();
});

test('失败图片只切分顶层独立图片段落，行内与嵌套图片保持原渲染', async () => {
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async (_session, path) => {
      if (path.endsWith('a.png')) throw new Error('offline');
      return image();
    },
  });
  const text = [
    '第一段',
    '',
    '![播放中声波动画](a.png)',
    '',
    '第二段 ![行内](b.png) 继续',
    '',
    '- 列表里的 ![图](a.png)',
  ].join('\n');
  images.prefetch(text);
  await flush();
  const blocks = markdownImageFailureBlocks(text, (destination, alt) => images.failureFor(destination, alt));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'markdown');
  assert.match(blocks[0].text, /第一段/);
  assert.equal(blocks[1].type, 'failure');
  assert.equal(blocks[1].failure.alt, '播放中声波动画');
  assert.equal(blocks[1].failure.reason, 'read');
  assert.equal(blocks[2].type, 'markdown');
  assert.match(blocks[2].text, /第二段/);
  assert.match(blocks[2].text, /列表里的/);
  images.dispose();
});

test('引用式独立图片同样按失败切分，没有失败时不切分', async () => {
  const images = new RemoteMarkdownImages(null, 'chat', {
    cwd: '/work',
    read: async () => { throw new Error('offline'); },
  });
  const text = '![图][shot]\n\n[shot]: a.png';
  images.prefetch(text);
  await flush();
  const blocks = markdownImageFailureBlocks(text, (destination, alt) => images.failureFor(destination, alt));
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'failure');
  assert.equal(blocks[0].failure.alt, '图');
  assert.equal(blocks[0].failure.destination, 'a.png');
  assert.equal(blocks[1].type, 'markdown');
  assert.match(blocks[1].text, /\[shot\]: a\.png/);
  images.dispose();

  const ready = new RemoteMarkdownImages(null, 'chat', { cwd: '/work', read: async () => image() });
  ready.prefetch('![a](a.png)');
  await flush();
  assert.equal(markdownImageFailureBlocks('![a](a.png)', (destination, alt) => ready.failureFor(destination, alt)), undefined);
  ready.dispose();
});
