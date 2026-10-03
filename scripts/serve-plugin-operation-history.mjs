import { build } from 'esbuild';
import { createServer } from 'node:http';
import { resolve, basename } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const built = await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/plugin-operation-history.jsx'],
  outdir: 'artifacts/plugin-operation-history-ui', bundle: true, write: false, format: 'esm', jsx: 'automatic',
  loader: { '.module.css': 'local-css', '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.svg': 'file' },
  alias: { '@upstream': resolve(root, '../deepseek-harness/packages/client'),
    react: resolve(require.resolve('react/package.json'), '..'), clsx: require.resolve('clsx') },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const files = new Map(built.outputFiles.map(file => ['/' + basename(file.path), file.contents]));
const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/plugin-operation-history.css"><div id="app"></div><script type="module" src="/plugin-operation-history.js"></script>';
const server = createServer((request, response) => {
  if (request.method !== 'GET') { response.writeHead(405).end(); return; }
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html); return; }
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }).end(file);
});
server.listen(0, '127.0.0.1', () => console.log(`Isolated component replay: http://127.0.0.1:${server.address().port}/`));
