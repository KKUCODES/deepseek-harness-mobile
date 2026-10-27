import React from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteApp } from '../../src/RemoteApp.jsx';
import { PHONE_PLUGIN_CATALOG } from '../../src/phone-plugin-catalog.mjs';
import { phonePluginsFor } from '../../src/phone-plugins.mjs';
import { PhonePluginsPage } from '../../src/ui/PhonePlugins.jsx';
import { LocaleProvider } from '../../src/ui/locale.jsx';
import * as design from '../../packages/remote-home-design/index.jsx';

const entry = (id, name, load, defaultEnabled = false) => ({ id, name, version: '1.0.0', description: name, source: id, capabilities: 'Remote 首页界面', host: 'remote', group: 'dshm.remote.home', apiVersion: 1, load, defaultEnabled });
PHONE_PLUGIN_CATALOG.push(entry(design.name, 'Remote 新版首页', async () => ({ ...design, apply(ctx) { window.connectionProbe.activations++; design.apply(ctx); } }), true));
PHONE_PLUGIN_CATALOG.push(entry('@example/connection', '另一款连接界面', async () => ({
  name: '@example/connection', inject: ['slots'], mobileInterface: { apiVersion: 1, surface: 'dshm.remote.home' },
  apply(ctx) { ctx.slots.register({ name: 'dshm.remote.connection' }, ({ connection }) => {
    window.connectionProbe.owner = connection;
    if (window.connectionProbe.failRender) throw Error('connection-render-fixture');
    return <div data-testid="alternative-connection"><h1>{connection.view.title}</h1>{connection.parts.fields}<button onClick={connection.actions.primary}>继续</button></div>;
  }); },
})));
PHONE_PLUGIN_CATALOG.push(entry('@example/legacy-home', '仅首页的旧插件', async () => ({ name: '@example/legacy-home', inject: ['slots'], mobileInterface: { apiVersion: 1, surface: 'dshm.remote.home' }, apply(ctx) { ctx.slots.register({ name: 'dshm.remote.home' }, () => <p>LEGACY_HOME</p>); } })));
PHONE_PLUGIN_CATALOG.push(entry('@example/broken-interface', '无法加载的界面', async () => { throw Error('connection-load-fixture'); }));
const registry = phonePluginsFor('remote'), management = document.createElement('div');
management.id = 'connection-management'; document.body.append(management); const manager = createRoot(management);
window.connectionProbe = {
  registry, failRender: false, activations: 0,
  open() { management.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;overflow:auto'; manager.render(<LocaleProvider locale="zh"><PhonePluginsPage host={{ phonePlugins: registry }} registerBack={() => () => {}} onBack={() => {}} onRemote={() => {}}/></LocaleProvider>); },
  close() { manager.render(null); management.style.display = 'none'; },
  async fail() { this.failRender = true; await registry.change('@example/connection', 'retry'); },
};
createRoot(document.getElementById('app')).render(<RemoteApp/>);
