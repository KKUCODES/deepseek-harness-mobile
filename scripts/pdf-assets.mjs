import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { installRemotePlatform } from '../src/remote-platform.mjs';
import { build } from 'esbuild';

export async function pdfWorkerPlatform() {
  // 仅打包 Worker 实际缺失的方法；官方实现保留转移后原缓冲区失效的语义。
  const result = await build({
    stdin: { contents: "import 'core-js/actual/array-buffer/transfer-to-fixed-length.js';", resolveDir: dirname(fileURLToPath(import.meta.url)) },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'chrome100', minify: true,
  });
  return `${installRemotePlatform.toString()}\ninstallRemotePlatform();\n${result.outputFiles[0].text}\n`;
}

// 与上游 PDF.js 6 的 BinaryDataFactory 保持相同资产键；Android 使用同版本 legacy 构建。
export async function pdfAssets() {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('pdfjs-dist/package.json'));
  const assets = {}, notices = [`PDF.js\n${await readFile(resolve(root, 'LICENSE'), 'utf8')}`,
    `core-js\n${await readFile(resolve(dirname(require.resolve('core-js/package.json')), 'LICENSE'), 'utf8')}`];
  for (const [kind, directory] of [['cMapUrl', 'cmaps'], ['standardFontDataUrl', 'standard_fonts'], ['wasmUrl', 'wasm']]) {
    assets[kind] = {};
    for (const name of (await readdir(resolve(root, directory))).sort()) {
      const bytes = await readFile(resolve(root, directory, name));
      if (name.startsWith('LICENSE')) notices.push(`${directory}/${name}\n${bytes.toString('utf8')}`);
      else assets[kind][name] = bytes.toString('base64');
    }
  }
  return {
    assets, notices: notices.join('\n\n'),
    engine: resolve(root, 'legacy/build/pdf.mjs'), viewer: resolve(root, 'legacy/web/pdf_viewer.mjs'),
    // Worker 有独立全局对象，不能依赖主页面已安装的 WebView 兼容方法。
    worker: `${await pdfWorkerPlatform()}${await readFile(resolve(root, 'legacy/build/pdf.worker.min.mjs'), 'utf8')}`,
  };
}
