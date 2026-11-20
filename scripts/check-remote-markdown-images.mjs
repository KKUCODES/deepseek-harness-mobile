import assert from 'node:assert/strict';

/** 正式会话正文、官方Markdown和图库入口；文件字节为隔离回放。 */
export async function checkRemoteMarkdownImages(page, { aside = false } = {}) {
  const text = ['![space](/work/my photo.png)', '', String.raw`![windows](C:\work\_photo.png)`, '', '![hash](/work/a%23b.png)'].join('\n');
  await page.evaluate(async ({text,child}) => { window.preview15.images.markdownFailure(false); await window.preview15.images.markdown(text, {child}); }, {text,child:aside});
  if(aside){
    await page.evaluate(async()=>{await window.fixture.enableSidebarResources();window.preview15.model.sessions.handleSessionStatus('one',false);});
    await page.getByTestId('remote-workspace').getByRole('button',{name:'Remote 选项',exact:true}).click();
    await page.getByRole('button',{name:'子会话',exact:true}).click();
    await page.getByRole('group',{name:'分析助手',exact:true}).getByRole('button',{name:'在旁栏打开',exact:true}).click();
  }
  const scope = page.getByTestId(aside ? 'remote-sidebar-conversation' : 'remote-workspace').filter({visible:true});
  const chat = scope.getByRole('region', {name:'聊天内容',exact:true});
  for (const name of ['space','windows','hash']) await chat.getByRole('button',{name:`打开图片: ${name}`,exact:true}).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.conversation img')].filter(i=>i.complete&&i.naturalWidth>0).length===3);
  const reads = await page.evaluate(()=>window.preview15.images.markdownReads());
  assert.deepEqual(reads.map(x=>x.path), ['/work/my photo.png', String.raw`C:\work\_photo.png`, '/work/a#b.png']);
  assert.ok(reads.every(x=>x.session===(aside?'child-chat':'one')));
  await chat.getByRole('button',{name:'打开图片: space',exact:true}).click();
  const preview=page.getByRole('dialog',{name:'原图预览',exact:true});
  await preview.waitFor();
  const image=preview.locator('img'), original=await image.boundingBox();
  await image.dblclick();
  await page.waitForFunction(width=>document.querySelector('[role="dialog"] img')?.getBoundingClientRect().width>width*2,original.width);
  assert.equal(await page.evaluate(()=>window.dshmHandleBack()),true);
  await preview.waitFor({state:'detached'});
  if(aside) return {aside:true,officialPaths:true,scopedReads:true,zoom:true,systemBack:true};
  await page.evaluate(async()=>{window.preview15.images.markdownFailure(true);await window.preview15.images.markdown('![retry](/work/retry.png)');});
  const retry=chat.getByRole('button',{name:'重新加载',exact:true});
  await retry.waitFor();
  assert.equal(await page.evaluate(()=>window.preview15.images.markdownReads().filter(x=>x.path==='/work/retry.png').length),1);
  await page.evaluate(()=>window.preview15.images.markdownFailure(false));
  await retry.click();
  await chat.getByRole('button',{name:'打开图片: retry',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.preview15.images.markdownReads().filter(x=>x.path==='/work/retry.png').length),2);
  await page.evaluate(async()=>{window.preview15.images.markdownFailure(true);await window.preview15.images.markdown('![reconnect](/work/reconnect.png)');});
  await retry.waitFor();
  await page.evaluate(()=>{window.preview15.model.publish({connectionState:'disconnected'});window.preview15.images.markdownFailure(false);window.preview15.model.publish({connectionState:'connected'});});
  await chat.getByRole('button',{name:'打开图片: reconnect',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.preview15.images.markdownReads().filter(x=>x.path==='/work/reconnect.png').length),2);
  return {officialPaths:true,scopedReads:true,zoom:true,systemBack:true,manualRetry:true,reconnectRetry:true};
}
