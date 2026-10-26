#!/usr/bin/env node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginPackage } from './package.mjs';

/** 输出可移植的单文件包；React来自宿主，插件不携带第二份React或私有DSH依赖。 */
export async function buildPlugin({ root = process.cwd(), output, version } = {}) {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const config = pkg.dshm;
  version ??= pkg.version;
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]{0,127}$/.test(pkg.name) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    || config?.interfaceApi !== 1 || config.surface !== 'dshm.remote.home' || !config.entry) throw Error('Invalid DSHM plugin metadata');
  const hooks = ['Children','Component','Fragment','PureComponent','Suspense','cloneElement','createContext','createElement','createRef','forwardRef','isValidElement','lazy','memo','startTransition','useCallback','useContext','useDebugValue','useDeferredValue','useEffect','useId','useImperativeHandle','useInsertionEffect','useLayoutEffect','useMemo','useReducer','useRef','useState','useSyncExternalStore','useTransition'];
  const result = await build({ absWorkingDir: root, entryPoints: [config.entry], bundle: true, write: false,
    platform: 'browser', format: 'iife', globalName: '__dshmPlugin', target: 'chrome100', jsx: 'transform', minify: true,
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.woff2': 'dataurl', '.css': 'text' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'dshm-public-api', setup(builder) {
      // SVG 的原始 data URL 可能含引号，嵌入 CSS url() 时会失效；base64 保留原字节且兼容旧 WebView。
      builder.onLoad({ filter: /\.svg$/ }, async ({ path }) => ({ contents: `export default ${JSON.stringify('data:image/svg+xml;base64,' + (await readFile(path)).toString('base64'))}`, loader: 'js' }));
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'dshm-sdk' }));
      builder.onLoad({ filter: /.*/, namespace: 'dshm-sdk' }, () => ({ contents: `const React=__dshmApi.React; export default React; export const {${hooks.join(',')}}=React;` }));
      builder.onResolve({ filter: /^(@deepseek-ai\/|@upstream\/|react\/|react-dom)/ }, args => ({ errors: [{ text: `Private or unsupported runtime dependency: ${args.path}` }] }));
    } }],
  });
  if (result.outputFiles.length !== 1) throw Error('Use inline resources; only one JavaScript entry is supported');
  const code = `export default function(__dshmApi){${result.outputFiles[0].text}\nreturn {...__dshmPlugin,version:${JSON.stringify(version)}};}`;
  // 包结构是公开协议；原生安装器会重新校验，不能用构建成功代替手机侧检查。
  const artifact = { schema: 1, id: pkg.name, name: config.displayName ?? pkg.name, version, description: pkg.description,
    apiVersion: config.interfaceApi, surface: config.surface, code, sha256: createHash('sha256').update(code).digest('hex') };
  const bytes = Buffer.from(JSON.stringify(artifact));
  validatePluginPackage(bytes);
  output ??= resolve(root, 'dist', `${pkg.name.split('/').at(-1)}-${version}.dshm-plugin`);
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  return { path: output, bytes: bytes.length, sha256: artifact.sha256, id: artifact.id, version };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  console.log(JSON.stringify(await buildPlugin({ root: resolve(value('--root') ?? process.cwd()), output: value('--out') && resolve(value('--out')), version: value('--version') })));
}
