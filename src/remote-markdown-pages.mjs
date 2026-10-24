export const MARKDOWN_PAGE_SIZE = 8000;

/** 以原文行分段；跨段代码围栏补齐显示语法，原正文和复制内容不变。 */
export function markdownPages(text, limit = MARKDOWN_PAGE_SIZE) {
  const pages = []; let body = '', fence, prefix = '';
  const flush = () => { if (body) pages.push(prefix + body + (fence ? `\n${fence.marker}` : '')); body = ''; prefix = fence ? fence.open + '\n' : ''; };
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const token = /^ {0,3}(`{3,}|~{3,})([^\n]*)/.exec(line);
    if (body.length + line.length > limit) flush();
    let rest = line;
    while (rest.length > limit) {
      let at = limit;
      if (/[\uD800-\uDBFF]/.test(rest[at - 1])) at--;
      body += rest.slice(0, at); rest = rest.slice(at); flush();
    }
    body += rest;
    if (token && (!fence || token[1][0] === fence.marker[0] && token[1].length >= fence.marker.length && !token[2].trim())) {
      fence = fence ? undefined : { marker: token[1], open: token[0] };
    }
  }
  flush(); return pages;
}
