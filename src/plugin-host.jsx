import React from 'react';
import * as JSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as Cordis from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import * as Store from '@deepseek-ai/dsh-client-store';
import * as Slots from '@deepseek-ai/dsh-client-ui-slots';
import * as Primitives from '@deepseek-ai/dsh-client-ui-primitives';
import * as Dockkit from '@deepseek-ai/dsh-client-ui-dockkit';
import { LocalSettings } from './local-settings.mjs';
import { ThemePresenter } from '../../deepseek-harness/packages/client/ui-layout/src/client/theme-presenter.ts';
import { OrdinaryInput } from './ordinary-input.mjs';
import { PhonePlugins } from './phone-plugins.mjs';
import { mirrorPhoneAppearance } from './phone-appearance.mjs';
import { ordinaryNative } from './ordinary-native.mjs';
import * as OrdinaryRendering from './ordinary-rendering.jsx';
import { zh as inputZh, en as inputEn } from '../../deepseek-harness/packages/client/ui-input-trigger/src/client/locales.ts';


export async function startHost(Root, { diagnostics = false } = {}) {
try {
let host;
const ctx = new Cordis.Context();
const settings = new LocalSettings(localStorage);
ctx.provide('settingsScope', settings);
ctx.provide('remote', settings.facade());
const moduleId = '@deepseek-ai/dsh-client-modules';
const fixtureId = '@fixture/live-client';
const themeId = '@deepseek-ai/dsh-client-ui-theme';
let modules;
let artifacts;
const optionalPlugins = !diagnostics || new URLSearchParams(location.search).get('optional-plugins') !== 'off';
let fixtureEnabled = diagnostics && optionalPlugins;
let themeEnabled = optionalPlugins;
const themeLifecycle = { active: false, mounts: 0, disposals: 0, applies: 0 };
const errors = [];
let ordinaryInput;
let renderingFiber;
async function setRendering(enabled) {
  if (enabled && !renderingFiber) { renderingFiber = ctx.plugin(OrdinaryRendering); await renderingFiber.await(); }
  else if (!enabled && renderingFiber) { await renderingFiber.dispose(); renderingFiber = null; }
}
const phonePlugins = diagnostics ? null : new PhonePlugins(localStorage, (id, enabled) =>
  id === 'theme' ? setThemeModule(enabled) : id === 'rendering' ? setRendering(enabled) : ordinaryInput.enable(enabled));
if (phonePlugins) themeEnabled = phonePlugins.enabled('theme');
const appearance = phonePlugins ? mirrorPhoneAppearance(settings, phonePlugins, ordinaryNative()) : null;
if (appearance) ctx.effect(() => appearance.dispose);
window.addEventListener('error', event => { errors.push(event.message); });
window.addEventListener('unhandledrejection', event => { errors.push(String(event.reason)); });

function graph() {
  const entries = artifacts.filter(item => (fixtureEnabled || item.id !== fixtureId) && (themeEnabled || item.id !== themeId)).map(item => ({
    id: item.id, url: `${item.file}?rev=${item.revision}`, rev: item.revision,
    // 手机 composition 以真实本地设置替换 Host；原插件 bundle 不修改。
    inject: item.id.endsWith('ui-theme') ? ['@deepseek-ai/dsh-client-locale'] : [],
    immediately: true,
  }));
  return { rev: `fixture:${fixtureEnabled};theme:${themeEnabled}`, entries,
    batches: entries.map(entry => ({ phase: entry.id === moduleId ? 'bootstrap' : 'application', url: entry.url, rev: entry.rev, entries: [entry.id] })) };
}

async function setFixture(enabled) {
  fixtureEnabled = enabled;
  await modules.entries.sync(graph());
  const failures = modules.entries.state.getSnapshot().failures;
  if (failures.length) throw new Error(JSON.stringify(failures));
}

async function setThemeModule(enabled) {
  themeEnabled = enabled;
  await modules.entries.sync(graph());
  const failures = modules.entries.state.getSnapshot().failures;
  if (failures.length) throw new Error(JSON.stringify(failures));
}


  artifacts = await (await fetch('plugin-artifacts.json')).json();
  const target = window.__ModuleLoader__;
  const bootstrapIndex = target.pendingQueue.findIndex(item => item.id === moduleId);
  if (bootstrapIndex < 0) throw new Error('missing_modules_bootstrap');
  const [bootstrap] = target.pendingQueue.splice(bootstrapIndex, 1);
  const exports = bootstrap.factory(name => { throw new Error(`unexpected_bootstrap_dependency:${name}`); });
  const seed = { react: React, 'react/jsx-runtime': JSXRuntime, 'react-dom': ReactDOM, 'react-dom/client': ReactDOMClient,
    '@deepseek-ai/cordis': Cordis, '@deepseek-ai/dsh-client-store': Store,
    '@deepseek-ai/dsh-client-ui-slots': Slots, '@deepseek-ai/dsh-client-ui-primitives': Primitives,
    '@deepseek-ai/dsh-client-ui-dockkit': Dockkit };
  modules = exports.createClientModuleSystem(target, { id: moduleId, exports }, { boot: graph(), staticModules: seed });
  await ctx.plugin(Loader);
  ctx.loader.internal = modules;
  await modules.entries.start(ctx.loader, modules.manifest);
  await ctx.loader.await();
  const failures = [...ctx.loader.entries()].filter(entry => entry.fiber?.state !== 2).map(entry => entry.options.name);
  if (failures.length) throw new Error(`inactive_plugins:${failures.join(',')}`);
  // 主题的 DOM 投影随真实 theme 服务启停；根页独立存在，卸载后仍能重新加载。
  ctx.plugin({ inject: ['theme'], apply(scope) {
    const presenter = new ThemePresenter();
    themeLifecycle.active = true;
    themeLifecycle.mounts++;
    const apply = snapshot => { presenter.apply(snapshot); themeLifecycle.applies++; };
    scope.effect(() => () => {
      presenter.dispose();
      themeLifecycle.active = false;
      themeLifecycle.disposals++;
    });
    scope.on('theme/change', apply);
    apply(scope.theme.getTheme());
  } });
  ctx.plugin({ inject: ['slots', 'locale'], apply(scope) {
    // 独立诊断页不借用可卸载插件的字典，避免插件卸载影响该诊断入口。
    scope.effect(() => scope.locale.register('slash.validation', { zh: inputZh, en: inputEn }));
    ordinaryInput = new OrdinaryInput(scope);
    scope.slots.installScope('session', ordinaryInput.adapter);
    scope.slots.register({ name: 'root', children: {
      'settings.general.item': { kind: 'list', scope: 'root' },
      'plugins.row.config': { kind: 'keyed', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
      'conversation.input.overlay': { kind: 'list', scope: 'session' },
      'ordinary.message.content': { kind: 'single', scope: 'root' },
    } }, props => <Root {...props} host={host} />);
  } });
  await ctx.loader.await();
  await ordinaryInput.enable(phonePlugins ? phonePlugins.enabled('input') : true);
  if (phonePlugins) await setRendering(phonePlugins.enabled('rendering'));
  host = { ctx, settings, ordinaryInput, phonePlugins, appearance, setFixture, setThemeModule, optionalPlugins };
  ctx.uiRenderer.mount(document.getElementById('app'));
  // 只暴露验证读数和生命周期操作，不包含凭据或任意执行入口。
  if (diagnostics) window.dshmValidation = {
    snapshot: () => ({ errors: [...errors], counters: { ...document.documentElement.dataset },
      fixtureStyles: document.querySelectorAll('style[data-plugin="@fixture/live-client"]').length,
      themeStyles: document.querySelectorAll(`style[data-plugin="${themeId}"]`).length,
      themeLifecycle: { ...themeLifecycle },
      settings: settings.bind({ namespace: 'ui-theme' }).getSnapshot(),
      failures: modules.entries.state.getSnapshot().failures }),
    setFixture,
    ordinaryInput,
  };
  return host;
} catch (error) {
  document.getElementById('app').textContent = `启动失败：${String(error)}`;
  console.error(error);
}
}
