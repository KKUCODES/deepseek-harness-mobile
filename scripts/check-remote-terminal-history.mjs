import assert from 'node:assert/strict';

/** 以大于估算值的真实组高走列表进入、分页和最早页按钮消失。 */
export async function checkRemoteTerminalHistory(page) {
  await page.evaluate(async()=>{await window.fixture.select(null);window.preview15.history.setup({turns:40,paragraphs:50,sessionId:'one'});});
  const main=page.getByTestId('remote-workspace');
  await main.locator('.remote-session-row,[data-remote-home-session]').filter({hasText:'one'}).first().click();
  const chat=main.getByRole('region',{name:'聊天内容',exact:true});
  const editor=main.getByRole('textbox',{name:'消息',exact:true});
  await editor.fill('保留最早页回归草稿');
  const deltas=[];
  for(let index=0;index<2;index++){
    await chat.evaluate(host=>{host.scrollTop=0;});
    await page.waitForTimeout(80);
    await page.evaluate(()=>window.preview15.history.hold());
    const before=await page.evaluate(()=>window.preview15.state());
    await chat.locator('[data-history-loader]').click();
    await page.waitForFunction(calls=>window.preview15.state().calls>calls,before.calls);
    const anchor=await chat.evaluate(host=>{
      const top=host.getBoundingClientRect().top;
      const node=[...host.querySelectorAll('[data-history-group]')].find(n=>n.getBoundingClientRect().bottom>top);
      return {key:node.dataset.historyGroup,top:node.getBoundingClientRect().top};
    });
    await page.evaluate(()=>window.preview15.history.release());
    await page.waitForFunction(records=>window.preview15.state().records>records,before.records);
    await page.waitForTimeout(80);
    await chat.locator('[data-history-positioning]').waitFor({state:'detached'});
    const delta=await chat.locator(`[data-history-group="${anchor.key}"]`).evaluate((node,top)=>node.getBoundingClientRect().top-top,anchor.top);
    assert.ok(Math.abs(delta)<4,`最早页原可见锚点偏移 ${delta}`);deltas.push(delta);
  }
  assert.equal(await chat.locator('[data-history-loader]').count(),0);
  assert.equal(await editor.innerText(),'保留最早页回归草稿');
  const state=await page.evaluate(()=>window.preview15.state());
  assert.equal(state.first,0);assert.equal(state.records,200);assert.ok(state.groups<=14);
  await chat.evaluate(host=>{host.dispatchEvent(new WheelEvent('wheel',{deltaY:-200,bubbles:true}));host.scrollTop-=200;});
  await page.waitForTimeout(80);
  assert.equal(await chat.locator('[data-history-positioning]').count(),0);
  return {deltas,records:state.records,boundedDOM:true,draft:true,readerControl:true};
}
