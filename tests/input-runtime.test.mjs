import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 编译原控制器的 TypeScript；运行的仍是项目真实适配层和原控制器，不用替身。
await mkdir('.test-data', { recursive: true });
const directory = await mkdtemp('.test-data/input-');
const output = resolve(directory, 'runtime.mjs');
await build({ entryPoints: ['src/input-runtime.mjs'], outfile: output, bundle: true, platform: 'node', format: 'esm',
  packages: 'external', alias: { '@deepseek-ai/dsh-file-reference/grammar': resolve('../deepseek-harness/packages/context/file-reference/src/grammar.ts') } });
const { InputValidationRuntime } = await import(pathToFileURL(output).href);
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('原控制器选择中文提示词，经真实 Cordis 事件只替换触发词并保留前后文', async () => {
  const runtime = new InputValidationRuntime();
  try {
    runtime.edit('开头 /总 尾巴', 5);
    await settle();
    assert.equal(runtime.controller.menu.getSnapshot().open, true);
    runtime.controller.pick(runtime.source.name, 0);
    assert.equal(runtime.snapshot().text, '开头 请总结下面的内容： 尾巴');
    assert.equal(runtime.snapshot().applied, 1);
    assert.equal(runtime.snapshot().menuOpen, false);
  } finally { await runtime.dispose(); }
});

test('旧候选的 revision、非法范围和输入法组合态不能修改新草稿', async () => {
  const runtime = new InputValidationRuntime();
  try {
    runtime.edit('/总', 2);
    await settle();
    const oldSpan = runtime.controller.menu.getSnapshot().hit.span;
    runtime.edit('/translate', 10);
    const send = span => runtime.context.bail(runtime.context, 'slash/input-insert-text', { text: '不应插入', span });
    assert.equal(send(oldSpan), undefined);
    const revision = runtime.snapshot().revision;
    assert.equal(send({ start: -1, end: 10, draftRev: revision }), undefined);
    runtime.setComposing(true);
    assert.equal(runtime.controller.arbitrate('enter', true), 'pass');
    assert.equal(send({ start: 0, end: 10, draftRev: revision }), undefined);
    assert.equal(runtime.snapshot().text, '/translate');
    assert.equal(runtime.snapshot().rejected, 3);
    assert.equal(runtime.snapshot().menuOpen, false);
    runtime.setComposing(false);
    await settle();
    assert.equal(runtime.controller.arbitrate('enter', false), 'pick-highlighted');
    assert.equal(runtime.snapshot().text, '请翻译以下内容：');
  } finally { await runtime.dispose(); }
});

test('停用源后迟到候选不复活菜单，重新启用不重复订阅，销毁后不再写草稿', async () => {
  const runtime = new InputValidationRuntime();
  let release;
  const original = runtime.source.candidates;
  runtime.source.candidates = () => new Promise(resolve => { release = resolve; });
  runtime.edit('/总', 2);
  assert.equal(runtime.snapshot().subscriptions, 1);
  runtime.setEnabled(false);
  release([{ name: 'late', value: '不应出现' }]);
  await settle();
  assert.equal(runtime.snapshot().menuOpen, false);
  assert.equal(runtime.snapshot().subscriptions, 0);
  runtime.source.candidates = original;
  for (let index = 0; index < 20; index++) {
    runtime.setEnabled(true);
    runtime.setEnabled(true);
    assert.equal(runtime.snapshot().subscriptions, 1);
    runtime.setEnabled(false);
    assert.equal(runtime.snapshot().subscriptions, 0);
  }
  runtime.setEnabled(true);
  await runtime.dispose();
  runtime.edit('不应写入', 5);
  assert.equal(runtime.snapshot().text, '/总');
  assert.equal(runtime.snapshot().subscriptions, 0);
});
