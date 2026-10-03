import React from 'react';

/** 真实手机插槽注册与原错误边界，检查动态运行器依赖的组件身份。 */
export async function renderFailureProbe(model) {
  const observed = [];
  function Crasher() {
    const [failed, setFailed] = React.useState(false);
    if (failed) throw Error('DSHM_RENDER_IDENTITY_PROBE');
    return <button data-testid="render-identity-probe" onClick={() => setFailed(true)}>触发测试错误</button>;
  }
  function FactoryCrasher() {
    const [failed, setFailed] = React.useState(false);
    if (failed) throw Error('DSHM_FACTORY_IDENTITY_PROBE');
    return <button data-testid="factory-identity-probe" onClick={() => setFailed(true)}>触发工厂测试错误</button>;
  }
  const off = model.ctx.slots.onEntryError((slot, entry, error, info) => {
    if (error.message === 'DSHM_RENDER_IDENTITY_PROBE') observed.push({ slot, original: entry.component === Crasher, ...info });
    if (error.message === 'DSHM_FACTORY_IDENTITY_PROBE') observed.push({ slot, original: entry.component === FactoryCrasher, ...info });
  });
  const plugin = model.ctx.plugin({ name: '@fixture/render-identity', inject: ['slots'], apply(ctx) {
    ctx.slots.register({ name: 'conversation.session.header.actions', id: 'render-identity' }, Crasher);
    ctx.slots.registerFactory({ name: 'fixture.render.failure', scope: 'session' }, FactoryCrasher);
    ctx.slots.register({ name: 'conversation.session.header.actions', id: 'factory-identity' },
      ({ renderFactorySlot }) => renderFactorySlot('fixture.render.failure', {}));
  } });
  await plugin.await();
  return { observed, dispose: () => { off(); plugin.dispose(); } };
}
