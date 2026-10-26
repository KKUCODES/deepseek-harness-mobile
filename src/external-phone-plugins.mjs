import React from 'react';
import { MOBILE_INTERFACE_API, REMOTE_HOME_SLOT } from './phone-plugin-catalog.mjs';

/** 只接受本机安装器登记的内容地址；配对消息和插件自身不能提供加载URL。 */
export function externalPhonePlugins(entries = []) {
  if (!Array.isArray(entries) || entries.length > 32) throw Error('invalid_plugin_catalog');
  return entries.map(entry => {
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]{0,127}$/.test(entry.id)
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.apiVersion !== MOBILE_INTERFACE_API
      || entry.surface !== REMOTE_HOME_SLOT || typeof entry.name !== 'string' || typeof entry.version !== 'string') throw Error('invalid_plugin_catalog');
    return { ...entry, host: 'remote', group: REMOTE_HOME_SLOT, external: true, source: entry.id,
      capabilities: 'Remote 首页界面', load: async () => {
        if (!entry.available) throw Error('missing');
        const module = await import(/* @vite-ignore */ new URL(`/phone-plugins/${entry.sha256}.js`, globalThis.location.origin).href);
        if (typeof module.default !== 'function') throw Error('incompatible');
        return module.default(Object.freeze({ apiVersion: MOBILE_INTERFACE_API, React }));
      } };
  });
}
