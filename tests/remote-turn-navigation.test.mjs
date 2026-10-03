import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { remoteConversationSources } from '../scripts/remote-conversation-sources.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/remote-turn-navigation.cjs');
await build({ stdin: { contents: `export { turnNavigationItem as adapted } from '@dshm/conversation/turn-navigation.ts';
  export { turnNavigationItem as original } from '${resolve(root, '../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/turn-navigation.ts').replaceAll('\\', '/')}';`, resolveDir: root },
  outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', alias: remoteConversationSources(root) });
const { adapted, original } = require(output);
const assistant = (key, text, visibility = 'visible') => ({ key, kind: 'assistant-step', visibility, data: { blocks: [{ kind: 'text', text }] } });
const user = (key, text) => ({ key, kind: 'user', visibility: 'visible', data: { content: [{ type: 'text', text }] } });

test('结构更新重复生成导航时复用未变节点的摘要，流式替换节点重新计算', () => {
  let reads = 0;
  const first = assistant('reply', '历史回复');
  Object.defineProperty(first.data.blocks[0], 'text', { get() { reads++; return '历史回复'; } });
  const nodes = new Map([['prompt', user('prompt', '问题')], ['reply', first]]);
  const locations = { getTurn: () => [...nodes.keys()] };
  adapted(1, locations, nodes); const once = reads;
  for (let i = 0; i < 20; i++) adapted(1, locations, nodes);
  assert.equal(reads, once, '同一历史节点不能随其他轮次结构更新重复生成摘要');
  nodes.set('reply', assistant('reply', '新的流式内容'));
  assert.equal(adapted(1, locations, nodes).response, '新的流式内容');
});

test('摘要保持原算法、顺序、可见性与跨会话节点身份', () => {
  for (const text of ['', ' \n\t ', '短文字', '长文本 '.repeat(100), '😀\n中文 '.repeat(80)]) {
    const nodes = new Map([['prompt', user('prompt', text)], ['reply', assistant('reply', text)]]);
    const locations = { getTurn: () => [...nodes.keys()] };
    assert.deepEqual(adapted(2, locations, nodes), original(2, locations, nodes));
    nodes.set('later', assistant('later', '最后一段')); nodes.set('hidden', assistant('hidden', '不可见', 'hidden'));
    assert.deepEqual(adapted(2, locations, nodes), original(2, locations, nodes));
    nodes.delete('later'); nodes.delete('reply');
    assert.deepEqual(adapted(2, locations, nodes), original(2, locations, nodes));
    nodes.clear(); assert.equal(adapted(2, locations, nodes), undefined);
    nodes.set('reply', assistant('reply', '其他会话的同名节点'));
    assert.deepEqual(adapted(2, locations, nodes), original(2, locations, nodes));
  }
});
