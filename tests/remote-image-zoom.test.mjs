import test from 'node:test';
import assert from 'node:assert/strict';
import { clampScale, panBounds, touchDistance, touchMidpoint, zoomAt } from '../src/remote-image-zoom.mjs';

test('缩放倍数限制在1到5之间', () => {
  assert.equal(clampScale(0.2), 1);
  assert.equal(clampScale(1), 1);
  assert.equal(clampScale(2.5), 2.5);
  assert.equal(clampScale(9), 5);
  assert.equal(clampScale(Number.NaN), 1);
});

test('围绕指针缩放后，指针下的原图像素保持不动', () => {
  const center = { x: 200, y: 400 };
  const state = { x: 12, y: -8, scale: 1.5 };
  const point = { x: 260, y: 350 };
  const pixel = { x: (point.x - center.x - state.x) / state.scale, y: (point.y - center.y - state.y) / state.scale };
  const next = zoomAt(state, 3, point, center);
  assert.equal(next.scale, 3);
  assert.ok(Math.abs(center.x + next.x + pixel.x * next.scale - point.x) < 1e-9);
  assert.ok(Math.abs(center.y + next.y + pixel.y * next.scale - point.y) < 1e-9);
});

test('平移边界允许放大图贴到边缘，缩回1倍时不再保留偏移', () => {
  assert.deepEqual(panBounds(300, 200, 1, 300, 200), { x: 0, y: 0 });
  assert.deepEqual(panBounds(300, 200, 3, 300, 200), { x: 300, y: 200 });
  assert.deepEqual(panBounds(100, 100, 2, 400, 400), { x: 0, y: 0 });
});

test('双指距离与中点用于捏合锚点', () => {
  const first = { clientX: 100, clientY: 200 };
  const second = { clientX: 160, clientY: 280 };
  assert.equal(touchDistance(first, second), 100);
  assert.deepEqual(touchMidpoint(first, second), { x: 130, y: 240 });
});
