import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {latestMobileBuild} from './latest-mobile-build.mjs';
import {remoteSourceAliases} from './remote-source-aliases.mjs';
import {mobileApprovalAccessibility} from './mobile-approval-accessibility.mjs';
import {checkRemoteLinks} from './check-remote-links.mjs';
import {checkRemoteBackNavigation} from './check-remote-back-navigation.mjs';
import {checkSidebarChat} from './check-sidebar-chat.mjs';

const root=resolve(import.meta.dirname,'..'),baseline=process.argv.includes('--baseline');
const aside=process.argv.includes('--aside-history');
const terminal=process.argv.includes('--terminal');
const mode=process.argv.includes('--links')?'links':process.argv.includes('--navigation')?'navigation':process.argv.includes('--sidebar')?'sidebar':aside?'aside-history':terminal?'terminal':'history';
const require=createRequire(import.meta.url);
const sdk=latestMobileBuild(root,{officialOnly:true,officialVersion:process.argv.includes('--alpha2')?'0.2.1-alpha.2':'0.2.1-rc.2'});
const output=resolve(root,`artifacts/tests/preview15-history/${sdk.version}-${baseline?'baseline':'candidate'}-${mode}`);
await mkdir(output,{recursive:true});
const contents=`import './tests/fixtures/remote-plugin-slots.jsx';
import '@upstream/ui-theme/src/styles/base.css'; import '@upstream/ui-theme/src/styles/design-platform.css';
import './src/ui/mobile.css'; import './src/ui/ordinary-product.css'; import './docs/design/ordinary-preview/remote.css'; import './src/ui/remote-product.css';`;
await build({absWorkingDir:root,stdin:{contents,resolveDir:root,loader:'jsx'},outfile:resolve(output,'test.js'),bundle:true,
  format:'esm',platform:'browser',jsx:'automatic',logLevel:'silent',
  plugins:[...(baseline?[{name:'published-preview11-workspace',setup(builder){builder.onLoad({filter:/[\\/]src[\\/]ui[\\/]RemoteWorkspace\.jsx$/},({path})=>({
    contents:execFileSync('git',['show','v0.1.0-preview.11:src/ui/RemoteWorkspace.jsx'],{cwd:root,encoding:'utf8'}),loader:'jsx',resolveDir:resolve(path,'..'),
  }));}}]:[]),sdk.resolver,mobileApprovalAccessibility()],
  alias:{...sdk.alias,...remoteSourceAliases(root,sdk),react:dirname(require.resolve('react/package.json')),
    'node:module':resolve(sdk.upstream,'apps/web/src/node-module-stub.ts')},nodePaths:[resolve(sdk.runtime,'node_modules'),resolve(root,'node_modules')],
  loader:{'.module.css':'local-css','.svg':'file','.png':'file','.woff2':'file','.woff':'file','.ttf':'file'},
  define:{DSHM_MOBILE_SDK_VERSION:JSON.stringify(sdk.version),'process.env.NODE_ENV':'"production"','process.versions.node':'"0.0.0"','process.execArgv':'[]','process.env.CORDIS_SHARED':'undefined'},
});
const server=createServer(async(req,res)=>{
  if(req.url==='/'||req.url.startsWith('/?'))return res.setHeader('Content-Type','text/html').end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if(/^\/[A-Za-z0-9@_.~-]+\.(js|css|svg|png|woff2?|ttf)$/.test(req.url)){
    try{return res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':req.url.endsWith('.svg')?'image/svg+xml':'application/octet-stream').end(await readFile(resolve(output,req.url.slice(1))));}catch{}
  }res.writeHead(404).end();
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(20000);
const report={sdk:sdk.version,baseline,source:'Actual preview.11-based host and official Session; isolated synthetic protocol, not a public APK or live desktop',pages:[],errors:[]};
page.on('pageerror',error=>report.errors.push(error.message));
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
const state=()=>page.evaluate(()=>window.preview15.state());
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='links'?'?documents&builtin':mode==='sidebar'?'?sidebar':''}`);await page.waitForFunction(()=>!!window.preview15);
  if(process.argv.includes('--links')){
    report.links=await checkRemoteLinks(page);
  }else if(process.argv.includes('--navigation')){
    report.navigation=await checkRemoteBackNavigation(page);
  }else if(process.argv.includes('--sidebar')){
    report.sidebar=await checkSidebarChat(page);
  }else{
  await page.evaluate(async({aside,terminal})=>{await window.fixture.select(null);window.preview15.history.setup({turns:terminal?40:2000,paragraphs:50,sessionId:aside?'child-chat':'one'});},{aside,terminal});
  await page.getByTestId('remote-workspace').locator('.remote-session-row,[data-remote-home-session]').filter({hasText:'one'}).first().click();
  if(aside){
    await page.evaluate(async()=>{await window.fixture.enableSidebarResources();window.preview15.model.sessions.handleSessionStatus('one',false);});
    await page.getByTestId('remote-workspace').getByRole('button',{name:'Remote 选项',exact:true}).click();
    await page.getByRole('button',{name:'子会话',exact:true}).click();
    await page.getByRole('group',{name:'分析助手',exact:true}).getByRole('button',{name:'在旁栏打开',exact:true}).click();
  }
  const owner=aside?page.getByTestId('remote-sidebar-conversation').filter({visible:true}):page.getByTestId('remote-workspace');
  const chat=owner.getByRole('region',{name:'聊天内容',exact:true});
  const input=owner.getByRole('textbox',{name:'消息',exact:true});await input.fill('preview15 continuous draft');
  await input.blur();await page.waitForTimeout(300);
  await page.evaluate(()=>{const model=window.preview15.model;window.__originalReference=(model.conversationFocus.getSnapshot()??model).reference;});
  await page.evaluate(()=>window.fixture.enable());
  const older=chat.locator('[data-history-loader]');
  if(!baseline){
    await chat.evaluate(el=>{el.scrollTop=0;});await settle();
    const before=await state();await page.evaluate(()=>{window.preview15.history.fail=true;});
    await older.click();
    await page.getByRole('alert').filter({hasText:'未能加载更早的记录，请重试。'}).waitFor();
    assert.equal((await state()).records,before.records,'失败不清空已读记录');
    assert.equal(await input.innerText(),'preview15 continuous draft');
    await page.evaluate(()=>{window.preview15.history.fail=false;});
    report.failedPagePreserved=true;
  }
  for(let index=0;index<(terminal?2:24);index++){
    await chat.evaluate(el=>{el.scrollTop=0;});await settle();
    const before=await state();
    await page.evaluate(()=>window.preview15.history.hold());
    await older.click();
    await page.waitForFunction(calls=>window.preview15.history.calls>calls,before.calls);await settle();
    if(!baseline){
      await older.dispatchEvent('click');await settle();
      assert.equal((await state()).calls,before.calls+1,'同一页读取中不重复请求');
    }
    const anchor=!baseline?await chat.locator('[data-history-group]').first().evaluate(el=>({key:el.dataset.historyGroup,top:el.getBoundingClientRect().top})):null;
    await page.evaluate(()=>window.preview15.history.release());
    await page.waitForFunction(records=>window.preview15.state().records>records,before.records);await settle();
    const after=await state();
    assert.equal(after.calls,before.calls+1);assert.ok(after.first<before.first);
    assert.ok(after.records>before.records,'已加载的记录保持连续，不从尾部删除');
    assert.equal(after.last,before.last);assert.equal(after.windowed,false,'不装饰原SDK为双窗口');
    let delta;
    if(anchor){
      const top=await chat.locator(`[data-history-group="${anchor.key}"]`).evaluate(el=>el.getBoundingClientRect().top);
      delta=top-anchor.top;assert.ok(Math.abs(delta)<4,`前插阅读锚点 ${delta}`);
      assert.ok(after.groups<=14 && after.dom<7000,'挂载数量有界，不能随已读总量增长');
    }
    report.pages.push({...after,anchorDelta:delta});
  }
  assert.equal(await input.innerText(),'preview15 continuous draft');
  assert.equal(await page.evaluate(()=>{const model=window.preview15.model;return (model.conversationFocus.getSnapshot()??model).reference===window.__originalReference;}),true,'分页不更换Session或插件作用域');
  assert.equal(await page.getByRole('button',{name:'加载较新的消息',exact:true}).count(),0);
  assert.equal(await page.locator('[aria-label="长内容分页"]').count(),0,'不加入正文下一段阅读限制');
  // 最早页→中间→最新，均只滚动本地连续历史，不向服务器补读较新页。
  const calls=(await state()).calls;
  for(const fraction of [0,.25,.5,.75,1,.4,0,1]){
    for(let attempt=0;attempt<6;attempt++){await chat.evaluate((el,f)=>{el.scrollTop=(el.scrollHeight-el.clientHeight)*f;},fraction);await settle();}
    assert.equal((await state()).calls,calls,'已加载历史来回查阅不再发page请求');
    if(!baseline)assert.ok((await state()).groups<=14);
  }
  const beforeLive=await state();await page.evaluate(()=>window.preview15.live());
  await page.waitForFunction(last=>window.preview15.state().last>last,beforeLive.last);
  const client=await page.context().newCDPSession(page);await client.send('Performance.enable');await client.send('HeapProfiler.collectGarbage');
  const metrics=await client.send('Performance.getMetrics');report.heapBytes=metrics.metrics.find(x=>x.name==='JSHeapUsedSize')?.value;await client.detach();
  report.final=await state();report.referenceAndDraft=true;report.noNewerRequests=true;
  await page.screenshot({path:resolve(output,'continuous-history.png')});assert.deepEqual(report.errors,[]);
  }
}catch(error){report.failure=error.stack;report.debug=await page.evaluate(()=>({state:window.preview15?.state(),scroll:[...document.querySelectorAll('.conversation')].map(el=>({top:el.scrollTop,height:el.scrollHeight,viewport:el.clientHeight}))}));await writeFile(resolve(output,'failure.html'),await page.content());throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();server.close();}
