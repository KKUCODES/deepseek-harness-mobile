const ESC = '\u001b';
const CSI = /\u001b\[([0-9;]*)m/g;
const empty = () => ({ fg: '', bg: '', attrs: [] });
const closers = { 22: [1, 2], 23: [3], 24: [4], 25: [5, 6], 27: [7], 28: [8], 29: [9] };

// 仅携带上游渲染器支持的有限 SGR 状态；未知属性不能随输出无限增长。
function fold(state, params) {
  const codes = params.split(';').map(Number);
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code === 0) state = empty();
    else if (code === 38 || code === 48) {
      const count = codes[i + 1] === 2 ? 4 : codes[i + 1] === 5 ? 2 : 0;
      const values = codes.slice(i + 2, i + count + 1);
      if (count && values.length === count - 1 && values.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
        state[code === 38 ? 'fg' : 'bg'] = codes.slice(i, i + count + 1).join(';');
      }
      i += count;
    } else if (code === 39 || code === 49) state[code === 39 ? 'fg' : 'bg'] = '';
    else if (code >= 30 && code <= 37 || code >= 90 && code <= 97) state.fg = String(code);
    else if (code >= 40 && code <= 47 || code >= 100 && code <= 107) state.bg = String(code);
    else if (closers[code]) state.attrs = state.attrs.filter(n => !closers[code].includes(n));
    else if (code >= 1 && code <= 9 && !state.attrs.includes(code)) state.attrs.push(code);
  }
  return state;
}
function after(prefix, text) {
  let state = empty();
  for (const match of (prefix + text).matchAll(CSI)) state = fold(state, match[1]);
  const codes = [...state.attrs, state.fg, state.bg].filter(value => value !== '');
  return codes.length ? `${ESC}[${codes.join(';')}m` : '';
}

/** 显示专用流状态；原始文本、UTF-8 字节游标和复制内容仍由 reader 独立保留。 */
export class RemoteOutputAnsi {
  control = '';
  pending = '';
  stringEscape = false;
  prefix = '';
  tail = '';
  text = '';
  filter(input) {
    const output = [];
    for (const char of input) {
      if (this.control === 'string') {
        if (char === '\u0007' || this.stringEscape && char === '\\') this.control = '';
        this.stringEscape = char === ESC;
      } else if (this.control === 'escape') {
        if (char === '[') { this.control = 'csi'; this.pending = ESC + '['; }
        else if (']PX^_'.includes(char)) { this.control = 'string'; this.stringEscape = false; }
        else if (char >= ' ' && char <= '/') this.control = 'intermediate';
        else this.control = char === ESC ? 'escape' : '';
      } else if (this.control === 'intermediate') {
        if (char >= '0' && char <= '~') this.control = '';
        else if (char === ESC) this.control = 'escape';
      } else if (this.control === 'csi' || this.control === 'discard') {
        if (char === ESC) { this.control = 'escape'; this.pending = ''; }
        else if (char >= '@' && char <= '~') {
          if (this.control === 'csi') output.push(this.pending + char);
          this.control = ''; this.pending = '';
        } else if (this.control === 'csi') {
          this.pending += char;
          if (this.pending.length > 256) { this.control = 'discard'; this.pending = ''; }
        }
      } else if (char === ESC) this.control = 'escape';
      else output.push(char);
    }
    return output.join('');
  }
  append(input, { history, gap, end, preserve, limit }) {
    if (gap) { this.control = ''; this.pending = ''; this.stringEscape = false; this.tail = ''; }
    const next = this.filter(input);
    if (end) { this.control = ''; this.pending = ''; this.stringEscape = false; }
    if (preserve && !next && !gap) return { ansiText: this.text, ansiPrefix: this.prefix };
    let prefix = history ? this.tail : this.prefix;
    let text = history ? next : this.text + (gap ? `${ESC}[0m\n…部分输出已丢失…\n` : '') + next;
    this.tail = after(this.tail, next);
    if (text.length > limit) {
      let cut = text.length - limit;
      // 不从 CSI 中间或 UTF-16 代理对中间开始展示。
      const start = text.lastIndexOf(ESC + '[', cut - 1);
      if (start >= 0) {
        const final = text.slice(start + 2).search(/[@-~]/);
        if (final >= 0 && start + 2 + final >= cut) cut = start + 3 + final;
      }
      if (/[\uDC00-\uDFFF]/u.test(text[cut] ?? '')) cut++;
      prefix = after(prefix, text.slice(0, cut));
      text = text.slice(cut);
    }
    this.prefix = prefix; this.text = text;
    return { ansiText: text, ansiPrefix: prefix };
  }
}
