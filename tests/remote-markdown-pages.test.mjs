import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownPages } from '../src/remote-markdown-pages.mjs';
test('普通长正文逐段完整保留，单行和emoji也有界', () => {
  const text = 'history正文😀'.repeat(5000), pages = markdownPages(text, 1000);
  assert.equal(pages.join(''), text); assert.ok(pages.every(page => page.length <= 1000));
  assert.ok(pages.every(page => !/[\uD800-\uDBFF]$/.test(page)));
});
test('长代码块的每段围栏完整，原顺序及后续正文保留', () => {
  const pages = markdownPages('before\n\n```js\n' + 'console.log(1);\n'.repeat(500) + '```\n\nafter', 500);
  assert.match(pages[0], /^before/); assert.match(pages.at(-1), /after$/);
  assert.ok(pages.length > 10);
  for (const page of pages) assert.equal((page.match(/^```/gm) ?? []).length % 2, 0);
});
