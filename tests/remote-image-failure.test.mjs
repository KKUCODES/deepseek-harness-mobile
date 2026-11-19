import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_FAILURE_REASONS, imageFailureReason, imageFailureReasonFromError, previewImageFailure } from '../src/remote-image-failure.mjs';

test('五类失败原因都有错误码、文案与是否可重试', () => {
  assert.deepEqual(Object.keys(IMAGE_FAILURE_REASONS), ['read', 'too_large', 'budget', 'decode', 'no_cwd']);
  for (const reason of Object.values(IMAGE_FAILURE_REASONS)) {
    assert.match(reason.code, /^remote_image_[a-z_]+$/);
    assert.ok(reason.message.length > 0);
    assert.equal(typeof reason.retryable, 'boolean');
  }
  assert.equal(IMAGE_FAILURE_REASONS.read.retryable, true);
  assert.equal(IMAGE_FAILURE_REASONS.budget.retryable, true);
  assert.equal(IMAGE_FAILURE_REASONS.too_large.retryable, false);
  assert.equal(IMAGE_FAILURE_REASONS.decode.retryable, false);
  assert.equal(IMAGE_FAILURE_REASONS.no_cwd.retryable, false);
});

test('未知原因回退为读取失败', () => {
  assert.equal(imageFailureReason('missing'), IMAGE_FAILURE_REASONS.read);
});

test('读取错误按错误码归类，未知错误按读取失败', () => {
  assert.equal(imageFailureReasonFromError(Object.assign(new Error('x'), { code: 'remote_file_preview_too_large' })), 'too_large');
  assert.equal(imageFailureReasonFromError(Object.assign(new Error('x'), { code: 'remote_image_memory_full' })), 'budget');
  assert.equal(imageFailureReasonFromError(Object.assign(new Error('x'), { code: 'remote_image_invalid' })), 'decode');
  assert.equal(imageFailureReasonFromError(new Error('offline')), 'read');
  assert.equal(imageFailureReasonFromError(undefined), 'read');
});

test('文件预览错误生成完整失败对象', () => {
  const failure = previewImageFailure(Object.assign(new Error('x'), { code: 'remote_file_preview_too_large' }), 'C:\\shots\\a.png', 'a.png');
  assert.deepEqual(failure, {
    destination: 'C:\\shots\\a.png', path: 'C:\\shots\\a.png', alt: 'a.png', reason: 'too_large', retryable: false,
  });
});
