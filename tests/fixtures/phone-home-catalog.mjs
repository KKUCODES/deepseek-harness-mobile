import { PHONE_PLUGIN_CATALOG } from '../../src/phone-plugin-catalog.mjs';

// 原生命周期/回放测试显式提供测试目录；生产APK目录不再引用这个实现。
PHONE_PLUGIN_CATALOG.push({ id: '@dshm/remote-home-design', name: 'Remote 新版首页', version: '0.1.0', host: 'remote', group: 'dshm.remote.home',
  apiVersion: 1, description: '首页测试夹具', capabilities: 'Remote 首页界面', load: () => import('../../packages/remote-home-design/index.jsx') });
