import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';

// 生产页面 + 隔离状态源：验证编辑/确认和状态投影，不冒充真实电脑执行或鉴权。
const directory = resolve('artifacts/tests/task-language');
await mkdir(directory, { recursive: true });
await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LocaleProvider} from './src/ui/locale.jsx';
import {RemoteGoalPanel,RemoteGoalSummary} from './src/ui/RemoteGoal.jsx';
import {RemoteJobs} from './src/ui/RemoteJobs.jsx';
import {RemoteSchedules} from './src/ui/RemoteSchedules.jsx';
const calls=[],listeners=new Set();
let goalState={status:'ready',busy:false,value:{id:'goal',revision:4,phase:'paused',objective:'保留电脑原目标',roundsStarted:2,maxGoalRounds:9}};
let state={selected:'chat',connectionState:'connected',session:{openState:'open'},list:{jobsBySession:{chat:[{id:'job',startedAt:1000,status:'running',kind:'pwsh',label:'电脑原任务',detail:'原命令说明'}]}},schedules:[{id:'schedule',kind:'every',prompt:'电脑原提醒',scheduledAt:'2099-09-25T06:00:00Z',everySeconds:60}]};
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)},publish=()=>{for(const fn of listeners)fn()};
const goals={subscribe,getSnapshot:()=>goalState,supports:()=>true,refresh:async()=>{},change:async(method,sessionId,ref,request)=>{calls.push({method,sessionId,ref,request});}};
const model={subscribe,getSnapshot:()=>state,transport:{capabilities:{}},jobActions:{available:true,pending:new Set(),key:()=> 'job',stop:async(sessionId,job)=>{calls.push({method:'stop',sessionId,job});return 'requested';}}};
function App(){const [language,setLanguage]=useState('en');return <>
<button onClick={()=>setLanguage(value=>value==='en'?'zh':'en')}>Switch language</button>
<button onClick={()=>{goalState={...goalState,value:{...goalState.value,revision:5,objective:'电脑的新目标'}};publish();}}>Update goal remotely</button>
<button onClick={()=>{state={...state,list:{jobsBySession:{chat:[{...state.list.jobsBySession.chat[0],status:'killed',finishedAt:2000}]}}};publish();}}>Finish task remotely</button>
<button onClick={()=>{state={...state,connectionState:'disconnected'};publish();}}>Disconnect fixture</button>
<button onClick={()=>document.querySelector('[data-testid=calls]').textContent=JSON.stringify(calls)}>Read calls</button>
<output data-testid="calls"/>
<LocaleProvider locale={language}><RemoteGoalSummary goals={goals} onOpen={()=>{}}/><RemoteGoalPanel goals={goals} sessionId="chat"/><RemoteJobs model={model} sessionId="chat" onOpenOutput={()=>{}}/><RemoteSchedules model={model} sessionId="chat"/></LocaleProvider></>}
createRoot(document.getElementById('app')).render(<App/>);` }, outfile: resolve(directory,'test.js'), bundle:true, format:'esm', platform:'browser', logLevel:'silent',
  alias:{'@upstream':resolve('../deepseek-harness/packages/client')}, nodePaths:[resolve('node_modules')], loader:{'.module.css':'local-css'}, define:{'process.env.NODE_ENV':'"production"'} });
const server=createServer(async(req,res)=>{
  if(req.url==='/test.js') return res.setHeader('Content-Type','text/javascript').end(await readFile(resolve(directory,'test.js')));
  res.setHeader('Content-Type','text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={source:'Production task/goal/schedule components with isolated state and action callbacks',checks:[]};
try {
  const page=await browser.newPage(); page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'Edit goal',exact:true}).click();
  await page.getByRole('textbox',{name:'Goal',exact:true}).fill('保留手机编辑');
  await page.getByRole('spinbutton',{name:'Maximum turns',exact:true}).fill('12');
  await page.getByRole('button',{name:'Switch language'}).click();
  assert.equal(await page.getByRole('textbox',{name:'目标内容'}).inputValue(),'保留手机编辑');
  assert.equal(await page.getByRole('spinbutton',{name:'最多执行轮次'}).inputValue(),'12');
  await page.getByRole('button',{name:'保存目标',exact:true}).click();
  await page.getByRole('button',{name:'Read calls'}).click();
  assert.deepEqual(JSON.parse(await page.getByTestId('calls').innerText()),[{method:'edit',sessionId:'chat',ref:{id:'goal',revision:4},request:{objective:'保留手机编辑',maxGoalRounds:12}}]);
  report.checks.push('Goal edit and turn limit survive language change; original version/ref and request preserved');
  await page.getByRole('button',{name:'编辑目标',exact:true}).click();
  await page.getByRole('button',{name:'Update goal remotely'}).click();
  await page.getByRole('alert').filter({hasText:'目标已更新'}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'目标内容'}).count(),0);
  await page.getByRole('button',{name:'Switch language'}).click();
  await page.getByRole('alert').filter({hasText:'The goal changed.'}).waitFor();
  report.checks.push('Real component invalidates editor on newer goal revision; fixed error translates, raw goal stays Chinese');
  await page.getByRole('button',{name:'Stop task',exact:true}).click();
  await page.getByRole('button',{name:'Switch language'}).click();
  await page.getByRole('button',{name:'确认停止任务',exact:true}).click();
  await page.getByRole('status').filter({hasText:'已请求停止，等待电脑确认任务结束。'}).waitFor();
  await page.getByRole('button',{name:'Switch language'}).click();
  await page.getByRole('status').filter({hasText:'Stop requested.'}).waitFor();
  await page.getByRole('button',{name:'Read calls'}).click();
  const calls=JSON.parse(await page.getByTestId('calls').innerText());
  assert.equal(calls.length,2);assert.equal(calls[1].job.id,'job');assert.equal(calls[1].job.startedAt,1000);
  await page.getByRole('button',{name:'Finish task remotely'}).click();
  await page.getByRole('status').filter({hasText:'Task status: Canceled.'}).waitFor();
  report.checks.push('Stop confirmation retained; acknowledgement is not completion; only authoritative state shows canceled');
  const schedules=page.getByRole('list',{name:'Scheduled tasks in this chat'});
  await schedules.getByText('Every 1 minute',{exact:true}).waitFor();
  const date=await schedules.locator('time').getAttribute('datetime');
  await page.getByRole('button',{name:'Disconnect fixture'}).click();
  await schedules.getByText('Needs checking',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Switch language'}).click();
  const chinese=page.getByRole('list',{name:'当前聊天定时任务'});
  assert.equal(await chinese.locator('time').getAttribute('datetime'),date);
  await chinese.getByText('电脑原提醒',{exact:true}).waitFor();
  await chinese.getByText('待核对',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  report.checks.push('Recurring interval/date localized without changing timestamp or prompt; offline state does not claim execution');
} catch(error){report.failure=error.message;process.exitCode=1;}
finally {await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile('artifacts/task-language-components.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
