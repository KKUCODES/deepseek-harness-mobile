import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { latestMobileBuild } from './latest-mobile-build.mjs';
import { remoteSourceAliases } from './remote-source-aliases.mjs';
import { mobileApprovalAccessibility } from './mobile-approval-accessibility.mjs';
import { checkRemoteBackNavigation } from './check-remote-back-navigation.mjs';
import { LocalPluginBackend } from '../src/phone-plugin-records.mjs';
import { checkPhoneHomeTheme } from './check-phone-home-theme.mjs';

const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'artifacts/tests/mobile-interface');
const require = createRequire(import.meta.url);
const sdk = latestMobileBuild(root, { officialOnly: true, officialVersion: process.argv.includes('--alpha2') ? '0.2.1-alpha.2' : '0.2.1-rc.2' });
await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, stdin: { contents: `
import './tests/fixtures/phone-home-catalog.mjs';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PhonePluginsPage} from './src/ui/PhonePlugins.jsx';
import {phonePluginsFor} from './src/phone-plugins.mjs';
import {PHONE_PLUGIN_CATALOG,pluginDescriptor} from './src/phone-plugin-catalog.mjs';
import {mobileInterfaceCatalog} from './src/mobile-interface-plugins.mjs';
import {LocaleProvider} from './src/ui/locale.jsx';
import {model} from './tests/fixtures/remote-plugin-slots.jsx';
import {watchPhoneAppearance} from './src/phone-appearance.mjs';
import {ThemePresenter} from '../deepseek-harness/packages/client/ui-layout/src/client/theme-presenter.ts';
import '@upstream/ui-theme/src/styles/base.css'; import '@upstream/ui-theme/src/styles/design-platform.css';
import '@upstream/ui-theme/src/styles/gradient-shadow-text.css'; import '@upstream/ui-theme/src/styles/corner-shape.css';
window.interfaceProbe = {model, React, mounts:0, unmounts:0, slotErrors:[]};
const appearanceEvents=new EventTarget(),phoneMedia=Object.assign(new EventTarget(),{matches:false});
let appearanceValue={preference:'light',fontSize:14,enabled:true,language:'zh'};
watchPhoneAppearance({call:async()=>appearanceValue},new ThemePresenter(),{events:appearanceEvents,media:phoneMedia});
window.interfaceProbe.appearance=(preference,systemDark)=>{phoneMedia.matches=systemDark;appearanceValue={...appearanceValue,preference};appearanceEvents.dispatchEvent(new Event('dshm-appearance-change'));};
const management=document.createElement('div');management.id='phone-plugin-page';management.style.cssText='position:fixed;inset:0;z-index:9999;background:white;display:none';document.body.append(management);
const managementRoot=createRoot(management),phonePlugins=phonePluginsFor('remote');
window.interfaceProbe.openManagement=()=>{management.style.display='block';managementRoot.render(<LocaleProvider locale="zh-CN"><PhonePluginsPage host={{phonePlugins,ordinaryInput:{promptSettings:{getSnapshot:()=>({value:{prompts:[]}})}}}} registerBack={()=>()=>{}} onBack={()=>management.style.display='none'} onRemote={()=>{}}/></LocaleProvider>);};
window.interfaceProbe.closeManagement=()=>{management.style.display='none';managementRoot.render(null);};
model.ctx.slots.onEntryError((slot,entry,error)=>window.interfaceProbe.slotErrors.push({slot,message:error.message}));
window.interfaceProbe.addAlternate=async()=>{const entry={id:'@example/another-home',name:'通用替代首页',description:'通用替代首页',capabilities:'Remote 首页界面',host:'remote',group:'dshm.remote.home',version:'0.1.0',apiVersion:1,
load:async()=>({name:'@example/another-home',inject:['slots'],mobileInterface:{apiVersion:1,surface:'dshm.remote.home'},apply(ctx){ctx.slots.register({name:'dshm.remote.home'},({home})=>{
window.interfaceProbe.publicKeys=Object.keys(home);
return <section data-testid="alternate-home"><button onClick={home.actions.menu}>{home.t('Remote 选项')}</button><p>{home.view.title}</p></section>;
});}})};mobileInterfaceCatalog.push(entry);PHONE_PLUGIN_CATALOG.push(entry);await phonePlugins.call('plugins.initialize',{entries:[{entry:pluginDescriptor(entry),installed:true,enabled:false}]});};
`, resolveDir: root, loader: 'jsx' }, outdir: output, entryNames: 'test', chunkNames: 'chunks/[name]-[hash]', splitting: true,
bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
plugins: [{ name: 'interface-lifecycle-probe', setup(builder) {
  builder.onLoad({ filter: /packages[\\/]remote-home-design[\\/]index\.jsx$/ }, async ({path}) => ({ loader: 'jsx', contents: (await readFile(path, 'utf8')).replace('const { view, actions, t, locale } = home;', `
React.useEffect(() => { window.interfaceProbe.mounts++; return () => window.interfaceProbe.unmounts++; }, []);
window.interfaceProbe.home=home;
if (window.__interfaceFailure) throw Error('InterfaceProbeFailure');
const { view, actions, t, locale } = home;`) }));
} }, sdk.resolver, mobileApprovalAccessibility()],
loader: { '.module.css': 'local-css', '.svg':'file', '.png':'file', '.woff2':'file', '.woff':'file', '.ttf':'file' },
nodePaths: [resolve(sdk.runtime, 'node_modules'), resolve(root, 'node_modules')],
alias: { ...remoteSourceAliases(root,sdk), '@upstream':resolve(root,'../deepseek-harness/packages/client'), react:dirname(require.resolve('react/package.json')),
'node:module':resolve(root,'../deepseek-harness/apps/web/src/node-module-stub.ts'), '@deepseek-ai/cordis':require.resolve('@deepseek-ai/cordis'),
'@deepseek-ai/dsh-client-store':require.resolve('@deepseek-ai/dsh-client-store'), '@deepseek-ai/dsh-client-ui-slots':require.resolve('@deepseek-ai/dsh-client-ui-slots'),
'@deepseek-ai/dsh-client-ui-primitives':require.resolve('@deepseek-ai/dsh-client-ui-primitives'), '@deepseek-ai/dsh-util-values':resolve(root,'../deepseek-harness/packages/util/values/src/index.ts'),
'@deepseek-ai/dsh-file-reference/grammar':resolve(root,'../deepseek-harness/packages/context/file-reference/src/grammar.ts'), ...sdk.alias },
define:{ DSHM_MOBILE_SDK_VERSION:JSON.stringify(sdk.version), 'process.env.NODE_ENV':'"production"', 'process.versions.node':'"0.0.0"', 'process.execArgv':'[]', 'process.env.CORDIS_SHARED':'undefined' } });
const server = createServer(async (req,res) => {
  if (req.url === '/') return res.setHeader('Content-Type','text/html').end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if (/^\/(?:chunks\/)?[A-Za-z0-9_.@~-]+\.(js|css|svg|png|woff2?|ttf)$/.test(req.url)) {
    try { return res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':req.url.endsWith('.svg')?'image/svg+xml':'application/octet-stream').end(await readFile(resolve(output,req.url.slice(1)))); } catch {}
  }
  res.writeHead(404).end();
});
server.listen(0,'127.0.0.1'); await once(server,'listening');
const browser = await chromium.launch({channel:'msedge',headless:true});
const report = { sdk:sdk.version, source:'Production Cordis/slot registry/RemoteModel/Workspace and separately loaded interface chunk; protocol replay, not live desktop or APK', cases:[], errors:[] };
try {
  const page = await browser.newPage({viewport:{width:390,height:844}}); page.setDefaultTimeout(10000);
  // 浏览器没有原生桥：仅在测试注入同协议后端，实际APK另验跨来源共享。
  await page.addInitScript({content:`window.__testPluginBackend=new (${LocalPluginBackend.toString()})(localStorage,'probe.mobile-plugins.v2');window.DSHMMobilePlugins=window.__testPluginBackend.bridge('remote');`});
  const requests=[]; page.on('request',request=>requests.push(request.url()));
  page.on('pageerror',error=>{ if(!error.message.includes('InterfaceProbeFailure')) report.errors.push(error.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for(const file of ['src/ui/mobile.css','src/ui/ordinary-product.css','docs/design/ordinary-preview/remote.css','src/ui/remote-product.css']) await page.addStyleTag({path:resolve(root,file)});
  await page.waitForFunction(()=>!!window.interfaceProbe && !!window.fixture);
  await page.evaluate(()=>{window.fixture.backNavigationProject(); return window.fixture.select(null);});
  const main=page.getByTestId('remote-workspace'), redesigned=page.getByTestId('remote-home-plugin'), fallback=page.getByTestId('remote-home-default');
  await redesigned.waitFor();
  assert.ok(requests.some(url=>/chunks\/remote-home-design-/.test(url)),'实际通过独立动态chunk加载');
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.ctx.slots.entries('dshm.remote.home').length),1);
  report.cases.push('independent ESM chunk + actual Cordis slot registration');
  await main.getByRole('button',{name:'Remote 选项',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'手机界面',exact:true}).count(),0);
  await page.evaluate(()=>window.dshmHandleBack());
  const choose=async name=>{
    await page.evaluate(()=>window.interfaceProbe.openManagement());
    const manager=page.locator('#phone-plugin-page');
    await manager.locator('.plugin-list').waitFor();
    assert.equal(await manager.locator('.plugin-list').count(),1,'全部手机插件共用同一列表间距');
    const current=await page.evaluate(()=>window.interfaceProbe.model.interfacePlugins.getSnapshot().selected);
    const label=name==='默认首页'?await page.evaluate(id=>window.interfaceProbe.model.interfacePlugins.entries().find(e=>e.id===id)?.name,current):name;
    await manager.getByRole('button',{name:label}).click();
    const toggle=manager.getByRole('switch');
    const retry=manager.getByRole('button',{name:'重试',exact:true});
    if(name!=='默认首页'&&await retry.count())await retry.click();else await toggle.setChecked(name!=='默认首页');
    await page.waitForFunction(id=>window.interfaceProbe.model.interfacePlugins.getSnapshot().selected===id,name==='默认首页'?null:(await manager.locator('code').innerText()));
    await page.evaluate(()=>window.interfaceProbe.closeManagement());
  };
  await main.getByRole('button',{name:'返回验证项目',exact:true}).click();
  await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).fill('one');
  await page.evaluate(()=>window.interfaceProbe.openManagement());
  const manager=page.locator('#phone-plugin-page');
  await manager.getByRole('button',{name:/Remote 新版首页/}).click();
  await manager.getByRole('status').filter({hasText:'运行中'}).waitFor();
  await manager.getByRole('button',{name:'卸载',exact:true}).click();
  await page.getByRole('button',{name:'确认卸载',exact:true}).click();
  await fallback.waitFor();
  await manager.getByRole('button',{name:'返回',exact:true}).click();
  assert.equal(await manager.getByRole('button',{name:/Remote 新版首页/}).count(),0,'卸载从已安装列表移除');
  await manager.getByRole('button',{name:'安装插件',exact:true}).click();
  await manager.getByRole('button',{name:/Remote 新版首页/}).click();
  await manager.getByRole('status').filter({hasText:'未安装'}).waitFor();
  await manager.getByRole('button',{name:'安装',exact:true}).click();
  await manager.getByRole('status').filter({hasText:'运行中'}).waitFor();
  await page.evaluate(()=>window.interfaceProbe.closeManagement());
  await redesigned.waitFor();
  assert.equal(await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).inputValue(),'one');
  report.cases.push('actual unified plugin page uninstall/remove/catalog/reinstall; runtime confirmed and home/query retained');
  await choose('默认首页'); await fallback.waitFor();
  assert.equal(await page.locator('.dshm-home-plugin').count(),0);
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.ctx.slots.entries('dshm.remote.home').length),0);
  assert.equal(await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).inputValue(),'one');
  assert.equal(await main.getByRole('heading',{name:'返回验证项目',exact:true}).count(),0); // 默认标题保留发布版 strong 排版。
  assert.equal(await main.locator('.remote-heading').innerText(),'返回验证项目');
  await choose(/Remote 新版首页/); await redesigned.waitFor();
  assert.equal(await main.getByRole('heading',{name:'返回验证项目',exact:true}).count(),1);
  assert.equal(await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).inputValue(),'one');
  report.cases.push('UI toggle releases registration/style; project + query retained');
  const counts=()=>page.evaluate(()=>({mounts:window.interfaceProbe.mounts,unmounts:window.interfaceProbe.unmounts}));
  const before=await counts();
  await page.evaluate(()=>window.fixture.connectionState('disconnected'));
  await main.getByTestId('remote-offline-status').waitFor();
  assert.equal(await main.getByRole('button',{name:'在已有工作区新建聊天',exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.fixture.connectionState('connected'));
  await main.getByTestId('remote-offline-status').waitFor({state:'detached'});
  assert.deepEqual(await counts(),before,'断线不重挂首页插件');
  assert.equal(await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).inputValue(),'one');
  const generation=await page.evaluate(()=>window.interfaceProbe.model.connection.generation.getSnapshot()?.id);
  await page.evaluate(()=>window.interfaceProbe.model.connection.reconnect());
  await page.waitForFunction(old=>{const m=window.interfaceProbe.model;return m.getSnapshot().connectionState==='connected' && m.connection.generation.getSnapshot()?.id!==old;},generation);
  assert.deepEqual(await counts(),before,'真实核心连接世代更新也不重挂首页');
  report.cases.push('rendered offline state + real core generation reconnect; same plugin instance/query');
  await main.getByRole('textbox',{name:'搜索远程聊天',exact:true}).fill('');
  await main.locator('[data-remote-home-session]').filter({hasText:'one'}).click();
  const input=main.getByRole('textbox',{name:'消息',exact:true});await input.fill('interface state draft');
  const reference=await page.evaluate(()=>{window.__interfaceReference=window.interfaceProbe.model.reference;return !!window.__interfaceReference;}); assert.equal(reference,true);
  await choose('默认首页');assert.equal(await input.innerText(),'interface state draft');
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.reference===window.__interfaceReference),true);
  await choose(/Remote 新版首页/);assert.equal(await input.innerText(),'interface state draft');
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.reference===window.__interfaceReference),true);
  await page.evaluate(()=>window.dshmHandleBack());await redesigned.waitFor();
  report.cases.push('toggle from active chat preserves same session reference + draft');
  // 独立建立足够长的列表；不依赖前一用例中已被电脑重连移除的临时项目。
  await page.reload();
  for(const file of ['src/ui/mobile.css','docs/design/ordinary-preview/remote.css','src/ui/remote-product.css']) await page.addStyleTag({path:resolve(root,file)});
  await page.waitForFunction(()=>!!window.interfaceProbe);await page.evaluate(()=>window.fixture.select(null));await redesigned.waitFor();
  // 验证两种首页的宿主阅读记忆；模拟投影只增加列表，不伪造模型回复。
  await page.evaluate(()=>{const m=window.interfaceProbe.model;window.__homeList=m.sessions.list.getSnapshot();const list=window.__homeList;const extra=Array.from({length:35},(_,i)=>({...list.byId.one,id:'scroll-'+i,displayTitle:'Scroll '+i,updatedAt:10,blank:false}));m.sessions.list.set({...list,ids:[...list.ids,...extra.map(x=>x.id)],byId:{...list.byId,...Object.fromEntries(extra.map(x=>[x.id,x]))}});});
  try { await page.waitForFunction(()=>document.querySelectorAll('[data-remote-home-session]').length>=35); }
  catch(error) { report.scrollDebug=await page.evaluate(()=>({body:document.body.innerText,slotErrors:window.interfaceProbe.slotErrors,selected:window.interfaceProbe.model.getSnapshot().selected,ids:window.interfaceProbe.model.getSnapshot().list.ids.length,query:document.querySelector('input')?.value,home:!!document.querySelector('.dshm-home-plugin')}));throw error; }
  const scrolling=redesigned.locator('.dhp-scroll'); await scrolling.evaluate(e=>{e.scrollTop=140;e.dispatchEvent(new Event('scroll',{bubbles:true}));});
  assert.equal(await scrolling.evaluate(e=>e.scrollTop),140);
  report.readingBefore=await page.evaluate(()=>({saved:window.interfaceProbe.home.actions.readScroll(),key:window.interfaceProbe.home.view.key}));
  await choose('默认首页');await fallback.waitFor();
  report.readingAfter=await fallback.locator('.remote-scroll').evaluate(e=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight,rows:e.querySelectorAll('.remote-session-row').length,text:e.innerText.slice(0,100),overflow:getComputedStyle(e).overflowY,saved:window.interfaceProbe.home.actions.readScroll(),key:window.interfaceProbe.home.view.key}));
  assert.equal(await fallback.locator('.remote-scroll').evaluate(e=>e.scrollTop),140);
  await choose(/Remote 新版首页/);await redesigned.waitFor();assert.equal(await redesigned.locator('.dhp-scroll').evaluate(e=>e.scrollTop),140);
  await page.evaluate(()=>window.interfaceProbe.model.sessions.list.set(window.__homeList));
  report.cases.push('scroll position retained across default/plugin switch');
  report.themeCases=await checkPhoneHomeTheme(page,choose);
  for(const width of [320,390]) for(const dark of [false,true]) {
    await page.setViewportSize({width,height:844});await page.evaluate(value=>document.body.toggleAttribute('data-ds-dark-theme',value),dark);
    assert.equal(await redesigned.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.screenshot({path:resolve(output,`home-${sdk.version}-${width}-${dark?'dark':'light'}.png`)});
  }
  await page.evaluate(()=>document.body.removeAttribute('data-ds-dark-theme'));
  report.cases.push('scoped style and shared theme; 320/390 light/dark');
  await page.evaluate(()=>{window.__interfaceFailure=true;window.interfaceProbe.model.publish({error:null});});
  await fallback.waitFor();
  await page.waitForFunction(()=>window.interfaceProbe.model.interfacePlugins.getSnapshot().status==='failed');
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.ctx.slots.entries('dshm.remote.home').length),0);
  await page.evaluate(()=>{window.__interfaceFailure=false;});await choose(/Remote 新版首页/);await redesigned.waitFor();
  report.cases.push('actual slot render fault abdicates/unloads; default usable; explicit retry works');
  await page.evaluate(()=>window.interfaceProbe.addAlternate());
  await choose(/通用替代首页/);await page.getByTestId('alternate-home').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.interfaceProbe.publicKeys.sort()),['actions','apiVersion','locale','t','view']);
  await choose(/Remote 新版首页/);await redesigned.waitFor();
  report.cases.push('another module uses same public API without plugin-name branches');
  await page.evaluate(async()=>{
    window.fixture.settingsGrant(true);
    await window.interfaceProbe.model.ctx.plugin({name:'@example/focus-probe',inject:['slots'],apply(ctx){ctx.slots.inject('settings.plugins.tab',()=>ctx.slots.register({name:'settings.plugins.tab',id:'focus-probe',label:'独立焦点插件',order:-20},()=>window.interfaceProbe.React.createElement('button',{className:'interface-focus-probe'},'独立按钮')));}}).await();
  });
  await page.addStyleTag({content:'.interface-focus-probe:focus-visible{outline:5px dashed rgb(255,0,128);outline-offset:7px}'});
  await main.getByRole('button',{name:'Remote 选项',exact:true}).click();await page.getByRole('button',{name:'电脑插件',exact:true}).click();await page.getByRole('button',{name:'插件设置',exact:true}).click();
  await page.getByRole('tab',{name:'独立焦点插件',exact:true}).click();await page.keyboard.press('Tab');await page.getByRole('button',{name:'独立按钮',exact:true}).focus();
  assert.equal(await page.getByRole('button',{name:'独立按钮',exact:true}).evaluate(e=>getComputedStyle(e).outlineWidth),'5px');
  await page.evaluate(()=>window.dshmHandleBack());await page.getByRole('button',{name:'独立按钮',exact:true}).waitFor({state:'hidden'});
  report.cases.push('other plugin focus styling remains isolated through real settings entry');
  await choose('默认首页');await fallback.waitFor();
  await page.reload();for(const file of ['src/ui/mobile.css','docs/design/ordinary-preview/remote.css','src/ui/remote-product.css'])await page.addStyleTag({path:resolve(root,file)});
  await page.waitForFunction(()=>!!window.interfaceProbe); await page.evaluate(()=>window.fixture.select(null));await fallback.waitFor();
  assert.equal(await page.evaluate(()=>window.interfaceProbe.model.interfacePlugins.getSnapshot().selected),null);
  await choose(/Remote 新版首页/);await redesigned.waitFor();
  report.cases.push('saved interface selection restored after page reload');
  report.backNavigation=await checkRemoteBackNavigation(page);
  await choose('默认首页');await page.reload();
  for(const file of ['src/ui/mobile.css','docs/design/ordinary-preview/remote.css','src/ui/remote-product.css'])await page.addStyleTag({path:resolve(root,file)});
  report.defaultBackNavigation=await checkRemoteBackNavigation(page);
  assert.deepEqual(report.errors,[]);
} catch(error) { report.failure=error.stack;process.exitCode=1; }
finally { await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(resolve(output,`report-${sdk.version}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report)); }
