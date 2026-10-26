import assert from 'node:assert/strict';

/** 在真实首页槽/默认回退与手机外观同步入口上复现跨来源色板冲突。 */
export async function checkPhoneHomeTheme(page, choose) {
  const skin = await page.addStyleTag({ content: `body { --dsw-alias-bg-layer-1:rgba(30,27,25,.94)!important; --dsw-alias-label-primary:rgb(244,241,232)!important; --dsw-alias-label-secondary:#bdb7ad!important; --regression-skin-asset:preserved; }` });
  const read = locator => locator.evaluate(e => ({ color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor }));
  const colors = { light: { color: 'rgb(21, 23, 30)', background: 'rgb(255, 255, 255)' }, dark: { color: 'rgb(243, 245, 250)', background: 'rgb(27, 29, 36)' } };
  const cases = [];
  try {
    for (const [preference, systemDark, scheme] of [['light', true, 'light'], ['dark', false, 'dark'], ['system', false, 'light'], ['system', true, 'dark']]) {
      await page.evaluate(({preference, systemDark}) => window.interfaceProbe.appearance(preference, systemDark), {preference, systemDark});
      await page.waitForFunction(expected => document.documentElement.style.colorScheme === expected, scheme);
      await page.waitForTimeout(350);
      const home = page.getByTestId('remote-home-plugin');
      assert.deepEqual(await read(home), colors[scheme], `${preference}/${systemDark}: 手机主题不应被电脑公共色板覆盖`);
      for (const button of await home.locator('.dhp-bar button,.dhp-footer>button').all()) {
        assert.deepEqual(await read(button), { color: colors[scheme].color, background: scheme === 'dark' ? 'rgb(39, 43, 53)' : 'rgb(238, 241, 247)' });
      }
      await home.getByRole('button',{name:'Remote 选项',exact:true}).click();
      const menu = page.getByRole('dialog',{name:'Remote 选项',exact:true});
      assert.deepEqual(await read(menu), colors[scheme], '首页菜单也必须采用同一手机色板');
      await menu.getByRole('button',{name:'关闭窗口',exact:true}).click();
      await menu.waitFor({state:'hidden'});
      assert.equal(await home.evaluate(e => getComputedStyle(e).getPropertyValue('--regression-skin-asset').trim()), 'preserved', '不能清空插件的其他变量');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary').trim()), 'rgb(244,241,232)', '电脑全局色板保持原样');
      await choose('默认首页');
      const fallback = page.getByTestId('remote-home-default');
      assert.deepEqual(await read(fallback), colors[scheme], '默认首页遵守同一主题');
      for (const button of await fallback.locator('.remote-topbar button,.remote-home-actions>button').all()) {
        assert.equal((await read(button)).color, colors[scheme].color, '默认控件前景也采用手机色板');
      }
      await choose(/Remote 新版首页/);
      assert.deepEqual(await read(home), colors[scheme], '重启插件沿用当前主题');
      cases.push(`${preference}/${systemDark ? 'system-dark' : 'system-light'} + desktop dark palette + default fallback`);
    }
  } finally {
    await skin.evaluate(e => e.remove());
    await page.evaluate(() => window.interfaceProbe.appearance('light', false));
  }
  const home = page.getByTestId('remote-home-plugin');
  for (const [name, size] of [['back',24],['more',24],['monitor',28],['folder',24],['next',20],['new',20]]) {
    const icon = home.locator(`[data-icon="${name}"]`).first();
    assert.deepEqual(await icon.evaluate(async e => {
      const style = getComputedStyle(e), source = style.maskImage.match(/^url\("?(.*?)"?\)$/)?.[1];
      const image = new Image(); image.src = source; await image.decode();
      return [e.getBoundingClientRect().width,e.getBoundingClientRect().height,image.naturalWidth,image.naturalHeight];
    }), [size,size,size,size], `${name}: 原 SVG、原尺寸、实际加载`);
  }
  return cases;
}
