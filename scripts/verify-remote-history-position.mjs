import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';

// 使用生产定位函数和真实浏览器布局；仅回放前插/流式增长，不模拟认证或电脑协议。
const source = await readFile('src/remote-history-position.mjs', 'utf8');
const server = createServer((request, response) => {
  if (request.url === '/position.mjs') return response.setHeader('Content-Type', 'text/javascript').end(source);
  response.setHeader('Content-Type', 'text/html').end(`<style>
    .conversation{height:300px;width:375px;overflow:auto}
    .messages{display:flex;flex-direction:column;gap:24px}.message{height:120px;flex:none}
    </style><section class="conversation"><div class="messages">
    <button data-history-loader>更早消息</button><article id="anchor" class="message">原消息</article>
    <article class="message" style="height:900px">原后续消息</article></div></section>
    <script type="module">import {loadEarlierHistory} from '/position.mjs';
    const container=document.querySelector('.conversation'), messages=container.firstElementChild;
    window.run=async mode=>{
      if(mode==='plugin-slots'){
        for(const row of [...messages.querySelectorAll('.message')]){
          const slot=document.createElement('div'); slot.dataset.slot='dshm.chat.node'; slot.style.display='contents';
          row.dataset.chatFlowKey=row.id||'later'; row.replaceWith(slot); slot.append(row);
        }
      }
      let current=true, finish; const promise=new Promise(resolve=>finish=resolve);
      const anchor=document.querySelector('#anchor'), y=anchor.getBoundingClientRect().top;
      const pending=loadEarlierHistory({container,load:()=>mode==='failed'?Promise.reject(Error('read-failed')):promise,isCurrent:()=>current});
      if(mode==='failed'){try{await pending;}catch(error){return {error:error.message,restored:container.style.overflowAnchor===''};}}
      const earlier=document.createElement('article'); earlier.className='message'; earlier.style.height='200px';
      messages.prepend(earlier); messages.querySelector('[data-history-loader]').remove();
      if(mode==='tail-growth')messages.lastElementChild.style.height='1500px';
      if(mode==='user-scroll')container.scrollTop+=40;
      if(mode==='changed-session')current=false;
      if(mode==='removed-anchor')anchor.remove();
      const before=container.scrollTop; finish(); await pending;
      return {shift:anchor.isConnected?anchor.getBoundingClientRect().top-y:null,before,after:container.scrollTop,restored:container.style.overflowAnchor===''};
    };</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { source: 'production position helper + real browser DOM; not Host/Android verification', cases: [] };
try {
  for (const mode of ['prepend', 'plugin-slots', 'tail-growth', 'user-scroll', 'changed-session', 'removed-anchor', 'failed']) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(mode => window.run(mode), mode);
    assert.equal(result.restored, true);
    if (mode === 'failed') assert.equal(result.error, 'read-failed');
    else if (mode === 'changed-session') assert.equal(result.after, result.before);
    else if (mode === 'removed-anchor') assert.ok(result.after > 0, '首锚点移除时沿用下一个存活消息');
    else assert.ok(Math.abs(result.shift - (mode === 'user-scroll' ? -40 : 0)) < 1, JSON.stringify(result));
    report.cases.push({ mode, ...result }); await page.close();
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await writeFile('artifacts/remote-history-position-web.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
