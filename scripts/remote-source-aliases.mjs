import { resolve } from 'node:path';
import { remoteDocumentSources } from './remote-document-sources.mjs';
import { remoteConversationSources } from './remote-conversation-sources.mjs';
import { remoteDesktopAppSources } from './remote-desktop-app-sources.mjs';

// 显式借用纯客户端/值模块，避免将 Host 服务入口带进手机包。
export function remoteSourceAliases(root) {
  const source = path => resolve(root, '../deepseek-harness/packages', path);
  return {
    ...remoteDocumentSources(root),
    ...remoteConversationSources(root),
    ...remoteDesktopAppSources(root),
    '@deepseek-ai/dsh-agent-presets/display': source('preset/agent-presets/src/display.ts'),
    '@deepseek-ai/dsh-typert-protocol': source('typert/protocol/src/index.ts'),
    '@deepseek-ai/dsh-api-gateway/client': source('api/gateway/src/client/index.ts'),
    '@deepseek-ai/dsh-session/types': source('core/session/src/types.ts'),
    '@deepseek-ai/dsh-session/surface': source('core/session/src/surface.ts'),
    '@deepseek-ai/dsh-util-workspace-path': source('util/workspace-path/src/index.ts'),
    '@deepseek-ai/dsh-util-crypto': source('util/crypto/src/index.ts'),
    '@deepseek-ai/dsh-deque': source('util/deque/src/index.ts'),
    '@deepseek-ai/dsh-llm/assistant-stream': source('llm/llm/src/assistant-stream.ts'),
  };
}
