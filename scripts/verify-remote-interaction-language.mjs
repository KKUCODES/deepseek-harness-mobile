import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';

// 只测试真实 React 卡片的显示与回调；不替代远程协议、鉴权或电脑实际审批验收。
const directory = resolve('artifacts/tests/interaction-language');
await mkdir(directory, { recursive: true });
await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {RemoteInteraction} from './src/ui/RemoteInteraction.jsx';
import {LocaleProvider} from './src/ui/locale.jsx';
const mode = new URLSearchParams(location.search).get('mode');
const question = {id:'q1', question:'保留原问题？', detail:'电脑提供的说明', options:[{label:'中文选项',description:'不能翻译协议值'},{label:'另一项'}], multiSelect:true};
const plan = {...question, multiSelect:false, detail:'原计划正文', intent:{kind:'plan-review',approve:'中文选项'}};
const event = {eventId:'event-1', event:mode.startsWith('approval')||mode==='failure'?'approval/request':'question',
 request:mode.startsWith('approval')||mode==='failure'?{toolName:'write',reason:'电脑审批理由'}:{questions:[mode.startsWith('plan')?plan:question]}};
function App() {
 const [locale,setLocale]=useState('en'), [calls,setCalls]=useState([]);
 const model={answer:async(id,outcome)=>{setCalls(values=>[...values,{id,outcome}]);if(mode==='failure')throw Error('transport_lost');}};
 return <><button onClick={()=>setLocale(value=>value==='en'?'zh':'en')}>Switch language</button>
 <LocaleProvider locale={locale}><RemoteInteraction event={event} model={model} renderContent={text=><p>{text}</p>}/></LocaleProvider>
 <output data-testid="calls">{JSON.stringify(calls)}</output></>;
}
createRoot(document.getElementById('app')).render(<App/>);` },
  outfile: resolve(directory, 'test.js'), bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
  alias: { '@upstream': resolve('../deepseek-harness/packages/client') }, loader: { '.module.css': 'local-css' },
  nodePaths: [resolve('node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/test.js')) return res.setHeader('Content-Type', 'text/javascript').end(await readFile(resolve(directory, 'test.js')));
  res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { source: 'Production RemoteInteraction + LocaleProvider with isolated answer callback', cases: [] };
try {
  for (const mode of ['question', 'approval', 'approval-reject', 'plan', 'plan-change', 'failure']) {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
    const calls = async () => JSON.parse(await page.getByTestId('calls').innerText());
    if (mode === 'question') {
      await page.getByRole('region', { name: 'Awaiting your answer' }).waitFor();
      await page.getByRole('checkbox', { name: /^中文选项/ }).check();
      await page.getByRole('textbox', { name: 'Additional answer: 保留原问题？' }).fill('  保留补充文本  ');
      await page.getByRole('button', { name: 'Switch language' }).click();
      assert.equal(await page.getByRole('checkbox', { name: /^中文选项/ }).isChecked(), true);
      assert.equal(await page.getByRole('textbox', { name: '补充回答：保留原问题？' }).inputValue(), '  保留补充文本  ');
      await page.getByRole('button', { name: '提交回答', exact: true }).click();
      assert.deepEqual(await calls(), [{id:'event-1',outcome:{kind:'result',value:{answers:[{id:'q1',selected:['中文选项'],custom:'保留补充文本'}]}}}]);
      assert.equal(await page.getByRole('button', { name: '提交回答' }).isDisabled(), true);
    } else if (mode.startsWith('plan')) {
      await page.getByRole('region', { name: 'Awaiting plan approval' }).waitFor();
      assert.equal(await page.getByText('原计划正文', { exact: true }).count(), 1);
      await page.getByRole('button', { name: mode === 'plan' ? 'Approve plan' : 'Request changes', exact: true }).click();
      assert.deepEqual(await calls(), [{id:'event-1',outcome:mode === 'plan' ? {kind:'result',value:{answers:[{id:'q1',selected:['中文选项']}]}} : {kind:'cancel'}}]);
    } else {
      await page.getByRole('region', { name: 'Awaiting approval' }).waitFor();
      assert.equal(await page.getByText('电脑审批理由', { exact: true }).count(), 1);
      await page.getByRole('button', { name: mode === 'approval-reject' ? 'Reject' : 'Allow once', exact: true }).click();
      assert.deepEqual(await calls(), [{id:'event-1',outcome:{kind:'result',value:mode === 'approval-reject' ? 'rejected' : 'allowed-once'}}]);
      if (mode === 'failure') {
        await page.getByRole('alert').filter({ hasText: 'Could not confirm the result.' }).waitFor();
        await page.getByRole('button', { name: 'Switch language' }).click();
        await page.getByRole('alert').filter({ hasText: '未能确认处理结果' }).waitFor();
        assert.equal(await page.getByRole('button', { name: '允许一次' }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: '拒绝' }).isDisabled(), true);
        assert.equal((await calls()).length, 1);
      }
    }
    assert.deepEqual(errors, []); report.cases.push(mode); await page.close();
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); await writeFile('artifacts/remote-interaction-language.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
