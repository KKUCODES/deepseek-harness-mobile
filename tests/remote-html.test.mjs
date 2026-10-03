import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlRelatedPath, stageHtml } from '../src/remote-html.mjs';

test('HTML 依赖沿用原 Host 目录，保留上级路径给 Host 规范化与权限检查', () => {
  assert.equal(htmlRelatedPath('C:\\work\\view.html', './资源.js?v=1'), 'C:\\work\\./资源.js');
  assert.equal(htmlRelatedPath('/work/a/view.html', '../style%20name.css#x'), '/work/a/../style name.css');
  assert.equal(htmlRelatedPath('\\\\host\\share\\view.html', 'app.js'), '\\\\host\\share\\app.js');
  for (const path of ['https://example.com/x.js', '/absolute.js', '%2froot.js', '%5croot.js', 'C:relative.js', '//host/x', 'bad%00.js', '', 'a\\b.js', '%ff']) {
    assert.throws(() => htmlRelatedPath('/work/view.html', path));
  }
  assert.throws(() => htmlRelatedPath('relative/view.html', 'x.js'));
});

function fixture() {
  const calls = [], controller = new AbortController(), id = '11111111-1111-4111-8111-111111111111';
  let length = 0;
  const client = { async call(op, data = {}) {
    calls.push({ op, data });
    if (op === 'html.begin') return { previewId: id };
    assert.equal(data.previewId, id);
    if (op === 'html.chunk') { assert.equal(data.offset, length); length += Buffer.from(data.data, 'base64').length; return { bytes: length }; }
    if (op === 'html.finish') { assert.equal(data.bytes, length); return { url: `https://preview.dshm.invalid/document/${id}.html` }; }
    return {};
  } };
  return { client, calls, controller };
}
test('HTML 沙箱文档分块交付，关闭及取消释放，异常来源不能成为 iframe 地址', async () => {
  const f = fixture();
  const html = '<h1>中文</h1>'.repeat(12000);
  const staged = await stageHtml(f.client, html, f.controller.signal);
  assert.equal(Buffer.concat(f.calls.filter(item => item.op === 'html.chunk').map(item => Buffer.from(item.data.data, 'base64'))).toString(), html);
  staged.dispose(); assert.equal(f.calls.at(-1).op, 'html.close');
  const bad = fixture(), call = bad.client.call;
  bad.client.call = async (op, data) => op === 'html.finish' ? { url: 'https://remote.dshm.invalid/assets/web/remote.html' } : call(op, data);
  await assert.rejects(stageHtml(bad.client, html, bad.controller.signal), /html_failed/);
  assert.equal(bad.calls.at(-1).op, 'html.close');
  const canceled = fixture(), original = canceled.client.call;
  canceled.client.call = async (op, data) => { const value = await original(op, data); if (op === 'html.chunk') canceled.controller.abort(); return value; };
  await assert.rejects(stageHtml(canceled.client, html, canceled.controller.signal), { name: 'AbortError' });
  assert.equal(canceled.calls.some(item => item.op === 'html.finish'), false);
  assert.equal(canceled.calls.at(-1).op, 'html.close');
});
