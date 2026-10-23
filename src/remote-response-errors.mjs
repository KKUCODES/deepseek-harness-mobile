/** 保留底层错误码供重连判断；只在界面展示处转成可操作的提示。 */
export const responseFailures = Object.freeze({
  response_chunks_unavailable: '当前连接暂不支持大响应，请更新 App、电脑插件和中转服务后重新连接。',
  response_too_large: '这份内容超过当前连接的大小限制，请更新 App、电脑插件和中转服务后重试。',
  response_chunk_timeout: '大响应传输已超时，请检查连接后重新打开聊天。',
  response_buffer_limit: '正在接收的内容较多，请稍后重新打开聊天。',
  response_chunk_corrupt: '接收内容校验失败，请重新打开聊天。',
  invalid_response_chunk: '接收内容校验失败，请重新打开聊天。',
  incomplete_response_chunk: '接收内容校验失败，请重新打开聊天。',
  invalid_response_ack: '接收内容校验失败，请重新打开聊天。',
});
