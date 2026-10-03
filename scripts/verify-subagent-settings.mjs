import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';

// 原 Subagent 卡片、控制器与真实协议校验；隔离传输只验证交互，不替代电脑写入验收。
const directory = resolve('artifacts/tests/subagent-settings');
await mkdir(directory, { recursive: true });
await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LocaleProvider} from './src/ui/locale.jsx';
import {SubagentSettingsCard} from './src/remote-plugin-settings.jsx';
import {zh,en} from '../deepseek-harness/packages/client/ui-settings-plugins/src/client/locales.ts';
const events=new Map(), generations=new Set(), calls=[];
const base={subagent:{maxDepth:1,maxActiveSubagents:8},'subagent-model-selection':{enabled:false,allowedModels:[]}};
const user={subagent:{maxDepth:2},'subagent-model-selection':{enabled:true,allowedModels:[{provider:'test',model:'one'}]}};
let revision=1, generation=1, reject=false;
const view=namespace=>({namespace,snapshot:crypto.randomUUID(),revision,writable:true,applies:'live',
 fields:Object.entries(base[namespace]).map(([key,value])=>({key,base:value,value:user[namespace][key]??value,
  overridden:Object.hasOwn(user[namespace],key),...(Object.hasOwn(user[namespace],key)?{user:user[namespace][key]}:{})}))});
const model={transport:{capabilities:{management:true,pluginSettings:true,subagentSettings:true}},lifetime:new AbortController(),
 connection:{state:{getSnapshot:()=> 'connected'},generation:{getSnapshot:()=>({id:generation}),subscribe:fn=>{generations.add(fn);return()=>generations.delete(fn)}}},
 remote:{$on:(event,fn)=>{const list=events.get(event)??new Set();events.set(event,list);list.add(fn);return()=>list.delete(fn)},
 session:{modelCatalog:async()=>({ok:true,value:{groups:[{id:'test',name:'Test',models:[{id:'one',name:'Model One'}]}],failures:[]}})}},
 client:{request(operation){return {cancel(){},promise:Promise.resolve().then(()=>{
 if(operation.method==='remote.settingsWrite'){
  calls.push(operation);if(reject)throw new Error('transport interrupted');
  if(operation.expectedRevision!==revision)throw new Error('remote_settings_stale');
  for(const edit of operation.edits){if(edit.op==='unset')delete user[operation.namespace][edit.key];else user[operation.namespace][edit.key]=edit.value}revision++;
 }return view(operation.namespace)})}}}};
function App(){const [language,setLanguage]=useState('zh');return <>
 <button onClick={()=>setLanguage(value=>value==='zh'?'en':'zh')}>Language</button>
 <button onClick={()=>{revision++;for(const fn of events.get('settings/document-updated')??[])fn('subagent-model-selection')}}>External edit</button>
 <button onClick={()=>{generation++;for(const fn of generations)fn()}}>Reconnect</button>
 <button onClick={()=>{reject=true}}>Fail write</button>
 <button onClick={()=>document.querySelector('output').textContent=JSON.stringify({calls,user})}>Read calls</button><output/>
 <LocaleProvider locale={language}><SubagentSettingsCard model={model} view="detail" t={key=>(language==='zh'?zh:en)[key]??key}/></LocaleProvider>
 </>}
createRoot(document.getElementById('app')).render(<App/>);
` }, outfile: resolve(directory, 'test.js'), bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
  alias: { '@upstream': resolve('../deepseek-harness/packages/client') }, nodePaths: [resolve('node_modules')],
  jsx: 'automatic', loader: { '.module.css': 'local-css', '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  if (req.url === '/test.js' || req.url === '/test.css') return res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript').end(await readFile(resolve(directory, req.url.slice(1))));
  res.setHeader('Content-Type', 'text/html').end('<link rel="stylesheet" href="/test.css"><div id="app"></div><script type="module" src="/test.js"></script>');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { checks: [], errors: [] };
try {
  const page = await browser.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  const button = name => page.getByRole('button', { name, exact: true });
  const state = async () => { await button('Read calls').click(); return JSON.parse(await page.locator('output').innerText()); };
  const reset = () => button('恢复模型选择默认设置');
  await reset().click(); await button('取消').click(); assert.equal((await state()).calls.length, 0);
  await page.getByRole('textbox', { name: '最大递归深度', exact: true }).fill('3');
  assert.equal(await reset().isEnabled(), false); await button('重新读取设置').click();
  await page.getByRole('switch').click(); assert.equal(await reset().isEnabled(), false);
  await button('重新读取设置').click(); await reset().click();
  await button('External edit').click();
  assert.equal(await button('确认恢复默认').count(), 0); assert.equal(await reset().isEnabled(), false);
  await button('重新读取设置').click(); await reset().click();
  await button('Reconnect').click(); assert.equal(await button('确认恢复默认').count(), 0);
  report.checks.push('Cancel and dirty drafts do not reset; external revisions and connection changes invalidate confirmation');
  await button('重新读取设置').click(); await reset().click(); await button('Language').click();
  await button('Confirm restore defaults').click();
  await button('Read calls').click();
  const saved = await state();
  assert.equal(saved.calls.length, 1);
  assert.equal(saved.calls[0].namespace, 'subagent-model-selection');
  assert.deepEqual(saved.calls[0].edits, [{ op: 'unset', key: 'enabled' }, { op: 'unset', key: 'allowedModels' }]);
  assert.deepEqual(saved.user, { subagent: { maxDepth: 2 }, 'subagent-model-selection': {} });
  assert.equal(await page.locator('#plugin-config-subagent-depth').inputValue(), '2');
  assert.equal(await page.locator('#plugin-config-subagent-capacity').inputValue(), '8');
  assert.equal(await button('Restore model selection defaults').count(), 0);
  assert.equal(await page.getByRole('switch').getAttribute('aria-checked'), 'false');
  report.checks.push('Language preserves confirmation; one atomic reset restores both inherited fields and leaves limits unchanged');
  await page.reload(); await reset().click(); await button('Fail write').click(); await button('确认恢复默认').click();
  await page.getByRole('status').getByText('保存结果尚未确认，请重新连接电脑并重新读取设置后核对。', { exact: true }).waitFor();
  assert.equal(await reset().isEnabled(), false);
  assert.equal((await state()).calls.length, 1);
  assert.equal((await state()).user['subagent-model-selection'].enabled, true);
  report.checks.push('Unknown write result keeps prior values and prevents automatic replay');
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = String(error); throw error; }
finally { await writeFile('artifacts/subagent-settings-browser.json', JSON.stringify(report, null, 2)); await browser.close(); server.close(); }
console.log(JSON.stringify(report));
