import React from 'react';

/** 仅识别官方工具包自己的插槽；第三方替换视图继续遵守作者和用户的缩放设置。 */
export function nativeToolSlot(ctx, options) {
  if (!['conversation.chat.node', 'tool.call.toolview'].includes(options.name)) return false;
  for (let fiber = ctx.fiber; fiber; ) {
    if ((fiber.entry?.options.name ?? fiber.name) === '@deepseek-ai/dsh-client-ui-tool') return true;
    const parent = fiber.parent?.fiber;
    if (parent === fiber) break;
    fiber = parent;
  }
  return false;
}

export function NativeToolFrame({ children }) {
  return <div className="remote-native-tool">{children}</div>;
}
