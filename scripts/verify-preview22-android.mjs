import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';
import { setTimeout as wait } from 'node:timers/promises';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from './android-app-webview.mjs';
import { checkRemoteMarkdownImages } from './check-remote-markdown-images.mjs';
import { checkRemoteTerminalHistory } from './check-remote-terminal-history.mjs';
const terminal=process.argv.includes('--terminal'),aside=process.argv.includes('--aside');
const kind=terminal?'terminal':aside?'aside-history':'images';
const serial=process.env.DSHM_ANDROID_SERIAL??'127.0.0.1:16384',app='dev.dshmobile.validation.rc3test';
const adb='C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s',serial,...args],{encoding:'utf8',windowsHide:true});
const directory=resolve(`artifacts/tests/preview15-history/0.2.2-rc.3-candidate-${kind}`);
const output=resolve('artifacts/preview22/native');await mkdir(output,{recursive:true});
run('shell','am','force-stop',app);run('shell','am','start','-n',`${app}/dev.dshmobile.validation.ValidationActivity`);
for(let attempt=0;attempt<30;attempt++){
  let pid='';try{pid=run('shell','pidof',app).trim();}catch{}
  if(pid)break;await wait(200);
}
const device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
const report={source:'MuMu RemoteActivity WebView and actual RemoteWorkspace/Session; controlled file/history replay',kind,errors:[]};
try{
  let page=await (await androidAppWebView(device,app)).page();page.setDefaultTimeout(20000);
  if(!page.url().startsWith('https://remote.dshm.invalid/')){
    await page.getByRole('button',{name:'打开侧边抽屉',exact:true}).click();
    const opened=page.context().waitForEvent('page');await page.getByRole('button',{name:'Remote',exact:true}).click();page=await opened;
    await page.waitForFunction(()=>typeof window.dshmHandleBack==='function');
  }
  page.on('pageerror',error=>report.errors.push(error.message));
  const origin=new URL(page.url()).origin;
  await page.evaluate(()=>{delete window.fixture;delete window.preview15;history.replaceState(null,'',location.pathname);});
  await page.route(origin+'/preview22-native/*',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1);
    if(!/^[\w@.~+-]+\.(js|css|svg|png|woff2?|ttf)$/.test(name))return route.fulfill({status:404});
    const contentType=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
    await route.fulfill({body:await readFile(resolve(directory,name)),contentType});
  });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div>');
  const css=(await readFile(resolve(directory,'test.css'),'utf8')).replace(/url\(["']?(?:\.\/)?(JetBrainsMono[^)"']+)["']?\)/g,`url("${origin}/assets/web/$1")`);
  await page.addStyleTag({content:css});
  // 与现有原生回放一致，用宿主已允许的模块执行器；不修改页面 CSP。
  const {code}=await transform(await readFile(resolve(directory,'test.js'),'utf8'),{define:{'import.meta.url':JSON.stringify(page.url()),'import.meta.env':'{"MODE":"production"}'}});
  await page.evaluate(code=>Function(`return (async()=>{${code}\n})()`)(),code);
  await page.waitForFunction(()=>!!window.preview15);
  report.result=terminal?await checkRemoteTerminalHistory(page):await checkRemoteMarkdownImages(page,{aside});
  assert.deepEqual(report.errors,[]);
  await page.screenshot({path:resolve(output,`${kind}.png`)});
}catch(error){report.failure=error.stack;throw error;}
finally{await writeFile(resolve(output,`${kind}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await device.close();}
