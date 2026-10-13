import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/** 编译只读上游测试样例；ZIP 依赖属于手机测试项目，不向上游检出安装依赖。 */
export async function loadOfficeFixture() {
  const source = resolve('../deepseek-harness/apps/web/tests/office-fixture.ts');
  const output = resolve('artifacts/office-fixture.mjs');
  await build({ entryPoints: [source], outfile: output, bundle: true, platform: 'node', format: 'esm',
    alias: { fflate: createRequire(import.meta.url).resolve('fflate') },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(source).href) } });
  return import(pathToFileURL(output).href);
}

/** 有效分页Word原件；只增加样例内容，让真实PDF超过四个传输窗口。 */
export async function largeOfficeBytes(pages = 600) {
  if (!Number.isSafeInteger(pages) || pages < 1 || pages > 2400) throw Error('invalid_office_fixture_page_count');
  const { realOfficeBytes } = await loadOfficeFixture();
  const files = unzipSync(realOfficeBytes('docx'));
  const document = strFromU8(files['word/document.xml']);
  if ((document.match(/<w:p>/g) ?? []).length !== 1) throw Error('unexpected_office_fixture');
  const paragraphs = Array.from({ length: pages }, (_, page) => {
    const text = Array.from({ length: 20 }, (_, part) => createHash('sha256').update(`DSHM stream ${page}:${part}`).digest('hex')).join(' ');
    return `<w:p>${page ? '<w:pPr><w:pageBreakBefore/></w:pPr>' : ''}<w:r><w:t>DSHM transmission page ${page}: ${text}</w:t></w:r></w:p>`;
  }).join('');
  files['word/document.xml'] = strToU8(document.replace(/<w:p>.*?<\/w:p>/s, paragraphs));
  return zipSync(files);
}

/** 同名文件使用不同正文，真实 PDF 文字层必须展示所属工作区的内容。 */
export async function sessionOfficeBytes() {
  const { realOfficeBytes } = await loadOfficeFixture();
  const source = realOfficeBytes('docx'), files = unzipSync(source);
  const document = strFromU8(files['word/document.xml']);
  const matches = [...document.matchAll(/<w:t>([^<]+)<\/w:t>/g)];
  if (matches.length !== 1) throw Error('unexpected_session_office_fixture');
  const sourceText = matches[0][1], differentText = 'DSHM_OTHER_WORKSPACE_ONLY_20261005';
  files['word/document.xml'] = strToU8(document.replace(matches[0][0], `<w:t>${differentText}</w:t>`));
  return { source, differentSource: zipSync(files), sourceText, differentText };
}

/** 等长有效原件改变正文；ZIP 使用存储模式，避免压缩率差异改变文件大小。 */
export async function sameSizeOfficeBytes() {
  const { realOfficeBytes } = await loadOfficeFixture();
  const files = unzipSync(realOfficeBytes('docx'));
  const document = strFromU8(files['word/document.xml']);
  const matches = [...document.matchAll(/<w:t>([^<]+)<\/w:t>/g)];
  if (matches.length !== 1) throw Error('unexpected_same_size_office_fixture');
  const sourceText = 'DSHM_METADATA_CONTENT_A', differentText = 'DSHM_METADATA_CONTENT_B';
  const encode = text => zipSync({ ...files,
    'word/document.xml': strToU8(document.replace(matches[0][0], `<w:t>${text}</w:t>`)) }, { level: 0 });
  const source = encode(sourceText), differentSource = encode(differentText);
  if (source.length !== differentSource.length || Buffer.from(source).equals(Buffer.from(differentSource)))
    throw Error('invalid_same_size_office_fixture');
  return { source, differentSource, sourceText, differentText };
}
