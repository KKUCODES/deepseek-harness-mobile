import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';

/** 验收原 ZIP 的所有日志与内容寻址附件，不提取到目录、不输出聊天正文。 */
export function inspectSessionArchive(bytes) {
  const entries = unzipSync(bytes), result = { logs: 0, images: 0, files: 0, attachmentBytes: 0 };
  for (const [name, data] of Object.entries(entries)) {
    if (/^(?:subagents\/[^/]+\/)?session(?:\.v\d+)?\.jsonl$/.test(name)) {
      const lines = strFromU8(data).trim().split('\n').map(line => JSON.parse(line));
      assert.equal(lines[0].type, 'session'); assert.ok(lines[0].id);
      if (name.startsWith('subagents/')) assert.equal(lines[0].id, name.split('/')[1]);
      result.logs++; continue;
    }
    const image = /^media\/sha256:([a-f0-9]{64})\.[^/]+$/.exec(name);
    const file = /^files\/([a-f0-9]{2})\/([a-f0-9]{64})\/[^/]+$/.exec(name);
    assert.ok(image || file, `Unexpected archive entry: ${name}`);
    const hash = createHash('sha256').update(data).digest('hex');
    assert.equal(hash, image ? image[1] : file[2]);
    if (file) assert.equal(file[1], hash.slice(0, 2));
    result[image ? 'images' : 'files']++; result.attachmentBytes += data.length;
  }
  assert.ok(result.logs > 0);
  return result;
}
