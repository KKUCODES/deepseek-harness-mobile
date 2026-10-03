import { context } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileExample } from '../docs/design/ordinary-preview/remote-chat-demo.mjs';
import { createPreviewServer } from './preview-server.mjs';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'docs/design/ordinary-preview');
const output = resolve(root, 'artifacts/ordinary-preview');
await mkdir(output, { recursive: true });
const build = await context({
  absWorkingDir: root, entryPoints: [resolve(source, 'main.jsx')], outdir: output,
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', target: 'chrome100',
  loader: { '.module.css': 'local-css' }, metafile: true,
  nodePaths: [resolve(root, 'node_modules')],
  alias: { '@upstream': resolve(root, '../deepseek-harness/packages/client'), react: dirname(require.resolve('react/package.json')), clsx: require.resolve('clsx') },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const result = await build.rebuild();
await copyFile(resolve(source, 'index.html'), resolve(output, 'index.html'));
await writeFile(resolve(output, 'composer.latest.example.ts'), fileExample.latest);
await writeFile(resolve(output, 'source-map.json'), JSON.stringify(result.metafile, null, 2));
if (process.argv.includes('--serve')) {
  const server = await build.serve({ servedir: output, host: '127.0.0.1', port: 0 });
  createPreviewServer(server.port).listen(4400, '127.0.0.1', () => console.log('Ordinary chat design preview: http://127.0.0.1:4400/'));
} else {
  await build.dispose();
  console.log('Built ordinary chat design preview.');
}
