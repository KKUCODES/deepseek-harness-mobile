import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';

// 生产组件及上游字典配合隔离状态源；不向真实电脑提交权限/工作区操作。
const directory=resolve('artifacts/tests/navigation-language');await mkdir(directory,{recursive:true});
await build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {LocaleProvider} from './src/ui/locale.jsx';
import {RemoteWorkspaceManager} from './src/ui/RemoteWorkspaces.jsx';
import {RemotePermissionPicker} from './src/ui/RemotePermissions.jsx';
import {RemoteAgentPresetLabel,RemoteAgentPresetPicker} from './src/ui/RemoteAgentPresets.jsx';
import {RemoteSkillPicker} from './src/ui/RemoteSkills.jsx';
import {RemoteSubagents} from './src/ui/RemoteSubagents.jsx';
const calls=[],reads={permissions:0,presets:0,skills:0},listeners=new Set();
let state={selected:'chat',agentPreset:'standard',permission:{currentValue:'workspace-write'},connectionState:'connected',session:{openState:'open',blank:true,running:false},workspaces:{items:[{workspaceId:'one',title:'测试项目一',updatedAt:1},{workspaceId:'two',title:'测试项目二',updatedAt:1}]},list:{byId:{},subagentsByParent:{chat:{state:'ready',entries:[{id:'child',label:'中文子任务',activity:'inactive',mode:'one-shot',hasChildren:true},{id:'broken',kind:'diagnostic',label:'原损坏记录',reason:'corrupt'}]}}}};
let permissions={status:'ready',revision:1,options:[{value:'workspace-write',name:'Workspace Write'},{value:'danger-full-access',name:'Full access'},{value:'auto',name:'Auto review'},{value:'private-policy',name:'自定义策略'}]};
const presets={status:'ready',enabled:true,busy:false,options:[{id:'standard',trust:'system'},{id:'minimal',trust:'system'},{id:'mine',trust:'user',name:'标准模式',description:'自定义中文说明'}]};
const skillState={status:'ready',items:[{name:'sample-skill',description:'电脑中文技能说明',path:'/computer/SKILL.md',modelInvocable:false}]};
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)},publish=()=>{for(const fn of listeners)fn()};
const model={subscribe,getSnapshot:()=>state,workspaceActions:{supported:true,permitted:true,change:async(kind,selected,value)=>calls.push({kind,selected,value})},
 permissions:{subscribe,getSnapshot:()=>permissions,writable:true,load:async()=>{reads.permissions++;},choose:async(value,sessionId,acknowledged)=>{calls.push({kind:'permission',value,sessionId,acknowledged});}},
 agentPresets:{subscribe,getSnapshot:()=>presets,available:true,writable:true,load:async()=>{reads.presets++;},choose:async(id,sessionId)=>calls.push({kind:'preset',id,sessionId})},
 subagentsAvailable:true,openChild:async id=>calls.push({kind:'child',id}),sessions:{refreshSubagents:async()=>{}}};
const skills={subscribe,getSnapshot:()=>skillState,load:async()=>{reads.skills++;}};
function App(){const [locale,setLocale]=useState('en');return <>
<button onClick={()=>setLocale(x=>x==='en'?'zh':'en')}>Switch language</button>
<button onClick={()=>{permissions={...permissions,revision:2};publish();}}>Invalidate permissions</button>
<button onClick={()=>{state={...state,workspaces:{items:state.workspaces.items.map(x=>({...x,updatedAt:2}))}};publish();}}>Invalidate workspace</button>
<button onClick={()=>document.querySelector('[data-testid=calls]').textContent=JSON.stringify({calls,reads})}>Read calls</button><output data-testid="calls"/>
<LocaleProvider locale={locale}><RemoteWorkspaceManager model={model}/><RemotePermissionPicker model={model} sessionId="chat"/><RemoteAgentPresetLabel model={model} onOpen={()=>{}}/><RemoteAgentPresetPicker model={model} sessionId="chat"/>
<RemoteSkillPicker skills={skills} sessionId="chat" onPick={(name,sessionId)=>calls.push({kind:'skill',name,sessionId})} onSource={path=>calls.push({kind:'source',path})}/><RemoteSubagents model={model} state={state}/></LocaleProvider></>}
createRoot(document.getElementById('app')).render(<App/>);`},outfile:resolve(directory,'test.js'),bundle:true,format:'esm',platform:'browser',logLevel:'silent',alias:{'@upstream':resolve('../deepseek-harness/packages/client')},nodePaths:[resolve('node_modules')],loader:{'.module.css':'local-css'},define:{'process.env.NODE_ENV':'"production"'}});
const server=createServer(async(req,res)=>{if(req.url==='/test.js')return res.setHeader('Content-Type','text/javascript').end(await readFile(resolve(directory,'test.js')));res.setHeader('Content-Type','text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});const report={source:'Production navigation components and upstream dictionaries with isolated callbacks',checks:[]};
try{
const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
const toggle=()=>page.getByRole('button',{name:'Switch language',exact:true}).click();
const state=async()=>{await page.getByRole('button',{name:'Read calls',exact:true}).click();return JSON.parse(await page.getByTestId('calls').innerText());};
await page.getByRole('button',{name:'Agent mode, current: Standard mode',exact:true}).waitFor();
await page.getByRole('button',{name:'标准模式',exact:true}).waitFor();
await page.getByText('自定义中文说明',{exact:true}).waitFor();
const initial=(await state()).reads;
await page.getByRole('button',{name:'Full access',exact:true}).click();
assert.ok(await page.getByRole('button',{name:'Enable Full access',exact:true}).isDisabled());
await page.getByRole('checkbox',{name:'I understand the risks and want to continue',exact:true}).check();
await toggle();
assert.ok(await page.getByRole('checkbox',{name:'我已了解风险，并愿意继续',exact:true}).isChecked());
await page.getByRole('button',{name:'启用完全权限',exact:true}).click();
assert.deepEqual((await state()).calls,[{kind:'permission',value:'danger-full-access',sessionId:'chat',acknowledged:true}]);
await page.getByRole('button',{name:'Auto review',exact:true}).click();
await page.getByRole('checkbox',{name:'我已了解这些风险，并愿意继续',exact:true}).check();
await toggle();
await page.getByRole('group',{name:'Enable Auto review (experimental)?',exact:true}).waitFor();
await page.getByRole('button',{name:'Invalidate permissions',exact:true}).click();
assert.equal(await page.getByRole('group',{name:'Enable Auto review (experimental)?',exact:true}).count(),0);
assert.equal((await state()).calls.length,1);
report.checks.push('Upstream full-access/auto-review confirmation translates, acknowledgement survives locale, catalog revision invalidates old consent; exact original permission payload only after explicit submit');
const work=page.getByTestId('remote-workspace-manager');await work.getByRole('button',{name:'测试项目一',exact:true}).click();
await work.getByRole('button',{name:'Rename workspace',exact:true}).click();await work.getByRole('textbox',{name:'Workspace name',exact:true}).fill('未提交新名称');
await toggle();assert.equal(await work.getByRole('textbox',{name:'工作区名称',exact:true}).inputValue(),'未提交新名称');
await work.getByRole('button',{name:'返回工作区列表',exact:true}).click();await work.getByRole('button',{name:'测试项目一',exact:true}).click();await work.getByRole('button',{name:'移除工作区注册',exact:true}).click();
await work.getByRole('checkbox').check();await toggle();assert.ok(await work.getByRole('checkbox',{name:'I confirm unregistering “测试项目一”',exact:true}).isChecked());
await page.getByRole('button',{name:'Invalidate workspace',exact:true}).click();assert.ok(await work.getByRole('button',{name:'Confirm unregistering',exact:true}).isDisabled());
assert.equal((await state()).calls.length,1);report.checks.push('Workspace name and unregister consent survive language, original title retained; changed workspace disables removal without submitting');
await page.getByRole('searchbox',{name:'Search skills',exact:true}).fill('sample');await toggle();assert.equal(await page.getByRole('searchbox',{name:'搜索技能',exact:true}).inputValue(),'sample');
await page.getByText('电脑中文技能说明',{exact:true}).waitFor();await page.getByRole('button',{name:'使用技能 sample-skill',exact:true}).click();await page.getByRole('button',{name:'查看技能 sample-skill',exact:true}).click();
await toggle();await page.getByRole('button',{name:'Minimal mode',exact:true}).click();
assert.deepEqual((await state()).calls.slice(1),[{kind:'skill',name:'sample-skill',sessionId:'chat'},{kind:'source',path:'/computer/SKILL.md'},{kind:'preset',id:'minimal',sessionId:'chat'}]);
assert.deepEqual((await state()).reads,initial);report.checks.push('Skill query/raw description/source and original preset IDs preserved; custom name unchanged; language does not reload catalogs');
const child=page.getByRole('region',{name:'Subchat list',exact:true});await child.getByText('Not running · Read-only record · Has subtasks',{exact:true}).waitFor();assert.ok(await child.getByRole('button').filter({hasText:'原损坏记录'}).isDisabled());
assert.doesNotMatch(await child.innerText(),/Completed/);await child.getByRole('button').filter({hasText:'中文子任务'}).click();assert.deepEqual((await state()).calls.at(-1),{kind:'child',id:'child'});assert.deepEqual(errors,[]);report.checks.push('Inactive subchat remains not-running rather than completed; diagnostic row disabled; original child ID passed');
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile('artifacts/navigation-language-components.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
