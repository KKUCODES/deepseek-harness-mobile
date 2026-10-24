import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {_android} from 'playwright';
import {androidAppWebView} from './android-app-webview.mjs';

// 只驱动独立测试UID；产品组件+合成会话复用浏览器回归产物，原生桥和浏览器Intent保持真实。
const adb='C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe', serial='emulator-5556', pkg='dev.dshmobile.validation.rc21test';
const shell=(...args)=>execFileSync(adb,['-s',serial,'shell',...args],{encoding:'utf8',windowsHide:true});
assert.match(shell('getprop','ro.hardware'),/ranchu/);
const folder='artifacts/remote-links';await mkdir(folder,{recursive:true});
const report={actualNativeBridge:true,protocolReplay:true,checks:[],errors:[]};
// 其他专项会复用test.js；先固定生成rc.2产物，避免误把上次alpha.2或旧基线当作当前原生组合。
const fixtureLog=execFileSync(process.execPath,['scripts/verify-remote-plugin-slots.mjs','--links'],{encoding:'utf8',windowsHide:true});
await writeFile(`${folder}/native-fixture-build.log`,fixtureLog);
const device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);device.setDefaultTimeout(15000);
const top=()=>shell('dumpsys','activity','activities').split('\n').filter(l=>/topResumedActivity|mResumedActivity/.test(l)).join('\n');
let page;
try{
  shell('am','start','-W','-n',`${pkg}/dev.dshmobile.validation.ValidationActivity`);
  page=await(await androidAppWebView(device,pkg)).page();
  await page.getByRole('button',{name:'打开侧边抽屉',exact:true}).click();await page.getByRole('button',{name:'Remote',exact:true}).click();
  for(let i=0;i<80&&!page.url().startsWith('https://remote.dshm.invalid/');i++){page=page.context().pages().find(p=>p.url().startsWith('https://remote.dshm.invalid/'))??page;await wait(100);}
  assert.equal(page.url(),'https://remote.dshm.invalid/assets/web/remote.html');
  await page.evaluate(()=>{window.__dshmLinkDocuments=true;document.body.replaceChildren(Object.assign(document.createElement('div'),{id:'app'}));});
  const source=(await readFile('artifacts/tests/remote-plugin-slots/test.js','utf8')).replace(/^export\s*\{[^}]*\};?/m,'').replaceAll('import.meta.env',"({MODE:'production'})").replaceAll('import.meta.url','location.href');
  await page.evaluate(`(async()=>{${source}\n})()`);
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.waitForFunction(()=>!!window.fixture);
  await page.evaluate(async()=>{window.fixture.externalLinks.native();window.fixture.locale('zh');await window.fixture.select('two');window.fixture.assistantBlocks([{type:'text',text:'[Android正文网页](https://example.com/chat)'}]);});
  async function opensBrowser(name){
    await page.getByRole('link',{name,exact:true}).click();
    let activity='';for(let i=0;i<50;i++){activity=top();if(activity&&!activity.includes(pkg))break;await wait(100);}
    assert.match(activity,/chrome|browser/i,'系统浏览器应进入前台');assert.equal(page.url(),'https://remote.dshm.invalid/assets/web/remote.html');
    for(let i=0;i<3&&!top().includes('RemoteActivity');i++){shell('input','keyevent','4');await wait(300);}
    assert.ok(top().includes('RemoteActivity'),'返回仍在原Remote页面');
    return activity.trim();
  }
  report.chatBrowser=await opensBrowser('Android正文网页');report.checks.push('真实聊天点击进入系统浏览器，返回仍保留Remote');
  await page.evaluate(()=>window.fixture.fileLayout('native-links.md','[Android文件网页](http://example.com/document)'));
  report.fileBrowser=await opensBrowser('Android文件网页');report.checks.push('真实内置Markdown文件面板经同一桥打开系统浏览器');
  for(const data of [{url:'javascript:alert(1)'},{url:'file:///data/private'},{url:'https://user:password@example.com'},{url:'https://example.com',extra:true},{url:42}]){
    const error=await page.evaluate(async value=>{try{await window.fixture.externalLinks.raw(value);return null;}catch(e){return e.message;}},data);
    assert.equal(error,Object.hasOwn(data,'extra')?'invalid_request':'invalid_link');
  }
  const wrongPage=await page.evaluate(async()=>{history.replaceState(null,'','/assets/web/other.html');try{await window.fixture.externalLinks.raw({url:'https://example.com'});return null;}catch(e){return e.message;}finally{history.replaceState(null,'','/assets/web/remote.html');}});
  assert.equal(wrongPage,'unsupported_operation');
  await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.id='dshm-link-frame';iframe.srcdoc='<p>isolated frame probe</p>';document.body.append(iframe);});
  const child=await(await page.locator('#dshm-link-frame').elementHandle()).contentFrame();assert.ok(child);
  // 调试协议在子框架执行探针，不依赖被CSP禁止的内联脚本；原生收到的框架身份仍是真实子框架。
  const frame=await child.evaluate(()=>new Promise(resolve=>{
    let replied=false;const bridge=window.DSHMRemote;
    if(bridge){bridge.onmessage=()=>replied=true;bridge.postMessage(JSON.stringify({id:crypto.randomUUID(),op:'links.open',data:{url:'https://example.com/frame'}}));}
    setTimeout(()=>resolve({bridge:!!bridge,replied}),400);
  }));
  await page.locator('#dshm-link-frame').evaluate(el=>el.remove());
  assert.equal(frame.replied,false);assert.ok(top().includes('RemoteActivity'));report.frame=frame;
  await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.id='dshm-link-opaque';iframe.sandbox='allow-scripts';iframe.srcdoc='<p>opaque origin probe</p>';document.body.append(iframe);});
  const opaqueFrame=await(await page.locator('#dshm-link-opaque').elementHandle()).contentFrame();assert.ok(opaqueFrame);
  report.opaqueFrame=await opaqueFrame.evaluate(()=>({origin:self.origin,bridge:typeof window.DSHMRemote!=='undefined'}));
  assert.equal(report.opaqueFrame.bridge,false);await page.locator('#dshm-link-opaque').evaluate(el=>el.remove());
  report.checks.push('非法协议、凭据、参数、类型与非入口URL被拒绝；子框架不能启动外部浏览器');
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.message;throw error;}finally{
  await writeFile(`${folder}/native-links-report.json`,JSON.stringify(report,null,2));
  await Promise.race([device.close(),wait(3000)]);
}
console.log(JSON.stringify(report));
// 某些WebView的CDP关闭会留下空闲连接；独立CLI在报告落盘后显式结束，不遗留驱动进程。
process.exit(0);
