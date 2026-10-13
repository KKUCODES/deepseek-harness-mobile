import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { isProfileDshVersion } from '../src/remote-dsh-version.mjs';

/** 在手机产物目录派生原组件；只扩展来源解析，不修改上游参考或插件内部布局。 */
export function remoteDocumentSources(root, { upstream = resolve(root, '../deepseek-harness'), generated = resolve(root, 'artifacts/source'), version } = {}) {
  const base = 'ui-sidebar-documentpreview/src/client';
  const output = resolve(generated, 'document-preview');
  const files = ['TextPreview.tsx', 'face.ts', 'image/ImageBody.tsx', 'code/CodeBody.tsx', 'office/OfficeBody.tsx', 'image/index.ts', 'code/index.ts'];
  const aliases = {};
  for (const file of files) {
    let text = readFileSync(resolve(upstream, 'packages/client', base, file), 'utf8');
    const replace = (from, to) => {
      if (text.split(from).length !== 2) throw new Error(`Document source changed: ${file}: ${from}`);
      text = text.replace(from, to);
    };
    if (file.endsWith('/index.ts')) {
      const folder = file.split('/')[0], body = folder === 'image' ? 'ImageBody' : 'CodeBody';
      replace(`from './${body}.tsx'`, `from '@dshm/document/${folder}/${body}.tsx'`);
    } else if (file === 'face.ts') {
      replace('read: ReadWorkspaceFilePage,', 'read: (file: SessionFile, offset: number, signal: AbortSignal) => ReturnType<ReadWorkspaceFilePage>,');
      replace('read(file.sessionId, file.path, offset, signal)', 'read(file, offset, signal)');
    } else if (file === 'code/CodeBody.tsx') {
      replace("import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'",
        "import { resolveDocumentAddress as parseFileAddress } from '@dshm/document-address'");
    } else {
      const from = file === 'TextPreview.tsx' ? './rpc.ts' : '../rpc.ts';
      replace(`import { hostFileOf } from '${from}'`, "import { resolveDocumentAddress as hostFileOf } from '@dshm/document-address'");
    }
    if (file === 'office/OfficeBody.tsx') {
      // 缓存保存稳定的提示键；切语言只更新显示，不重新读取或转换原文档。
      if (isProfileDshVersion(version)) {
        replace('export interface OfficeBodyInjected extends OfficeLoadInjected {',
          'export interface OfficeBodyInjected extends OfficeLoadInjected {\n  readonly renderFailure: (message: string) => string');
      } else {
        replace('readonly describeFailure: (failure: RemoteFailure | { readonly message: string }) => string',
          'readonly describeFailure: (failure: RemoteFailure | { readonly message: string }) => string\n  readonly renderFailure: (message: string) => string');
      }
      replace('{view.failure.message}', '{props.renderFailure(view.failure.message)}');
    }
    // CSS和其余依赖仍来自同一基线；生成文件不持有第二份上游实现。
    text = text.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,
      (_match, before, path, after) => before + '@upstream/' + posix.normalize(posix.join(base, posix.dirname(file), path)) + after);
    const target = resolve(output, file);
    mkdirSync(dirname(target), { recursive: true });
    const source = '// Generated DSHM source adapter; see scripts/remote-document-sources.mjs.\n' + text;
    let previous;
    try { previous = readFileSync(target, 'utf8'); } catch {}
    if (previous !== source) writeFileSync(target, source);
    aliases[`@dshm/document/${file}`] = target;
  }
  aliases['@dshm/document-address'] = resolve(root, 'src/remote-document-address.mjs');
  return aliases;
}
