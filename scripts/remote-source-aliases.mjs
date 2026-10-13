import { resolve } from 'node:path';
import { remoteDocumentSources } from './remote-document-sources.mjs';
import { remoteConversationSources } from './remote-conversation-sources.mjs';
import { remoteDesktopAppSources } from './remote-desktop-app-sources.mjs';

// 显式借用纯客户端/值模块，避免将 Host 服务入口带进手机包。
export function remoteSourceAliases(root, options = {}) {
  const source = path => resolve(options.upstream ?? resolve(root, '../deepseek-harness'), 'packages', path);
  return {
    '@dshm/settings-components': resolve(root, options.nativeNavigation ? 'src/remote-settings-components-latest.jsx' : 'src/remote-settings-components.jsx'),
    '@dshm/config-forms': resolve(root, options.nativeNavigation ? 'src/remote-config-forms-latest.mjs' : 'src/remote-config-forms.mjs'),
    '@dshm/chat-presentation': resolve(root, options.version === '0.2.1-alpha.2' ? 'src/remote-chat-presentation-alpha2.jsx'
      : options.nativeNavigation ? 'src/remote-chat-presentation-latest.jsx' : 'src/remote-chat-presentation.jsx'),
    '@dshm/office-face': resolve(root, options.nativeNavigation ? 'src/remote-office-face-latest.mjs' : 'src/remote-office-face.mjs'),
    '@dshm/review-diff': source('client/ui-deliverables/src/client/' + (options.nativeNavigation ? 'FileDiff.tsx' : 'ReviewTab.tsx')),
    ...remoteDocumentSources(root, options),
    ...remoteConversationSources(root, options),
    ...remoteDesktopAppSources(root, options),
    '@deepseek-ai/dsh-agent-presets/display': source(options.nativeNavigation ? 'preset/agent-preset-registry/src/display.ts' : 'preset/agent-presets/src/display.ts'),
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
