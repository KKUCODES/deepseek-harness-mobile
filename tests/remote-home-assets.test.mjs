import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { buildPlugin } from '../packages/plugin-sdk/build.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('独立首页携带未改写的原 Figma SVG，原尺寸与宿主资产一致', async () => {
  for (const [name,size] of [['back',24],['more',24],['monitor',28],['folder',24],['chevron',20],['edit',20]]) {
    const source = await readFile(`src/ui/assets/remote/${name}.svg`);
    const bundled = await readFile(`packages/remote-home-design/assets/${name}.svg`);
    assert.deepEqual(bundled, source, `${name} 不能替换成近似路径`);
    assert.match(bundled.toString(), new RegExp(`width="${size}" height="${size}"`));
  }
});

test('公开SDK打包后的原SVG可作为CSS mask地址，不能带未转义的SVG属性引号', async () => {
  const output = resolve('artifacts/tests/remote-theme/portable-home.dshm-plugin');
  await buildPlugin({ root: resolve('packages/remote-home-design'), output });
  const pkg = JSON.parse(await readFile(output, 'utf8'));
  const entry = resolve('artifacts/tests/remote-theme/portable-home.mjs');
  await writeFile(entry, pkg.code);
  const plugin = (await import(pathToFileURL(entry))).default({ React });
  let Home;
  plugin.apply({ slots: { register(slot, component) { Home = component; } } });
  const markup = renderToStaticMarkup(React.createElement(Home, { home: { t: value => value, view: { connection: 'connected', workspaces: [], sessions: [], query: '', ready: true }, actions: { readScroll: () => 0 } } }));
  const sources = [...markup.matchAll(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)].map(match => Buffer.from(match[1], 'base64'));
  assert.ok(sources.length >= 4, '实际公开组件必须渲染可移植mask资源');
  for (const name of ['back','more','monitor','folder','edit']) {
    const original = await readFile(`src/ui/assets/remote/${name}.svg`);
    assert.ok(sources.some(bytes => bytes.equals(original)), `${name} 原SVG字节必须进入实际渲染的URL`);
  }
});
