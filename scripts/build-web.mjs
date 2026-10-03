import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile, copyFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { remoteSourceAliases } from './remote-source-aliases.mjs';
import { pdfAssets } from './pdf-assets.mjs';
import { mobileApprovalAccessibility } from './mobile-approval-accessibility.mjs';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await mkdir(resolve(dist, 'plugins'), { recursive: true });
const prefix = '@deepseek-ai/dsh-client-';
const packages = ['modules', 'ui-renderer', 'locale', 'ui-theme'];
const records = [];
for (const short of packages) {
  const id = prefix + short;
  const packageFile = require.resolve(`${id}/package.json`);
  const metadata = JSON.parse(await readFile(packageFile, 'utf8'));
  const file = resolve(dirname(packageFile), 'lib/client.js');
  const bytes = await readFile(file);
  const revision = createHash('sha256').update(bytes).digest('hex');
  await writeFile(resolve(dist, `plugins/${short}.js`), bytes);
  records.push({ id, file: `plugins/${short}.js`, revision, version: metadata.version, bytes: bytes.length });
}
const fixture = resolve(root, '../deepseek-harness/apps/web/tests/fixtures/plugins/fixture-live-client/client.js');
await copyFile(fixture, resolve(dist, 'plugins/fixture.js'));
const fixtureBytes = await readFile(fixture);
records.push({ id: '@fixture/live-client', file: 'plugins/fixture.js', revision: createHash('sha256').update(fixtureBytes).digest('hex'), bytes: fixtureBytes.length, source: 'upstream test fixture, not a marketplace plugin' });
await writeFile(resolve(dist, 'plugin-artifacts.json'), JSON.stringify(records, null, 2));
const pdf = await pdfAssets();
await writeFile(resolve(dist, 'PDFJS-LICENSES.txt'), pdf.notices);
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.jsx', 'src/mobile-main.jsx', 'src/remote-main.jsx'], outdir: dist, bundle: true, format: 'esm', platform: 'browser',
  // 保留上游语法库的动态加载，首页不解析尚未出现的代码语言。
  splitting: true, chunkNames: 'chunks/[name]-[hash]',
  target: ['chrome100'], jsx: 'automatic', minify: true, metafile: true,
  plugins: [mobileApprovalAccessibility(), { name: 'mobile-pdf-worker', setup(builder) {
    builder.onLoad({ filter: /ui-sidebar-documentpreview[\\/]src[\\/]client[\\/]pdf[\\/]assets\.ts$/ }, async args => ({
      // 大型资产对象限定在 PDF 模块；全局 define 会与其他 define 合并成首屏共享块。
      contents: `const __DSH_PDFJS_ASSETS__ = ${JSON.stringify(pdf.assets)};\n${await readFile(args.path, 'utf8')}`,
      loader: 'ts', resolveDir: dirname(args.path),
    }));
    builder.onResolve({ filter: /^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?raw$/ }, () => ({ path: 'pdf-worker', namespace: 'mobile-pdf' }));
    builder.onLoad({ filter: /.*/, namespace: 'mobile-pdf' }, () => ({ contents: pdf.worker, loader: 'text' }));
  } }, { name: 'mobile-clipboard', setup(builder) {
    builder.onResolve({ filter: /clipboard\.ts$/ }, args => {
      if (args.importer.replaceAll('\\', '/').includes('/deepseek-harness/packages/client/ui-primitives/')) return { path: resolve(root, 'src/ordinary-clipboard.mjs') };
    });
  } }],
  nodePaths: [resolve(root, 'node_modules')],
  loader: { '.module.css': 'local-css', '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.svg': 'file' },
  alias: {
    'pdfjs-dist/web/pdf_viewer.mjs': pdf.viewer,
    'pdfjs-dist': pdf.engine,
    ...remoteSourceAliases(root),
    '@upstream': resolve(root, '../deepseek-harness/packages/client'),
    'node:module': resolve(root, '../deepseek-harness/apps/web/src/node-module-stub.ts'),
    // 参考源码的 tsconfig 指向上游 workspace；借用的组件必须使用本宿主同一套平台依赖。
    react: dirname(require.resolve('react/package.json')),
    clsx: require.resolve('clsx'),
    '@deepseek-ai/cordis': require.resolve('@deepseek-ai/cordis'),
    '@deepseek-ai/cordis-plugin-loader': require.resolve('@deepseek-ai/cordis-plugin-loader'),
    '@deepseek-ai/dsh-util-values': resolve(root, '../deepseek-harness/packages/util/values/src/index.ts'),
    '@deepseek-ai/dsh-client-store': require.resolve('@deepseek-ai/dsh-client-store'),
    '@deepseek-ai/dsh-client-ui-slots': require.resolve('@deepseek-ai/dsh-client-ui-slots'),
    '@deepseek-ai/dsh-client-ui-primitives': require.resolve('@deepseek-ai/dsh-client-ui-primitives'),
    '@deepseek-ai/dsh-file-reference/grammar': resolve(root, '../deepseek-harness/packages/context/file-reference/src/grammar.ts'),
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.versions.node': '"0.0.0"',
    'process.execArgv': '[]',
    'process.env.CORDIS_SHARED': 'undefined',
  },
});
// PDF 仅在打开文档时加载，避免内联字体/Worker 意外进入普通聊天或 Remote 首屏。
const initial = new Set();
function visitInitial(path) {
  if (initial.has(path)) return;
  initial.add(path);
  for (const dependency of result.metafile.outputs[path]?.imports ?? []) {
    if (!dependency.external && dependency.kind !== 'dynamic-import') visitInitial(dependency.path);
  }
}
for (const entry of ['dist/mobile-main.js', 'dist/remote-main.js']) visitInitial(entry);
for (const path of initial) {
  if (Object.keys(result.metafile.outputs[path]?.inputs ?? {}).some(input => input.includes('pdfjs-dist/') || input === 'mobile-pdf:pdf-worker' || /pdf[/\\]assets\.ts$/.test(input))) {
    throw new Error(`PDF assets leaked into initial page: ${path}`);
  }
}
// chunks 是本脚本独占的生成目录；只移除本次构建已不再引用的普通 JS/CSS 文件。
const chunkDirectory = resolve(dist, 'chunks');
const currentOutputs = new Set(Object.keys(result.metafile.outputs).map(path => resolve(root, path)));
for (const entry of await readdir(chunkDirectory, { withFileTypes: true })) {
  const path = resolve(chunkDirectory, entry.name);
  if (entry.isFile() && /^[\w-]+\.(js|css)$/.test(entry.name) && dirname(path) === chunkDirectory && !currentOutputs.has(path)) await unlink(path);
}
await writeFile(resolve(dist, 'bundle-analysis.json'), JSON.stringify(result.metafile, null, 2));
await copyFile(resolve(root, 'src/index.html'), resolve(dist, 'index.html'));
await copyFile(resolve(root, 'src/remote.html'), resolve(dist, 'remote.html'));
await copyFile(resolve(root, 'src/mobile.html'), resolve(dist, 'mobile.html'));
console.log(`Built Web validation with ${records.length} recorded original plugin artifacts.`);
