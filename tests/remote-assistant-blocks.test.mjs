import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantHasVisibleContent, visibleAssistantBlock } from '../src/remote-assistant-blocks.mjs';

test('空思考块不进入正文，未知块与空文字仍按原顺序保留', () => {
  assert.equal(visibleAssistantBlock({ kind: 'reasoning', text: '' }), false);
  assert.equal(visibleAssistantBlock({ kind: 'reasoning', text: '  \n' }), false);
  assert.equal(visibleAssistantBlock({ kind: 'reasoning', text: '思考' }), true);
  assert.equal(visibleAssistantBlock({ kind: 'text', text: '' }), true);
  assert.equal(visibleAssistantBlock({ kind: 'image' }), true);
  assert.equal(visibleAssistantBlock({ kind: 'extension', block: { value: 1 } }), true);
});

test('只有工具头或空思考的回复不生成正文壳', () => {
  assert.equal(assistantHasVisibleContent([]), false);
  assert.equal(assistantHasVisibleContent([{ kind: 'tool-call' }, { kind: 'tool-call' }]), false);
  assert.equal(assistantHasVisibleContent([{ kind: 'reasoning', text: '' }]), false);
  assert.equal(assistantHasVisibleContent([{ kind: 'reasoning', text: '思考' }]), true);
  assert.equal(assistantHasVisibleContent([{ kind: 'text', text: '正文' }]), true);
});
