/**
 * 图片失败的统一原因目录：正文 Markdown、文件预览和附件缩略图共用同一组原因与错误码。
 * message 是界面文案的中文键，由 t 翻译；code 只用于展开区展示，不参与判断。
 */
export const IMAGE_FAILURE_REASONS = {
  read: {
    code: 'remote_image_read_failed',
    message: '电脑端没有返回这张图片。文件可能已被移动或删除，或当前会话没有读取该路径的权限。',
    retryable: true,
  },
  too_large: {
    code: 'remote_image_too_large',
    message: '图片超过 16 MB 上限，无法在手机上显示。',
    retryable: false,
  },
  budget: {
    code: 'remote_image_budget',
    message: '本次会话的图片缓存已满，暂时无法加载。',
    retryable: true,
  },
  decode: {
    code: 'remote_image_decode',
    message: '图片内容损坏或格式不受支持，无法解码。',
    retryable: false,
  },
  no_cwd: {
    code: 'remote_image_no_cwd',
    message: '无法确定这张图片所在的工作区，无法读取。',
    retryable: false,
  },
  denied: {
    code: 'remote_image_denied',
    message: '当前会话没有读取这张图片的权限。',
    retryable: false,
  },
};

/**
 * 读取一个原因键的完整定义。
 * @param {string | undefined} reason 原因键
 * @returns {{ code: string, message: string, retryable: boolean }} 原因定义；未知键按读取失败处理
 */
export function imageFailureReason(reason) {
  return IMAGE_FAILURE_REASONS[reason] ?? IMAGE_FAILURE_REASONS.read;
}

/**
 * 把读取过程中抛出的错误归类成原因键。
 * @param {unknown} error 读取或校验失败抛出的错误
 * @returns {string} 原因键
 */
export function imageFailureReasonFromError(error) {
  const code = error && typeof error === 'object' ? error.code ?? error.message : undefined;
  if (code === 'workspace-file/denied') return 'denied';
  if (code === 'remote_file_preview_too_large' || code === 'remote_image_too_large') return 'too_large';
  if (code === 'remote_image_memory_full' || code === 'remote_image_budget') return 'budget';
  if (code === 'remote_image_invalid' || code === 'remote_image_decode') return 'decode';
  return 'read';
}

/**
 * 由文件预览的读取错误生成失败对象。
 * @param {unknown} error 文件预览读取抛出的错误
 * @param {string} path 预览文件路径
 * @param {string} alt 图片替代文字
 * @returns {{ destination: string, path: string, alt: string, reason: string, retryable: boolean }} 失败对象
 */
export function previewImageFailure(error, path, alt = '') {
  const reason = imageFailureReasonFromError(error);
  return { destination: path, path, alt, reason, retryable: imageFailureReason(reason).retryable };
}
