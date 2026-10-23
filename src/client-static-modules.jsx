import React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as Cordis from '@deepseek-ai/cordis';
import * as Zod from 'zod';
import * as ReactVirtual from '@tanstack/react-virtual';
import * as Store from '@deepseek-ai/dsh-client-store';
import * as Slots from '@deepseek-ai/dsh-client-ui-slots';
import * as Primitives from '@deepseek-ai/dsh-client-ui-primitives';
import * as Dockkit from '@deepseek-ai/dsh-client-ui-dockkit';

// 普通聊天、Remote和诊断入口共享官方平台单例，避免某入口漏注册新版基础依赖。
export const clientStaticModules = {
  react: React, 'react/jsx-runtime': JSXRuntime, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient,
  '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-store': Store,
  zod: Zod, '@tanstack/react-virtual': ReactVirtual,
  '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-ui-primitives': Primitives,
  '@deepseek-ai/dsh-client-ui-dockkit': Dockkit,
};
