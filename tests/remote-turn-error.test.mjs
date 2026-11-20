import test from 'node:test';
import assert from 'node:assert/strict';
import { turnErrorDetail } from '../src/remote-turn-error.mjs';

const provider = '429: {"code":"token_plan_person_rate_limit_exceeded","message":"Token Plan Person request rate limit exceeded","type":"quota_exceeded"}';

test('带状态码的供应方 JSON 失败提取可读消息并保留原文', () => {
  assert.deepEqual(turnErrorDetail(provider), {
    raw: provider,
    message: 'Token Plan Person request rate limit exceeded',
    status: '429',
    extracted: true,
  });
});

test('状态码与 JSON 之间允许换行', () => {
  const raw = '429:\n{"code":"rate_limited","message":"slow down"}';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: 'slow down', status: '429', extracted: true });
});

test('嵌套 error.message 也能提取', () => {
  const raw = '{"error":{"type":"invalid_request_error","message":"missing model"}}';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: 'missing model', status: '', extracted: true });
});

test('普通错误文本保持原样且不产生原始错误展开项', () => {
  const raw = 'The DSH process exited before this turn finished.';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: raw, status: '', extracted: false });
});

test('JSON 没有消息字段时保留完整原文', () => {
  const raw = '500: {"code":"server_error"}';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: raw, status: '500', extracted: false });
});

test('JSON 前后存在其他文本时不按结构化错误处理', () => {
  const raw = 'gateway replied 502: {"message":"upstream"} after retry';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: raw, status: '', extracted: false });
});

test('损坏的 JSON 不吞掉原文', () => {
  const raw = '429: {"message":"unterminated';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: raw, status: '', extracted: false });
});

test('空消息和非字符串消息返回空内容', () => {
  assert.deepEqual(turnErrorDetail(''), { raw: '', message: '', status: '', extracted: false });
  assert.deepEqual(turnErrorDetail(undefined), { raw: '', message: '', status: '', extracted: false });
});

test('HTTP 前缀和 JSON 尾随空白都能识别', () => {
  const raw = 'HTTP 429: {"message":"rate limited"}  ';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: 'rate limited', status: '429', extracted: true });
});

test('前导空白不影响状态码和 JSON 识别', () => {
  const raw = '  429: {"message":"slow down"}';
  assert.deepEqual(turnErrorDetail(raw), { raw, message: 'slow down', status: '429', extracted: true });
});