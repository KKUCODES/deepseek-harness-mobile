import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { remoteSourceAliases } from './remote-source-aliases.mjs';

// 真实页面与隔离回调：核对语言切换的表单行为，不连接电脑或模拟生产鉴权。
const directory = resolve('artifacts/tests/settings-language');
await mkdir(directory, { recursive: true });
await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LocaleProvider} from './src/ui/locale.jsx';
import {RemoteComputerSettings} from './src/ui/RemoteComputerSettings.jsx';
import {RemotePluginList} from './src/ui/RemotePlugins.jsx';
import {MobilePluginLayout} from './src/mobile-plugin-layout.mjs';
import {Context} from '@deepseek-ai/cordis';
const calls=[],reads={settings:0,key:0,endpoint:0};
const settingsView={snapshot:'fixture',revision:4,writable:true,applies:'restart',fields:[
 {key:'thinking',value:'enabled',overridden:false}, {key:'reasoningEffort',value:'high',overridden:true},
 {key:'maxTokens',value:4096,overridden:true},{key:'defaultContextWindow',value:65536,overridden:false},
 {key:'streamIdleTimeoutMs',value:300000,overridden:false}]};
const endpointView={snapshot:'fixture-endpoint',revision:8,writable:true,overridden:true,origin:'https://original.example',inheritedOrigin:'https://default.example',protocol:'chat',customPath:true};
let rejectSave;
const connection={connectionState:'connected'};
const model={subscribeView:()=>()=>{},getSnapshot:()=>connection,computerSettings:{permitted:true,supported:true,
 read:async()=>{reads.settings++;return settingsView;},
 save:async(view,edits)=>{calls.push({kind:'settings',sameView:view===settingsView,edits});return new Promise((_,reject)=>{rejectSave=reject});}},
 computerKey:{supported:true,read:async()=>{reads.key++;return {configured:true,writable:true};},configure:async()=>{calls.push({kind:'key-cancel'});return {cancelled:true};}},
 computerEndpoint:{supported:true,read:async()=>{reads.endpoint++;return endpointView;},save:async(view,change)=>{calls.push({kind:'endpoint',sameView:view===endpointView,change});return endpointView;}}};
const ctx=new Context();const values=new Map();
const layout=new MobilePluginLayout(ctx,{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)});
layout.declarations.set('author-plugin',[{autoFit:false}]);
const plugins={state:'ready',entries:[{id:'author-plugin',state:'active'},{id:'手机原插件',state:'waiting',reason:'电脑当前未开放这个插件所需的远程接口。'},{id:'mobile-plugin',state:'mobile'}]};
function App(){const [language,setLanguage]=useState('en'),[tick,setTick]=useState(0);return <>
 <button onClick={()=>setLanguage(value=>value==='en'?'zh':'en')}>Switch language</button>
 <button onClick={()=>{rejectSave?.(new Error('保存结果尚未确认，请重新连接电脑并重新读取设置后核对。'));}}>Reject pending save</button>
 <button onClick={()=>{model.computerSettings.permitted=false;setTick(tick+1);}}>Revoke fixture access</button>
 <button onClick={()=>document.querySelector('[data-testid=calls]').textContent=JSON.stringify({calls,reads})}>Read calls</button><output data-testid="calls"/>
 <LocaleProvider locale={language}><RemoteComputerSettings model={model}/><RemotePluginList plugins={plugins} layout={layout}/></LocaleProvider></>}
createRoot(document.getElementById('app')).render(<App/>);` }, outfile: resolve(directory,'test.js'), bundle:true, format:'esm', platform:'browser', logLevel:'silent',
  alias:{...remoteSourceAliases(process.cwd()),'@upstream':resolve('../deepseek-harness/packages/client')}, nodePaths:[resolve('node_modules')], loader:{'.module.css':'local-css','.svg':'file','.woff2':'file','.woff':'file','.ttf':'file'}, define:{'process.env.NODE_ENV':'"production"'} });
const server=createServer(async(req,res)=>{
  if(req.url==='/test.js') return res.setHeader('Content-Type','text/javascript').end(await readFile(resolve(directory,'test.js')));
  res.setHeader('Content-Type','text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={source:'Production computer-settings and plugin UI with isolated services; real MobilePluginLayout and URL schema',checks:[]};
try {
  const page=await browser.newPage();page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  const state=async()=>{await page.getByRole('button',{name:'Read calls',exact:true}).click();return JSON.parse(await page.getByTestId('calls').innerText());};
  const switchLanguage=()=>page.getByRole('button',{name:'Switch language',exact:true}).click();
  await page.getByRole('combobox',{name:'Allow thinking',exact:true}).selectOption('disabled');
  await page.getByRole('spinbutton',{name:'Output timeout (milliseconds)',exact:true}).fill('301000');
  await page.locator('.remote-computer-setting').filter({has:page.getByRole('spinbutton',{name:'Reply limit (tokens)',exact:true})}).getByRole('button',{name:'Restore defaults',exact:true}).click();
  const url='http://example.test/v1/model';
  await page.getByRole('textbox',{name:'Complete new endpoint URL',exact:true}).fill(url);
  await switchLanguage();
  assert.equal(await page.getByRole('combobox',{name:'允许深度思考',exact:true}).inputValue(),'disabled');
  assert.equal(await page.getByRole('spinbutton',{name:'等待输出超时（毫秒）',exact:true}).inputValue(),'301000');
  await page.getByText('保存后恢复电脑默认值',{exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'新的完整服务地址',exact:true}).inputValue(),url);
  assert.deepEqual(await state(),{calls:[],reads:{settings:1,key:1,endpoint:1}});
  report.checks.push('Language preserves numeric/enum/unset drafts and endpoint URL; no extra reads or writes');
  await page.getByRole('button',{name:'核对新地址',exact:true}).click();
  await switchLanguage();
  const confirm=page.getByRole('group',{name:'Confirm endpoint',exact:true});
  await confirm.getByText(url,{exact:true}).waitFor();
  await confirm.getByText('http://example.test',{exact:true}).waitFor();
  await confirm.getByText('This address uses HTTP. Traffic is not encrypted.',{exact:true}).waitFor();
  await confirm.getByRole('button',{name:'Cancel endpoint change',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Complete new endpoint URL',exact:true}).inputValue(),url);
  assert.deepEqual((await state()).calls,[]);
  await page.getByRole('button',{name:'Restore default endpoint',exact:true}).click();
  await switchLanguage();
  await page.getByRole('group',{name:'确认服务地址',exact:true}).getByText('https://default.example',{exact:true}).waitFor();
  await page.getByRole('button',{name:'取消更改地址',exact:true}).click();
  await page.getByRole('textbox',{name:'新的完整服务地址',exact:true}).fill('https://example.test/?secret=invalid');
  await page.getByRole('button',{name:'核对新地址',exact:true}).click();
  await switchLanguage();
  await page.getByRole('status').filter({hasText:'Enter an HTTP or HTTPS URL without a username, password, query or fragment.'}).waitFor();
  assert.equal(await page.getByRole('group',{name:'Confirm endpoint',exact:true}).count(),0);
  report.checks.push('Endpoint set/reset review survives language; raw origin/path and HTTP warning retained; cancel does not save; invalid URL rejected');
  await page.getByRole('button',{name:'Manage computer Key',exact:true}).click();
  await page.getByRole('region',{name:'Computer DeepSeek Key',exact:true}).getByText('Configured',{exact:true}).waitFor();
  assert.deepEqual((await state()).calls,[{kind:'key-cancel'}]);
  assert.equal(await page.getByText('Computer Key operation completed.',{exact:true}).count(),0);
  report.checks.push('Canceled native-Key callback only rereads status, does not report saved or expose any credential');
  const plugin=page.locator('[data-plugin-id="author-plugin"]');
  assert.equal(await plugin.getByRole('switch').getAttribute('aria-checked'),'false');
  await plugin.getByRole('switch',{name:'author-plugin auto-fit',exact:true}).click();
  await switchLanguage();
  assert.equal(await plugin.getByRole('switch',{name:'author-plugin 自适应',exact:true}).getAttribute('aria-checked'),'true');
  await plugin.getByRole('button',{name:'恢复插件默认',exact:true}).click();
  assert.equal(await plugin.getByRole('switch').getAttribute('aria-checked'),'false');
  await page.getByText('手机原插件',{exact:true}).waitFor();
  report.checks.push('Production plugin layout keeps user override across language, restores author default, leaves plugin identifier unchanged');
  await page.getByRole('button',{name:'保存到电脑',exact:true}).click();
  await switchLanguage();
  assert.ok(await page.getByRole('button',{name:'Save to computer',exact:true}).isDisabled());
  const saved=await state();
  assert.deepEqual(saved.calls,[{kind:'key-cancel'},{kind:'settings',sameView:true,edits:[{op:'set',key:'thinking',value:'disabled'},{op:'set',key:'streamIdleTimeoutMs',value:301000},{op:'unset',key:'maxTokens'}]}]);
  assert.deepEqual(saved.reads,{settings:1,key:2,endpoint:1});
  await page.getByRole('button',{name:'Reject pending save',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Save result is unconfirmed.'}).waitFor();
  await switchLanguage();
  await page.getByRole('status').filter({hasText:'保存结果尚未确认'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'保存到电脑',exact:true}).count(),0);
  assert.deepEqual((await state()).calls,saved.calls);
  report.checks.push('Single original snapshot/enum/numeric/unset payload preserved; busy stays locked; uncertain result translates without retry');
  await page.getByRole('button',{name:'Revoke fixture access',exact:true}).click();
  await switchLanguage();
  await page.getByText('Grant this device management access on the computer before viewing or changing its settings.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Manage computer Key',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  report.checks.push('Management permission boundary still hides settings/Key/endpoint controls');
} catch(error){report.failure=error.message;process.exitCode=1;}
finally {await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile('artifacts/settings-language-components.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
