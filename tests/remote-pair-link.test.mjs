import test from 'node:test';
import assert from 'node:assert/strict';
import { pairingServerOf } from '../src/remote-pair-link.mjs';

test('确认页展示真实服务器，App 链接同样提示 HTTP 且不显示 key', () => {
  for (const origin of ['http://127.0.0.1:8787', 'https://example.com']) {
    assert.equal(pairingServerOf(`${origin}/pair#key=not-displayed`), origin);
    assert.equal(pairingServerOf(`dshm://pair?server=${encodeURIComponent(origin)}#key=not-displayed`), origin);
  }
});

test('无效输入不渲染账号信息或非网络来源', () => {
  for (const link of ['', 'file:///tmp/pair', 'https://user:pass@example.com/pair', 'dshm://pair?server=javascript%3Aalert(1)']) {
    assert.equal(pairingServerOf(link), null);
  }
});
