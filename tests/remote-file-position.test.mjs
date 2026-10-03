import assert from 'node:assert/strict';
import test from 'node:test';
import { fileLine, fileLineRange } from '../src/remote-file-position.mjs';

test('file line navigation keeps CRLF, blank lines and original source intact', () => {
  const text = '第一行\r\n\r\n目标😀\n';
  for (const [line, expected] of [[1, '第一行'], [2, ''], [3, '目标😀'], [4, '']]) {
    const { start, end } = fileLineRange(text, line);
    assert.equal(text.slice(start, end), expected);
    assert.equal(text.slice(0, start) + text.slice(start, end) + text.slice(end), text);
  }
  assert.equal(fileLineRange(text, 5), null);
  assert.deepEqual(fileLineRange('', 1), { start: 0, end: 0 });
  assert.equal(fileLineRange('last', 2), null);
});

test('invalid or enormous file positions cannot select a different line', () => {
  for (const value of [undefined, null, '2', 0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(fileLine(value), undefined);
    assert.equal(fileLineRange('one\ntwo', value), null);
  }
  assert.equal(fileLineRange('one\ntwo', Number.MAX_SAFE_INTEGER), null);
});
